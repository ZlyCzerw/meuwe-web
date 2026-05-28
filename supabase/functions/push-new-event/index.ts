import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''

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

  // Pobierz tagi eventu
  const { data: tagRows, error: tagErr } = await admin
    .from('event_tags').select('tag').eq('event_id', eventId)
  if (tagErr) console.error('[push-new-event] tag query error:', tagErr)
  const tags: string[] = (tagRows ?? []).map((r: { tag: string }) => r.tag)
  console.log(`[push-new-event] tags: [${tags.join(', ')}]`)

  // Znajdź aktywnych userów z subskrypcjami push
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, interests, radius_km, last_lat, last_lng')
    .not('last_lat', 'is', null)
    .not('last_lng', 'is', null)
    .gte('last_seen_at', new Date(Date.now() - 30 * 86400_000).toISOString())

  if (profErr) console.error('[push-new-event] profiles error:', profErr)
  console.log(`[push-new-event] active profiles with location: ${(profiles ?? []).length}`)

  type Profile = { id: string; interests: string[] | null; radius_km: number | null; last_lat: number; last_lng: number }

  const targetIds = (profiles ?? [] as Profile[]).filter((p: Profile) => {
    if (p.id === creatorId) return false // nie powiadamiaj twórcy
    // Jeśli event bez tagów — powiadamiaj wszystkich w okolicy
    if (tags.length > 0) {
      const interests = p.interests ?? []
      if (!interests.some((i: string) => tags.includes(i))) return false
    }
    const radius = Math.min(p.radius_km ?? 10, MAX_RADIUS_KM)
    const dist = haversineKm(p.last_lat, p.last_lng, eventLat, eventLng)
    return dist <= radius
  }).map((p: Profile) => p.id)

  console.log(`[push-new-event] target users: ${targetIds.length}`)

  if (targetIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no matching users' }), { status: 200 })
  }

  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .in('user_id', targetIds)

  if (subErr) console.error('[push-new-event] subs error:', subErr)
  console.log(`[push-new-event] push subscriptions found: ${(subs ?? []).length}`)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no push subs' }), { status: 200 })
  }

  await sendToMany(
    subs,
    { title: 'Nowe wydarzenie w pobliżu 📍', body: eventTitle, type: 'new_event', eventId },
    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
    admin
  )

  return new Response(JSON.stringify({ sent: subs.length }), { status: 200 })
})
