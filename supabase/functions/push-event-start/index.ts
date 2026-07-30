import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'
import { sendFcmToMany } from '../_shared/fcm.ts'
import { pickLang, NOTIF_TEXT, groupSubsByLang, type Lang } from '../_shared/notif-i18n.ts'
import { selectEventAudience, type AudienceProfile } from '../_shared/audience.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const WINDOW_MINUTES = 5

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push-event-start] VAPID keys not set!')
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const now = new Date()
  const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60_000)

  console.log(`[push-event-start] checking window ${now.toISOString()} → ${windowEnd.toISOString()}`)

  const { data: events, error: evErr } = await admin
    .from('events')
    .select('id, title, lat, lng, is_private, creator_id')
    .gte('start_time', now.toISOString())
    .lte('start_time', windowEnd.toISOString())
    .is('start_notified_at', null)

  if (evErr) console.error('[push-event-start] events query error:', evErr)
  console.log(`[push-event-start] events starting soon: ${(events ?? []).length}`)

  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  type Profile = AudienceProfile & { language: string | null }

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, interests, radius_km, last_lat, last_lng, language')
    .not('last_lat', 'is', null)
    .not('last_lng', 'is', null)
    .gte('last_seen_at', new Date(Date.now() - 30 * 86400_000).toISOString())

  const langByUser = new Map<string, Lang>(
    (profiles ?? []).map((p: Profile) => [p.id, pickLang(p.language)])
  )

  let totalSent = 0

  for (const event of events) {
    // Wydarzenie prywatne nie ma zasięgu geograficznego — liczą się wyłącznie
    // obserwujący i twórca (który obserwuje własne wydarzenie). Tagi nie
    // rozszerzają tego kręgu.
    let tags: string[] = []
    let followerIds: string[] = []
    if (event.is_private) {
      const { data: followRows, error: followErr } = await admin
        .from('event_follows').select('user_id').eq('event_id', event.id)
      if (followErr) {
        // Nie oznaczamy jako powiadomionego — cron spróbuje ponownie.
        console.error(`[push-event-start] event ${event.id}: błąd pobrania obserwujących, pomijam:`, followErr)
        continue
      }
      followerIds = (followRows ?? []).map((r: { user_id: string }) => r.user_id)
    } else {
      const { data: tagRows } = await admin
        .from('event_tags').select('tag').eq('event_id', event.id)
      tags = (tagRows ?? []).map((r: { tag: string }) => r.tag)
    }

    const targetIds = selectEventAudience({
      isPrivate: event.is_private,
      tags,
      profiles: (profiles ?? []) as Profile[],
      lat: event.lat,
      lng: event.lng,
      creatorId: event.creator_id,
      followerIds,
    })

    // Obserwujący bez świeżej lokalizacji nie ma go w `profiles` — dociągamy
    // jego język, żeby nie dostał powiadomienia po angielsku.
    const missingLang = targetIds.filter((id) => !langByUser.has(id))
    if (missingLang.length > 0) {
      const { data: extra } = await admin
        .from('profiles').select('id, language').in('id', missingLang)
      for (const p of (extra ?? []) as { id: string; language: string | null }[]) {
        langByUser.set(p.id, pickLang(p.language))
      }
    }

    if (targetIds.length > 0) {
      const { data: subs } = await admin
        .from('push_subscriptions').select('id, endpoint, p256dh, auth_key, user_id').in('user_id', targetIds)
      if (subs && subs.length > 0) {
        const groups = groupSubsByLang(subs, langByUser)
        for (const [lang, langSubs] of groups) {
          await sendToMany(
            langSubs,
            { title: NOTIF_TEXT.event_start.title![lang], body: event.title, type: 'event_start', eventId: event.id },
            VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
            admin
          )
        }
        totalSent += subs.length
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
            { title: NOTIF_TEXT.event_start.title![lang], body: event.title, type: 'event_start', eventId: event.id },
            admin,
          )
        }
      }
    }

    await admin.from('events').update({ start_notified_at: now.toISOString() }).eq('id', event.id)
    console.log(`[push-event-start] event ${event.id} processed, targetIds: ${targetIds.length}`)
  }

  return new Response(JSON.stringify({ processed: events.length, sent: totalSent }), { status: 200 })
})
