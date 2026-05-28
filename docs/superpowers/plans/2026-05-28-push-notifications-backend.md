# Push Notifications Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the push notification pipeline — store consent in DB, persist toggle state across sessions, and notify all event commenters (not just the creator) on new messages.

**Architecture:** Four independent changes: a SQL migration adds `push_enabled` to profiles; the `Profile` TS type gains the field; `ProfilePanel` uses `profile.push_enabled` as the source of truth for the toggle; and `push-new-message` Edge Function is rewritten to collect creator + commenters as recipients. The three Edge Functions already exist and are functionally correct for new-event and event-start scenarios — only push-new-message needs logic changes.

**Tech Stack:** React 18, TypeScript, Supabase JS client, Deno Edge Functions, Vitest.

**Note:** `start_notified_at` on `events` is already in `supabase/migrations/20260527_push_notifications.sql` — no new migration needed for it.

---

## File Map

| Action | Path | Change |
|---|---|---|
| Create | `supabase/migrations/20260528_push_enabled.sql` | Add `push_enabled` column to `profiles` |
| Modify | `src/lib/types.ts` | Add `push_enabled: boolean \| null` to Profile |
| Modify | `src/screens/ProfilePanel.tsx` | Initialize toggle from `profile.push_enabled`, save to DB on toggle |
| Modify | `supabase/functions/push-new-message/index.ts` | Notify creator + commenters, check mutes for all |

---

## Task 1: Migration — `profiles.push_enabled`

**Files:**
- Create: `supabase/migrations/20260528_push_enabled.sql`

- [ ] **Step 1a: Create migration file**

Create `supabase/migrations/20260528_push_enabled.sql` with this content:

```sql
-- Add push_enabled to profiles
-- Stores explicit push consent in DB, independent of browser PushManager state.
-- true  = user opted in (has or wants a push subscription)
-- false = user opted out
-- null  = not yet set (treated as false)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false;
```

- [ ] **Step 1b: Run migration in Supabase Dashboard**

Open Supabase Dashboard → SQL Editor. Paste and run:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false;
```

Expected: command completes with no error. Verify:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'push_enabled';
```
Expected: one row, `data_type = boolean`, `column_default = false`.

- [ ] **Step 1c: Commit**

```bash
git add supabase/migrations/20260528_push_enabled.sql
git commit -m "migration: add push_enabled to profiles"
```

---

## Task 2: TypeScript type — `Profile.push_enabled`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 2a: Add field to Profile interface**

In `src/lib/types.ts`, find the `Profile` interface:

```ts
export interface Profile {
  id: string
  display_name: string | null
  avatar_color: string | null
  radius_km: number | null
  interests: string[] | null
  last_lat: number | null
  last_lng: number | null
  last_seen_at: string | null
  created_at: string
}
```

Replace with:

```ts
export interface Profile {
  id: string
  display_name: string | null
  avatar_color: string | null
  radius_km: number | null
  interests: string[] | null
  last_lat: number | null
  last_lng: number | null
  last_seen_at: string | null
  created_at: string
  push_enabled: boolean | null
}
```

- [ ] **Step 2b: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2c: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2d: Commit**

```bash
git add src/lib/types.ts
git commit -m "types: add push_enabled to Profile"
```

---

## Task 3: ProfilePanel — persist push consent to DB

**Files:**
- Modify: `src/screens/ProfilePanel.tsx`

The goal: the push toggle is driven by `profile.push_enabled` (DB), not the browser PushManager. `getPushStatus()` is still called to detect `'denied'` and `'unsupported'`.

- [ ] **Step 3a: Update `handleTogglePush`**

Find `handleTogglePush` (lines ~50–61):

```ts
  async function handleTogglePush() {
    if (!session) return
    setPushLoading(true)
    if (pushStatus === 'subscribed') {
      await unsubscribePush()
      setPushStatus('unsubscribed')
    } else {
      const status = await subscribePush(session.user.id)
      setPushStatus(status)
    }
    setPushLoading(false)
  }
```

