import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'

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
    console.log('[push-new-message] received:', JSON.stringify(body).slice(0, 200))
    record = body.record ?? body
  } catch (e) {
    console.error('[push-new-message] bad json:', e)
    return new Response('Bad Request', { status: 400 })
  }

  const eventId    = record.event_id as string
  const authorId   = record.author_id as string | null
  const rawName = (record.author_name as string | null) ?? 'Ktoś'
  const authorName = rawName.slice(0, 50)
  const text       = record.text as string

  console.log(`[push-new-message] event=${eventId} author=${authorId}`)

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push-new-message] VAPID keys not set!')
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Get event title
  const { data: event, error: evErr } = await admin
    .from('events').select('id, title').eq('id', eventId).single()
  if (evErr || !event) {
    console.error('[push-new-message] event not found:', evErr)
    return new Response(JSON.stringify({ sent: 0, reason: 'event not found' }), { status: 200 })
  }

  // 2. Get all followers — event_follows is the single source of truth for notifications
  const { data: followRows } = await admin
    .from('event_follows')
    .select('user_id')
    .eq('event_id', eventId)

  const followerIds: string[] = (followRows ?? []).map((r: { user_id: string }) => r.user_id)

  // 3. Recipient set: followers − message author
  const recipientSet = new Set<string>(followerIds)
  if (authorId) recipientSet.delete(authorId)

  if (recipientSet.size === 0) {
    console.log('[push-new-message] no recipients')
    return new Response(JSON.stringify({ sent: 0, reason: 'no recipients' }), { status: 200 })
  }

  const recipientList = [...recipientSet]
  console.log(`[push-new-message] candidates: ${recipientList.length}`)

  // 4. Remove muted users
  const { data: mutes } = await admin
    .from('notification_mutes')
    .select('user_id')
    .eq('event_id', eventId)
    .in('user_id', recipientList)

  const mutedIds = new Set(
    (mutes ?? []).map((m: { user_id: string }) => m.user_id)
  )
  const finalRecipients = recipientList.filter(id => !mutedIds.has(id))

  if (finalRecipients.length === 0) {
    console.log('[push-new-message] all muted')
    return new Response(JSON.stringify({ sent: 0, reason: 'all muted' }), { status: 200 })
  }

  // 5a. Filter to users with push_enabled = true
  const { data: enabledProfiles } = await admin
    .from('profiles')
    .select('id')
    .in('id', finalRecipients)
    .eq('push_enabled', true)

  const enabledRecipients = (enabledProfiles ?? []).map((p: { id: string }) => p.id)
  console.log(`[push-new-message] push-enabled recipients: ${enabledRecipients.length}`)

  if (enabledRecipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'push not enabled' }), { status: 200 })
  }

  // 5b. Fetch push subscriptions
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .in('user_id', enabledRecipients)

  if (subErr) console.error('[push-new-message] subs error:', subErr)
  console.log(`[push-new-message] subscriptions: ${(subs ?? []).length}`)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no push subs' }), { status: 200 })
  }

  // 6. Send
  const preview = text.length > 80 ? text.slice(0, 77) + '…' : text

  await sendToMany(
    subs,
    { title: `💬 ${event.title}`, body: `${authorName}: ${preview}`, type: 'message', eventId: event.id },
    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
    admin
  )

  return new Response(JSON.stringify({ sent: subs.length }), { status: 200 })
})
