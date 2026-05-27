import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendPushNotification } from '../_shared/webpush.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let record: Record<string, unknown>
  try {
    const body = await req.json()
    console.log('[push-new-message] received:', JSON.stringify(body).slice(0, 200))
    record = body.record ?? body
  } catch (e) {
    console.error('[push-new-message] bad json:', e)
    return new Response('Bad Request', { status: 400 })
  }

  const eventId    = record.event_id as string
  const authorId   = record.author_id as string | null
  const authorName = (record.author_name as string | null) ?? 'Ktoś'
  const text       = record.text as string

  console.log(`[push-new-message] event=${eventId} author=${authorId}`)

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push-new-message] VAPID keys not set!')
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: event, error: evErr } = await admin
    .from('events').select('id, title, creator_id').eq('id', eventId).single()
  if (evErr || !event) {
    console.error('[push-new-message] event not found:', evErr)
    return new Response(JSON.stringify({ sent: 0, reason: 'event not found' }), { status: 200 })
  }

  const creatorId = event.creator_id as string | null
  if (!creatorId || authorId === creatorId) {
    console.log('[push-new-message] skipping (author is creator or no creator)')
    return new Response(JSON.stringify({ sent: 0, reason: 'author is creator' }), { status: 200 })
  }

  // Sprawdź mute
  const { data: mute } = await admin
    .from('notification_mutes')
    .select('user_id')
    .match({ user_id: creatorId, event_id: eventId })
    .maybeSingle()

  if (mute) {
    console.log('[push-new-message] muted')
    return new Response(JSON.stringify({ sent: 0, reason: 'muted' }), { status: 200 })
  }

  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions').select('id, endpoint, p256dh, auth_key').eq('user_id', creatorId)
  if (subErr) console.error('[push-new-message] subs error:', subErr)
  console.log(`[push-new-message] subs for creator: ${(subs ?? []).length}`)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no push subs' }), { status: 200 })
  }

  const preview = text.length > 80 ? text.slice(0, 77) + '…' : text

  await Promise.allSettled(
    subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth_key: string }) => {
      const ok = await sendPushNotification(
        sub,
        { title: `💬 ${event.title}`, body: `${authorName}: ${preview}`, type: 'message', eventId },
        VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
      )
      if (!ok) await admin.from('push_subscriptions').delete().eq('id', sub.id)
    })
  )

  return new Response(JSON.stringify({ sent: subs.length }), { status: 200 })
})