Replace with:

```ts
  async function handleTogglePush() {
    if (!session) return
    setPushLoading(true)
    const isEnabled = profile?.push_enabled ?? false
    if (isEnabled) {
      await unsubscribePush()
      await db.upsertProfile({ id: session.user.id, push_enabled: false })
      reloadProfile()
    } else {
      const status = await subscribePush(session.user.id)
      setPushStatus(status)
      if (status === 'subscribed') {
        await db.upsertProfile({ id: session.user.id, push_enabled: true })
        reloadProfile()
      }
    }
    setPushLoading(false)
  }
```

- [ ] **Step 3b: Update toggle display to use `profile.push_enabled`**

Find the push toggle button section (~lines 396–451). Currently uses `pushStatus === 'subscribed'` to decide ON/OFF state of the toggle button (background, icon, text, knob position). Replace every `pushStatus === 'subscribed'` check **inside the toggle button** (not the `pushStatus === 'denied'` / `pushStatus === 'unsupported'` guards above it) with `!!(profile?.push_enabled)`.

Specifically, find these 5 occurrences inside the `<button>` element and replace:

1. `background: pushStatus === 'subscribed' ? C.primarySoft : C.cream,`
   → `background: !!(profile?.push_enabled) ? C.primarySoft : C.cream,`

2. `border: \`2px solid ${pushStatus === 'subscribed' ? C.primary : INK + '22'}\`,`
   → `border: \`2px solid ${!!(profile?.push_enabled) ? C.primary : INK + '22'}\`,`

3. `{pushStatus === 'subscribed' ? '🔔' : '🔕'}`
   → `{!!(profile?.push_enabled) ? '🔔' : '🔕'}`

4. `{pushStatus === 'subscribed' ? t('profile.notificationsOn') : t('profile.notificationsOff')}`
   → `{!!(profile?.push_enabled) ? t('profile.notificationsOn') : t('profile.notificationsOff')}`

5. `background: pushStatus === 'subscribed' ? C.primary : '#E0D8CF',`
   → `background: !!(profile?.push_enabled) ? C.primary : '#E0D8CF',`

6. `border: \`2px solid ${pushStatus === 'subscribed' ? INK : 'transparent'}\`,`
   → `border: \`2px solid ${!!(profile?.push_enabled) ? INK : 'transparent'}\`,`

7. `left: pushStatus === 'subscribed' ? 22 : 2,`
   → `left: !!(profile?.push_enabled) ? 22 : 2,`

8. `background: pushStatus === 'subscribed' ? '#fff' : C.inkSoft,`
   → `background: !!(profile?.push_enabled) ? '#fff' : C.inkSoft,`

The `pushStatus === 'unsupported'` and `pushStatus === 'denied'` guards at lines ~385–395 remain unchanged — they still guard the outer conditional.

- [ ] **Step 3c: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3d: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3e: Commit**

```bash
git add src/screens/ProfilePanel.tsx
git commit -m "feat: persist push consent to DB, initialize toggle from profile.push_enabled"
```

---

## Task 4: Fix `push-new-message` — notify commenters

**Files:**
- Modify: `supabase/functions/push-new-message/index.ts`

Currently only notifies `creator_id`. New logic: notify creator + all previous commenters, minus the new message author, minus anyone who muted the event.

- [ ] **Step 4a: Replace the recipient logic**

The current file fetches the event, checks if `authorId === creatorId`, queries mutes for just the creator, then fetches subs for just the creator.

