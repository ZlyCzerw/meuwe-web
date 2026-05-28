# Push Notifications Backend — Design Spec

**Date:** 2026-05-28
**Status:** Approved

## Overview

Complete the push notification pipeline so consent and range are stored in the database and notifications are sent even when the app is closed. Three Edge Functions already exist with correct logic — what's missing is: DB columns, frontend persistence, a commenters fix in push-new-message, and deployment.

---

## What Already Exists

| Component | Status | Notes |
|---|---|---|
| `supabase/functions/push-new-event/index.ts` | ✅ Complete | Filters by interests + radius, sends on event INSERT |
| `supabase/functions/push-event-start/index.ts` | ✅ Complete | Cron: events starting in next 5 min, uses `start_notified_at` |
| `supabase/functions/push-new-message/index.ts` | ⚠️ Partial | Only notifies creator — missing commenters |
| `supabase/functions/_shared/webpush.ts` | ✅ Complete | Native VAPID/RFC 8291 implementation |
| `src/lib/push.ts` | ✅ Complete | subscribePush saves to push_subscriptions |
| `push_subscriptions` table | ✅ Exists | user_id, endpoint, p256dh, auth_key |
| `profiles.radius_km` | ✅ Exists | Used by Edge Functions for range filter |
| `profiles.interests` | ✅ Exists | Used by push-new-event for tag filter |

---

## Change 1: Database migrations

### a) `profiles.push_enabled`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false;
```

Stores explicit consent in DB. Independent of browser PushManager state — survives browser data clears, works across multiple devices. Edge Functions do not use this column (they use push_subscriptions presence as the signal); this column is for the frontend to persist and restore the toggle state.

### b) `events.start_notified_at`

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_notified_at timestamptz;
```

Used by `push-event-start` to mark an event as already notified (deduplication). The function already writes to this column — the column just doesn't exist yet.

---

## Change 2: Frontend — persist push consent

**File:** `src/lib/types.ts`

Add `push_enabled: boolean | null` to the `Profile` interface.

**File:** `src/screens/ProfilePanel.tsx`

**Current flow:** `pushStatus` initialised by reading browser PushManager on panel open → state lost between sessions.

**New flow:**
1. Toggle initial state derived from `profile.push_enabled` (boolean, loaded from DB with the rest of the profile) — no async, no flash
2. On subscribe success: `db.upsertProfile({ id, push_enabled: true })`
3. On unsubscribe: `db.upsertProfile({ id, push_enabled: false })`
4. `getPushStatus()` still called on open to detect `'denied'` and `'unsupported'` (OS-level states the DB can't know about)

**Toggle display logic:**
- `profile.push_enabled === true && pushStatus !== 'denied'` → show as ON
- Otherwise → show as OFF
- `pushStatus === 'unsupported'` → show unsupported message (unchanged)
- `pushStatus === 'denied'` → show denied message (unchanged)

---

## Change 3: Fix `push-new-message` — notify commenters

**File:** `supabase/functions/push-new-message/index.ts`

**Current:** Only notifies `creator_id`.

**New:** Notify creator + all previous commenters, minus:
- The author of the new message
- Anyone who muted the event (`notification_mutes`)
- Duplicates

**SQL logic:**
```sql
-- recipients = distinct author_id from messages WHERE event_id = X
--              UNION creator_id of the event
--              MINUS new message author_id
--              MINUS muted users for this event
```

**Implementation in Edge Function:**
1. Fetch event → get `creator_id`
2. Fetch distinct `author_id` from `messages` where `event_id = eventId`
3. Build `recipientIds = Set([creator_id, ...commenters]).delete(authorId)`
4. Fetch muted users for this event from `notification_mutes`
5. Remove muted users from `recipientIds`
6. Fetch push subscriptions for remaining `recipientIds`
7. Send push to each subscription

**Push payload:** unchanged — `{ title: '💬 ${event.title}', body: '${authorName}: ${preview}', type: 'message', eventId }`

---

## Change 4: Deployment (manual steps documented as checklist)

These steps cannot be automated from code — they require access to the Supabase Dashboard and CLI.

### Supabase secrets (Dashboard → Settings → Edge Functions → Secrets)
- `VAPID_PRIVATE_KEY` — private VAPID key (pair for the public key in `.env`)
- `VAPID_SUBJECT` — `mailto:wiktor.marc@gmail.com`
- `CRON_SECRET` — any random string (e.g., `openssl rand -hex 32`)

### Deploy functions (Supabase CLI)
```bash
supabase functions deploy push-new-event
supabase functions deploy push-new-message
supabase functions deploy push-event-start
```

### Webhooks (Dashboard → Database → Webhooks → Create new webhook)

**Webhook 1:**
- Name: `on_event_insert_push`
- Table: `events`, Event: `INSERT`
- HTTP POST → `https://<project-ref>.supabase.co/functions/v1/push-new-event`
- Header: `Authorization: Bearer <SUPABASE_ANON_KEY>`

**Webhook 2:**
- Name: `on_message_insert_push`
- Table: `messages`, Event: `INSERT`
- HTTP POST → `https://<project-ref>.supabase.co/functions/v1/push-new-message`
- Header: `Authorization: Bearer <SUPABASE_ANON_KEY>`

### pg_cron (Dashboard → SQL Editor)
```sql
SELECT cron.schedule(
  'push-event-start',
  '*/5 * * * *',
  $$SELECT net.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/push-event-start',
      headers:='{"x-cron-secret":"<CRON_SECRET>","Content-Type":"application/json"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id$$
);
```

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/20260528_push_enabled.sql` | New migration: `push_enabled` + `start_notified_at` |
| `src/lib/types.ts` | Add `push_enabled: boolean \| null` to Profile |
| `src/screens/ProfilePanel.tsx` | Persist consent to DB on toggle |
| `supabase/functions/push-new-message/index.ts` | Notify commenters, not just creator |

## What Is NOT Changing

- `push-new-event` — already correct, no changes
- `push-event-start` — already correct, no changes
- `_shared/webpush.ts` — no changes
- `src/lib/push.ts` — `subscribePush` / `unsubscribePush` unchanged
- `notification_mutes` logic — unchanged
- Capacitor/FCM — out of scope (future)
