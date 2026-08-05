import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'
import { sendFcmToMany } from '../_shared/fcm.ts'
import { pickLang } from '../_shared/notif-i18n.ts'
import {
  timezoneFor, localClock, isDigestSlot, digestFor, spanKm,
  digestTitle, digestBody, digestUrl, DIGEST_MIN_GAP_MS,
  type DigestCandidate,
} from '../_shared/digest.ts'

// Weekly digest: Friday 17:00 in the user's own zone, "there are X events
// around you". The cron calls this every hour on the hour; each call selects
// only the users whose wall clock says Friday 17 right now, so Warsaw and the
// Canaries each get theirs at their own 17:00 and a clock change never shifts
// the send hour. last_digest_at (min 6 days ago) keeps one firing from ever
// doubling with the next.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

/** Users whose sends run concurrently; last_digest_at is stamped per batch. */
const BATCH_SIZE = 20

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push-weekly-digest] VAPID keys not set!')
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const now = new Date()

  // Everyone who could receive a digest at all; whether it is their hour is
  // decided below, per zone. push_enabled and the 6-day gap are gates, the
  // rest is payload reduction — same shape as the other push functions.
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, radius_km, last_lat, last_lng, language, last_digest_at')
    .eq('push_enabled', true)
    .not('last_lat', 'is', null)
    .not('last_lng', 'is', null)
    .gte('last_seen_at', new Date(now.getTime() - 30 * 86400_000).toISOString())
    .or(`last_digest_at.is.null,last_digest_at.lt.${new Date(now.getTime() - DIGEST_MIN_GAP_MS).toISOString()}`)

  if (profErr) {
    console.error('[push-weekly-digest] profiles query error:', profErr)
    return new Response(JSON.stringify({ error: 'profiles query failed' }), { status: 500 })
  }

  type Row = DigestCandidate & { last_digest_at: string | null }
  const due = ((profiles ?? []) as Row[])
    .map((p) => ({ ...p, tz: timezoneFor(p.last_lat, p.last_lng) }))
    .map((p) => ({ ...p, clock: localClock(now, p.tz) }))
    .filter((p) => isDigestSlot(p.clock))

  console.log(`[push-weekly-digest] candidates: ${(profiles ?? []).length}, in their Friday-17 slot: ${due.length}`)
  if (due.length === 0) {
    return new Response(JSON.stringify({ due: 0, sent: 0 }), { status: 200 })
  }

  // One events query for the whole run. The latest local midnight among the due
  // users bounds start_time; the per-user day end is applied in digestFor.
  const maxDayEnd = new Date(Math.max(...due.map((p) => p.clock.dayEndUtc.getTime())))
  const { data: events, error: evErr } = await admin
    .from('events')
    .select('lat, lng, start_time, end_time')
    // Service role bypasses RLS, so private events must be excluded here — the
    // map hides them from strangers and the count must match the map.
    .eq('is_private', false)
    .in('status', ['live', 'upcoming', 'extended'])
    .lte('start_time', maxDayEnd.toISOString())
    .gte('end_time', now.toISOString())

  if (evErr) {
    console.error('[push-weekly-digest] events query error:', evErr)
    return new Response(JSON.stringify({ error: 'events query failed' }), { status: 500 })
  }

  const evaluated = due.map((p) => ({
    ...p,
    digest: digestFor(p, events ?? [], { now, dayEndUtc: p.clock.dayEndUtc }),
  }))
  const withDigest = evaluated.filter((p) => p.digest !== null)
  // An empty digest still spends the week's slot: the decision was made, the
  // answer was "nothing nearby", and re-asking every hour until midnight would
  // turn an event created at 18:30 into a 19:00 digest — that is
  // push-new-event's job, not this one's.
  const quietIds = evaluated.filter((p) => p.digest === null).map((p) => p.id)

  console.log(`[push-weekly-digest] with something to say: ${withDigest.length} of ${due.length}`)

  // Delivery addresses for everyone with something to hear, fetched once.
  const targetIds = withDigest.map((p) => p.id)
  const [{ data: subs }, { data: devices }] = await Promise.all([
    admin.from('push_subscriptions').select('id, endpoint, p256dh, auth_key, user_id').in('user_id', targetIds),
    admin.from('push_devices').select('fcm_token, user_id').in('user_id', targetIds),
  ])
  const subsByUser = new Map<string, NonNullable<typeof subs>>()
  for (const s of subs ?? []) {
    const arr = subsByUser.get(s.user_id) ?? []
    arr.push(s)
    subsByUser.set(s.user_id, arr)
  }
  const tokensByUser = new Map<string, string[]>()
  for (const d of (devices ?? []) as { fcm_token: string; user_id: string }[]) {
    const arr = tokensByUser.get(d.user_id) ?? []
    arr.push(d.fcm_token)
    tokensByUser.set(d.user_id, arr)
  }

  let sent = 0
  // Batched, and stamped per batch: a timeout partway through must not let the
  // next hourly run resend to the users this one already reached.
  for (let i = 0; i < withDigest.length; i += BATCH_SIZE) {
    const batch = withDigest.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(batch.map(async (p) => {
      const digest = p.digest!
      const lang = pickLang(p.language)
      const km = spanKm(digest.nearestKm)
      const payload = {
        title: digestTitle(lang, now, p.tz),
        body: digestBody(lang, digest.count),
        type: 'digest' as const,
        lat: p.last_lat,
        lng: p.last_lng,
        km,
        url: digestUrl(p.last_lat, p.last_lng, km),
      }
      const userSubs = subsByUser.get(p.id) ?? []
      if (userSubs.length > 0) {
        await sendToMany(userSubs, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, admin)
        sent += userSubs.length
      }
      const tokens = tokensByUser.get(p.id) ?? []
      if (tokens.length > 0) {
        sent += await sendFcmToMany(tokens, { ...payload, collapseTag: 'digest' }, admin)
      }
    }))
    const batchIds = batch.map((p) => p.id)
    await admin.from('profiles').update({ last_digest_at: now.toISOString() }).in('id', batchIds)
  }

  // The quiet ones spent their slot too — see above.
  if (quietIds.length > 0) {
    await admin.from('profiles').update({ last_digest_at: now.toISOString() }).in('id', quietIds)
  }

  console.log(`[push-weekly-digest] done: ${withDigest.length} digests, ${sent} deliveries, ${quietIds.length} quiet`)
  return new Response(JSON.stringify({ due: due.length, digests: withDigest.length, sent }), { status: 200 })
})
