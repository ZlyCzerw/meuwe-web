import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'
import { sendFcmToMany } from '../_shared/fcm.ts'
import { NOTIF_TEXT, interestBody, groupSubsByLang, type Lang } from '../_shared/notif-i18n.ts'
import { shouldNotifyInterest } from '../_shared/interest.ts'
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
    record = body.record ?? body
  } catch (e) {
    console.error('[push-event-interest] bad json:', e)
    return new Response('Bad Request', { status: 400 })
  }

  const eventId = record.event_id as string
  const followerId = record.user_id as string
  if (!eventId || !followerId) return new Response('Bad Request', { status: 400 })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: event, error: evErr } = await admin
    .from('events')
    .select('id, title, creator_id, interest_notified_count')
    .eq('id', eventId)
    .single()
  if (evErr || !event) {
    console.error('[push-event-interest] event lookup failed:', evErr)
    return new Response(JSON.stringify({ error: 'event lookup failed' }), { status: 500 })
  }

  // createEvent zapisuje twórcę jako obserwującego własnego wydarzenia i inne
  // funkcje na tym polegają. Nie liczy się jednak do chętnych — bez tego każdy
  // organizator dostałby "1 osoba chce wziąć udział" o sobie samym, sekundę po
  // utworzeniu wydarzenia.
  if (followerId === event.creator_id) {
    return new Response(JSON.stringify({ sent: 0, reason: 'creator follows own event' }), { status: 200 })
  }

  const { count, error: cntErr } = await admin
    .from('event_follows')
    .select('user_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .neq('user_id', event.creator_id)
  if (cntErr || count === null) {
    console.error('[push-event-interest] follower count failed:', cntErr)
    return new Response(JSON.stringify({ error: 'count failed' }), { status: 500 })
  }

  if (!shouldNotifyInterest(event.interest_notified_count ?? 0, count)) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no milestone', count }), { status: 200 })
  }

  // Ta sama bramka co reszta powiadomień: push_enabled i wyciszenia wydarzenia.
  const { ids: targetIds, langByUser } = await filterDeliverable(admin, [event.creator_id], { eventId })
  if (targetIds.length === 0) {
    // Twórca wyciszył albo nie chce powiadomień — próg i tak uznajemy za
    // obsłużony, żeby kolejne dołączenie nie próbowało go ponownie.
    await admin.from('events')
      .update({ interest_notified_count: count })
      .eq('id', eventId).lt('interest_notified_count', count)
    return new Response(JSON.stringify({ sent: 0, reason: 'creator not deliverable' }), { status: 200 })
  }

  const lang: Lang = langByUser.get(event.creator_id) ?? 'en'
  const payload = {
    title: NOTIF_TEXT.interest.title![lang],
    body: interestBody(count, lang),
    type: 'interest' as const,
    eventId,
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key, user_id')
    .in('user_id', targetIds)
  if (subs && subs.length > 0) {
    for (const [, langSubs] of groupSubsByLang(subs, langByUser)) {
      await sendToMany(langSubs, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, admin)
    }
  }

  const { data: devices } = await admin
    .from('push_devices')
    .select('fcm_token, user_id')
    .in('user_id', targetIds)
  if (devices && devices.length > 0) {
    await sendFcmToMany(
      (devices as { fcm_token: string }[]).map(d => d.fcm_token),
      payload,
      admin,
    )
  }

  // Warunkowo: przy dwóch równoczesnych dołączeniach tylko jedno podniesie próg.
  await admin.from('events')
    .update({ interest_notified_count: count })
    .eq('id', eventId).lt('interest_notified_count', count)

  return new Response(JSON.stringify({ sent: (subs ?? []).length, count }), { status: 200 })
})
