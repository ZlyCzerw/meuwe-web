import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const WINDOW_MINUTES = 5
const MAX_RADIUS_KM = 50

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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
    .select('id, title, lat, lng')
    .gte('start_time', now.toISOString())
    .lte('start_time', windowEnd.toISOString())
    .is('start_notified_at', null)

  if (evErr) console.error('[push-event-start] events query error:', evErr)
  console.log(`[push-event-start] events starting soon: ${(events ?? []).length}`)

  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  type Profile = { id: string; interests: string[] | null; radius_km: number | null; last_lat: number; last_lng: number }

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, interests, radius_km, last_lat, last_lng')
    .not('last_lat', 'is', null)
    .not('last_lng', 'is', null)
    .gte('last_seen_at', new Date(Date.now() - 30 * 86400_000).toISOString())

  let totalSent = 0

  for (const event of events) {
    const { data: tagRows } = await admin
      .from('event_tags').select('tag').eq('event_id', event.id)
    const tags: string[] = (tagRows ?? []).map((r: { tag: string }) => r.tag)

    const targetIds = (profiles ?? [] as Profile[]).filter((p: Profile) => {
      if (tags.length > 0) {
        const interests = p.interests ?? []
        if (!interests.some((i: string) => tags.includes(i))) return false
      }
      const radius = Math.min(p.radius_km ?? 10, MAX_RADIUS_KM)
      return haversineKm(p.last_lat, p.last_lng, event.lat, event.lng) <= radius
    }).map((p: Profile) => p.id)

    if (targetIds.length > 0) {
      const { data: subs } = await admin
        .from('push_subscriptions').select('id, endpoint, p256dh, auth_key').in('user_id', targetIds)
      if (subs && subs.length > 0) {
        await sendToMany(
          subs,
          { title: 'Wydarzenie zaraz się zaczyna! 🎉', body: event.title, type: 'event_start', eventId: event.id },
          VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
          admin
        )
        totalSent += subs.length
      }
    }

    await admin.from('events').update({ start_notified_at: now.toISOString() }).eq('id', event.id)
    console.log(`[push-event-start] event ${event.id} processed, targetIds: ${targetIds.length}`)
  }

  return new Response(JSON.stringify({ processed: events.length, sent: totalSent }), { status: 200 })
})
