import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'
import { sendFcmToMany } from '../_shared/fcm.ts'
import { NOTIF_TEXT, groupSubsByLang, type Lang } from '../_shared/notif-i18n.ts'
import { selectEventAudience, type AudienceProfile } from '../_shared/audience.ts'
import { filterDeliverable } from '../_shared/recipients.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let record: Record<string, unknown>
  try {
    const body = await req.json()
    console.log('[push-new-event] received:', JSON.stringify(body).slice(0, 200))
    record = body.record ?? body
  } catch (e) {
    console.error('[push-new-event] bad json:', e)
    return new Response('Bad Request', { status: 400 })
  }

  const eventId   = record.id as string
  const eventLat  = record.lat as number
  const eventLng  = record.lng as number
  const eventTitle = record.title as string
  const creatorId = record.creator_id as string | null

  console.log(`[push-new-event] event=${eventId} title="${eventTitle}" lat=${eventLat} lng=${eventLng}`)

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push-new-event] VAPID keys not set!')
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Wydarzenie prywatne widzą tylko twórca i obserwujący, więc nie może być
  // żadnego fan-outu po lokalizacji/tagach. Świeżo wstawiony event nie ma
  // jeszcze obserwujących poza twórcą — nie ma kogo powiadomić.
  let isPrivate: boolean
  if (typeof record.is_private === 'boolean') {
    isPrivate = record.is_private
  } else {
    // Webhook bez tej kolumny — dopytujemy bazę i przy błędzie milczymy,
    // zamiast zgadywać, że event jest publiczny.
    const { data: visibility, error: visErr } = await admin
      .from('events').select('is_private').eq('id', eventId).single()
    if (visErr || !visibility) {
      console.error('[push-new-event] nie udało się ustalić is_private, pomijam wysyłkę:', visErr)
      return new Response(JSON.stringify({ sent: 0, reason: 'visibility unknown' }), { status: 500 })
    }
    isPrivate = visibility.is_private
  }

  if (isPrivate) {
    console.log(`[push-new-event] event=${eventId} jest prywatny — brak fan-outu`)
    return new Response(JSON.stringify({ sent: 0, reason: 'private event' }), { status: 200 })
  }

  // Pobierz tagi eventu
  const { data: tagRows, error: tagErr } = await admin
    .from('event_tags').select('tag').eq('event_id', eventId)
  if (tagErr) console.error('[push-new-event] tag query error:', tagErr)
  const tags: string[] = (tagRows ?? []).map((r: { tag: string }) => r.tag)
  console.log(`[push-new-event] tags: [${tags.join(', ')}]`)

  // Znajdź aktywnych userów z subskrypcjami push.
  // push_enabled tutaj to wyłącznie zmniejszenie payloadu — bramką pozostaje
  // filterDeliverable poniżej, żeby reguła miała jedno miejsce. Gdyby te dwa
  // kiedyś się rozjechały, ten filtr może tylko zawęzić listę, nigdy poszerzyć.
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, interests, radius_km, last_lat, last_lng')
    .eq('push_enabled', true)
    .not('last_lat', 'is', null)
    .not('last_lng', 'is', null)
    .gte('last_seen_at', new Date(Date.now() - 30 * 86400_000).toISOString())

  if (profErr) console.error('[push-new-event] profiles error:', profErr)
  console.log(`[push-new-event] active profiles with location: ${(profiles ?? []).length}`)

  // Język pobiera filterDeliverable dla finalnej listy, więc to zapytanie —
  // idące po wszystkich aktywnych profilach — nie musi go ciągnąć.

  // Obserwujący twórcy są już w event_follows: trigger w bazie dopisał ich w
  // tej samej transakcji, co insert wydarzenia. Twórca też tu jest - wypada
  // niżej przez excludeCreator.
  const { data: followRows, error: followErr } = await admin
    .from('event_follows').select('user_id').eq('event_id', eventId)
  if (followErr) console.error('[push-new-event] follows error:', followErr)
  const followerIds: string[] = (followRows ?? []).map((r: { user_id: string }) => r.user_id)
  console.log(`[push-new-event] event followers at insert: ${followerIds.length}`)

  // Event bez tagów trafia do wszystkich w okolicy, z tagami — tylko do
  // zainteresowanych. Twórca nie dostaje powiadomienia o własnym wydarzeniu.
  const audienceIds = selectEventAudience({
    isPrivate: false,
    tags,
    profiles: (profiles ?? []) as AudienceProfile[],
    lat: eventLat,
    lng: eventLng,
    creatorId,
    followerIds,
    excludeCreator: true,
  })

  // Świeżo wstawionego wydarzenia nikt nie zdążył wyciszyć, więc bez eventId.
  const { ids: targetIds, langByUser } = await filterDeliverable(admin, audienceIds)

  console.log(`[push-new-event] audience: ${audienceIds.length}, deliverable: ${targetIds.length}`)

  if (targetIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no matching users' }), { status: 200 })
  }

  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key, user_id')
    .in('user_id', targetIds)

  if (subErr) console.error('[push-new-event] subs error:', subErr)
  console.log(`[push-new-event] push subscriptions found: ${(subs ?? []).length}`)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no push subs' }), { status: 200 })
  }

  const groups = groupSubsByLang(subs, langByUser)
  for (const [lang, langSubs] of groups) {
    await sendToMany(
      langSubs,
      { title: NOTIF_TEXT.new_event.title![lang], body: eventTitle, type: 'new_event', eventId },
      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
      admin
    )
  }

  // FCM fan-out — native devices
  const { data: devices } = await admin
    .from('push_devices')
    .select('fcm_token, user_id')
    .in('user_id', targetIds)
  if (devices && devices.length > 0) {
    const fcmGroups = new Map<Lang, string[]>()
    for (const d of devices as { fcm_token: string; user_id: string }[]) {
      const lang = langByUser.get(d.user_id) ?? 'en'
      const arr = fcmGroups.get(lang) ?? []
      arr.push(d.fcm_token)
      fcmGroups.set(lang, arr)
    }
    for (const [lang, tokens] of fcmGroups) {
      await sendFcmToMany(
        tokens,
        { title: NOTIF_TEXT.new_event.title![lang], body: eventTitle, type: 'new_event', eventId },
        admin,
      )
    }
  }

  return new Response(JSON.stringify({ sent: subs.length }), { status: 200 })
})