Replace the entire file content with:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'

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

  // 1. Get event
  const { data: event, error: evErr } = await admin
    .from('events').select('id, title, creator_id').eq('id', eventId).single()
  if (evErr || !event) {
    console.error('[push-new-message] event not found:', evErr)
    return new Response(JSON.stringify({ sent: 0, reason: 'event not found' }), { status: 200 })
  }
  const creatorId = event.creator_id as string | null

  // 2. Get all previous commenters for this event
  const { data: commentRows } = await admin
    .from('messages')
    .select('author_id')
    .eq('event_id', eventId)
    .not('author_id', 'is', null)

  const commenterIds: string[] = [
    ...new Set(
      (commentRows ?? []).map((r: { author_id: string }) => r.author_id)
    ),
  ]

  // 3. Build recipient set: creator + commenters − new message author
  const recipientSet = new Set<string>()
  if (creatorId) recipientSet.add(creatorId)
  for (const id of commenterIds) recipientSet.add(id)
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

  // 5. Fetch push subscriptions
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .in('user_id', finalRecipients)

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
```

- [ ] **Step 4b: Run tests**

```bash
npm test
```

Expected: all tests pass (Edge Functions are not covered by Vitest — this just confirms no TS regressions in the frontend).

- [ ] **Step 4c: Commit**

```bash
git add supabase/functions/push-new-message/index.ts
git commit -m "fix: push-new-message notifies creator + all commenters, checks mutes for all"
```

---

## Task 5: Deployment checklist (manual steps)

This task contains no code changes — it is a checklist of manual steps to perform in the Supabase Dashboard and CLI after the code tasks above are committed.

**Files:** none (documentation only — these steps are performed outside the repo)

- [ ] **Step 5a: Set Supabase secrets**

In Supabase Dashboard → Settings → Edge Functions → Secrets, add:

| Secret name | Value |
|---|---|
| `VAPID_PRIVATE_KEY` | Your VAPID private key (base64url, pairs with `VITE_VAPID_PUBLIC_KEY` in `.env`) |
| `VAPID_SUBJECT` | `mailto:wiktor.marc@gmail.com` |
| `CRON_SECRET` | Random string — generate with: `openssl rand -hex 32` |

Also ensure these are set (should already exist):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 5b: Deploy Edge Functions**

In the project root, with Supabase CLI logged in:

```bash
supabase functions deploy push-new-event
supabase functions deploy push-new-message
supabase functions deploy push-event-start
```

Expected: each deploy prints `Deployed Function push-* ...` with no errors.

- [ ] **Step 5c: Configure Database Webhooks**

In Supabase Dashboard → Database → Webhooks → Create a new webhook:

**Webhook 1 — new event:**
- Name: `on_event_insert_push`
- Table: `events`
- Events: `INSERT`
- Type: HTTP Request
- URL: `https://<your-project-ref>.supabase.co/functions/v1/push-new-event`
- HTTP Headers: `Authorization: Bearer <SUPABASE_ANON_KEY>`

**Webhook 2 — new message:**
- Name: `on_message_insert_push`
- Table: `messages`
- Events: `INSERT`
- Type: HTTP Request
- URL: `https://<your-project-ref>.supabase.co/functions/v1/push-new-message`
- HTTP Headers: `Authorization: Bearer <SUPABASE_ANON_KEY>`

- [ ] **Step 5d: Configure pg_cron for event-start notifications**

In Supabase Dashboard → SQL Editor, run (replace `<project-ref>` and `<CRON_SECRET>`):

```sql
SELECT cron.schedule(
  'push-event-start',
  '*/5 * * * *',
  $$SELECT net.http_post(
      url        := 'https://<project-ref>.supabase.co/functions/v1/push-event-start',
      headers    := '{"x-cron-secret":"<CRON_SECRET>","Content-Type":"application/json"}'::jsonb,
      body       := '{}'::jsonb
    ) AS request_id$$
);
```

Verify the job was created:
```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'push-event-start';
```

Expected: 1 row with `schedule = */5 * * * *`.

- [ ] **Step 5e: End-to-end smoke test**

1. Open the app, go to Profile panel, enable notifications → confirm toggle turns ON
2. Close the app entirely
3. Create a test event from another account within your radius with a tag matching your interests
4. Within ~30s, a push notification should appear on the device
5. Check Supabase Dashboard → Edge Functions → push-new-event → Logs to confirm the function was called and returned `{ sent: N }`
