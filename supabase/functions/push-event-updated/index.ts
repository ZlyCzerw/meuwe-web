import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'
import { sendFcmToMany } from '../_shared/fcm.ts'
import { pickLang, NOTIF_TEXT, groupSubsByLang, type Lang } from '../_shared/notif-i18n.ts'

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
    console.log('[push-event-updated] received:', JSON.stringify(body).slice(0, 200))
    record = body.record ?? body
  } catch (e) {
    console.error('[push-event-updated] bad json:', e)
    return new Response('Bad Request', { status: 400 })
  }

  const eventId    = record.id as string
  const eventTitle = record.title as string
  const status     = record.status as string
  const creatorId  = record.creator_id as string | null

  // `events` UPDATE fires from endEvent (status→ended) and updateEvent. Skip the
  // end-event path — that's not a content edit.
  if (status === 'ended') {
    return new Response(JSON.stringify({ sent: 0, reason: 'event ended' }), { status: 200 })
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push-event-updated] VAPID keys not set!')
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Followers — single source of truth for notifications.
  const { data: followRows } = await admin
    .from('event_follows').select('user_id').eq('event_id', eventId)
  const recipientSet = new Set<string>((followRows ?? []).map((r: { user_id: string }) => r.user_id))
  if (creatorId) recipientSet.delete(creatorId) // the editor doesn't need it

  if (recipientSet.size === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no recipients' }), { status: 200 })
  }
  const recipientList = [...recipientSet]

  // Drop muted users.
  const { data: mutes } = await admin
    .from('notification_mutes').select('user_id').eq('event_id', eventId).in('user_id', recipientList)
  const mutedIds = new Set((mutes ?? []).map((m: { user_id: string }) => m.user_id))
  const afterMute = recipientList.filter(id => !mutedIds.has(id))
  if (afterMute.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'all muted' }), { status: 200 })
  }

  // push_enabled users + their language.
  const { data: enabledProfiles } = await admin
    .from('profiles').select('id, language').in('id', afterMute).eq('push_enabled', true)
  const enabledRecipients = (enabledProfiles ?? []).map((p: { id: string }) => p.id)
  if (enabledRecipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'push not enabled' }), { status: 200 })
  }
  const langByUser = new Map<string, Lang>(
    (enabledProfiles ?? []).map((p: { id: string; language: string | null }) => [p.id, pickLang(p.language)])
  )

  const { data: subs } = await admin
    .from('push_subscriptions').select('id, endpoint, p256dh, auth_key, user_id').in('user_id', enabledRecipients)
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no push subs' }), { status: 200 })
  }

  const groups = groupSubsByLang(subs, langByUser)
  for (const [lang, langSubs] of groups) {
    await sendToMany(
      langSubs,
      { title: eventTitle, body: NOTIF_TEXT.update.body![lang], type: 'update', eventId },
      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
      admin
    )
  }

  // FCM fan-out — native devices
  const { data: devices } = await admin
    .from('push_devices')
    .select('fcm_token, user_id')
    .in('user_id', enabledRecipients)
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
        { title: eventTitle, body: NOTIF_TEXT.update.body![lang], type: 'update', eventId },
        admin,
      )
    }
  }

  return new Response(JSON.stringify({ sent: subs.length }), { status: 200 })
})
