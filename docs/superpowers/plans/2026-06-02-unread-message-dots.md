# Unread Message Dots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Sunshine (`#FFD54F`) in-app notification dot for unread chat messages (from others) in events the user follows or created — at three levels: menu avatar, profile-menu items, and event list items.

**Architecture:** A persistent per-user read marker (`event_reads`) + a `SECURITY DEFINER` RPC computes the initial unread set; a global Supabase realtime subscription to `event_messages` inserts updates it live via a pure reducer; an App-level hook (`useUnreadEvents`) owns the state and exposes flags consumed by the UI. `event_follows` is the single source of truth (creators auto-follow), matching the existing push logic. Mutes are ignored; the dot is independent of `push_enabled`.

**Tech Stack:** React 19, TypeScript (ESM), Supabase (Postgres + realtime), vitest, react-i18next.

**Conventions (this repo):**
- `src/` files use NO semicolons and single quotes (match `EventSheet.tsx` / `useEvents.ts`).
- Build check: `npx tsc -b` (covers `src/`). Single test: `npx vitest run <file>`.
- Colors from `src/lib/tokens.ts`: `C.sunshine = '#FFD54F'`, `INK = '#2D2B2A'`.
- All user-facing text via i18n (`t('...')`) in all 4 locales (`src/locales/{pl,en,es,de}.ts`).
- SQL migrations are run manually in Supabase Dashboard (not auto-applied); commit the `.sql` file.
- Commits: owner is sole author — do NOT add any `Co-Authored-By` trailer.

---

### Task 1: Database migration + RPC

Persistent read markers and the unread-computation RPC. Manual run in Supabase; this task only creates and commits the SQL file.

**Files:**
- Create: `supabase/migrations/20260602_event_reads.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260602_event_reads.sql`:
```sql
-- In-app unread-message tracking.
-- Run manually in Supabase Dashboard → SQL Editor.

-- 1. Per-user "last read" marker per event
CREATE TABLE IF NOT EXISTS event_reads (
  user_id      uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  event_id     uuid REFERENCES events     ON DELETE CASCADE NOT NULL,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE event_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can manage own reads"
  ON event_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_event_reads_user ON event_reads (user_id);

-- 2. Unread events for the current user: followed (event_follows is the single
--    source of truth — creators auto-follow), not ended, with a message from
--    someone else newer than the user's last_read_at. Mutes are intentionally
--    ignored (the dot is independent of push muting / push_enabled).
CREATE OR REPLACE FUNCTION get_unread_event_ids()
RETURNS TABLE(event_id uuid, is_owner boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT e.id, (e.creator_id = auth.uid()) AS is_owner
  FROM event_follows f
  JOIN events e ON e.id = f.event_id
  WHERE f.user_id = auth.uid()
    AND e.status <> 'ended'
    AND e.end_time + interval '1 hour' > now()
    AND EXISTS (
      SELECT 1 FROM event_messages m
      WHERE m.event_id = e.id
        AND m.author_id <> auth.uid()
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM event_reads r
           WHERE r.user_id = auth.uid() AND r.event_id = e.id),
          'epoch'::timestamptz)
    );
$$;

GRANT EXECUTE ON FUNCTION get_unread_event_ids() TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260602_event_reads.sql
git commit -m "feat: event_reads table + get_unread_event_ids RPC"
```

- [ ] **Step 3: Note for the operator**

This SQL must be pasted into Supabase Dashboard → SQL Editor → Run before the feature works against the live DB. Flag this in the PR/summary.

---

### Task 2: i18n key for the dot's aria-label

The dot has no visible text but needs an accessible label, in all 4 locales. `src/lib/i18n.test.ts` enforces key parity across locales, so add to all four.

**Files:**
- Modify: `src/locales/pl.ts`, `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/de.ts`

- [ ] **Step 1: Add the key to each locale**

In `src/locales/pl.ts`, add this top-level entry (e.g. right after the `common: {...},` line):
```ts
  notifications: { unread: 'Nowe wiadomości' },
```
In `src/locales/en.ts`:
```ts
  notifications: { unread: 'New messages' },
```
In `src/locales/es.ts`:
```ts
  notifications: { unread: 'Mensajes nuevos' },
```
In `src/locales/de.ts`:
```ts
  notifications: { unread: 'Neue Nachrichten' },
```

- [ ] **Step 2: Verify locale key parity + build**

Run: `npx vitest run src/lib/i18n.test.ts`
Expected: PASS (all locales have matching keys).
Run: `npx tsc -b`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add src/locales/pl.ts src/locales/en.ts src/locales/es.ts src/locales/de.ts
git commit -m "i18n: notifications.unread label in all locales"
```

---

### Task 3: Pure unread reducer (TDD)

The one piece of real logic with branches — fully unit-tested.

**Files:**
- Create: `src/lib/unread.ts`
- Test: `src/lib/unread.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/unread.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyIncomingMessage, type UnreadState } from './unread'

const ctx = (open: string | null = null) => ({
  me: 'me',
  followedIds: new Set(['f1', 'own1']),
  ownedIds: new Set(['own1']),
  openEventId: open,
})
const msg = (event_id: string, author_id: string | null) => ({ event_id, author_id })

describe('applyIncomingMessage', () => {
  it('adds a dot for someone else’s message in a followed event', () => {
    const next = applyIncomingMessage({}, msg('f1', 'other'), ctx())
    expect(next).toEqual({ f1: { isOwner: false } })
  })
  it('marks isOwner true when the event is owned', () => {
    const next = applyIncomingMessage({}, msg('own1', 'other'), ctx())
    expect(next).toEqual({ own1: { isOwner: true } })
  })
  it('ignores my own message', () => {
    expect(applyIncomingMessage({}, msg('f1', 'me'), ctx())).toEqual({})
  })
  it('ignores events I do not follow', () => {
    expect(applyIncomingMessage({}, msg('x9', 'other'), ctx())).toEqual({})
  })
  it('ignores the currently open event', () => {
    expect(applyIncomingMessage({}, msg('f1', 'other'), ctx('f1'))).toEqual({})
  })
  it('is a no-op when already unread (returns same reference)', () => {
    const state: UnreadState = { f1: { isOwner: false } }
    expect(applyIncomingMessage(state, msg('f1', 'other'), ctx())).toBe(state)
  })
  it('ignores messages with no author', () => {
    expect(applyIncomingMessage({}, msg('f1', null), ctx())).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/unread.test.ts`
Expected: FAIL — cannot resolve `./unread`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/unread.ts`:
```ts
export interface UnreadState {
  [eventId: string]: { isOwner: boolean }
}

export interface MessageCtx {
  me: string
  followedIds: Set<string>
  ownedIds: Set<string>
  openEventId: string | null
}

/**
 * Add a dot for an incoming message when it qualifies:
 * from someone else, in a followed event, not the currently open event.
 * Returns the same state reference when nothing changes.
 */
export function applyIncomingMessage(
  state: UnreadState,
  msg: { event_id: string; author_id: string | null },
  ctx: MessageCtx,
): UnreadState {
  const { event_id, author_id } = msg
  if (!author_id || author_id === ctx.me) return state
  if (!ctx.followedIds.has(event_id)) return state
  if (event_id === ctx.openEventId) return state
  if (state[event_id]) return state
  return { ...state, [event_id]: { isOwner: ctx.ownedIds.has(event_id) } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/unread.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/unread.ts src/lib/unread.test.ts
git commit -m "feat: pure unread-state reducer for message notifications"
```

---

### Task 4: Data-layer additions (`supabase.ts`)

Read marking, the RPC call, the live subscription, and the follow/own context fetch.

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Add the four functions to the `db` object**

In `src/lib/supabase.ts`, insert these methods immediately before the existing `subscribeEvents(cb:()=>void) {` line:
```ts
  async markEventRead(eventId:string) {
    const sess=await this.getSession(); if(!sess) return
    return supabase.from('event_reads').upsert(
      { user_id:sess.user.id, event_id:eventId, last_read_at:new Date().toISOString() },
      { onConflict:'user_id,event_id' },
    )
  },
  async getUnreadEventIds():Promise<{eventId:string;isOwner:boolean}[]> {
    const {data,error}=await supabase.rpc('get_unread_event_ids')
    if(error){ console.error('[getUnreadEventIds]',error); return [] }
    return (data||[]).map((r:any)=>({ eventId:r.event_id, isOwner:r.is_owner }))
  },
  async getNotifContext():Promise<{followedIds:string[];ownedIds:string[]}> {
    const sess=await this.getSession(); if(!sess) return { followedIds:[], ownedIds:[] }
    const uid=sess.user.id
    const [follows,owned]=await Promise.all([
      supabase.from('event_follows').select('event_id').eq('user_id',uid),
      supabase.from('events').select('id').eq('creator_id',uid),
    ])
    return {
      followedIds:(follows.data||[]).map((r:any)=>r.event_id),
      ownedIds:(owned.data||[]).map((r:any)=>r.id),
    }
  },
  subscribeAllMessages(cb:(m:Message)=>void) {
    return supabase.channel('msgs:all')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'event_messages'},(p:any)=>cb(p.new))
      .subscribe()
  },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no output (success). (`Message` is already imported in this file — used by `getMessages`/`subscribeMessages`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: data-layer for unread dots (markRead, RPC, context, all-messages sub)"
```

---

### Task 5: `NotificationDot` component + Sunshine avatar dot

A small reusable dot, and switch the existing `Avatar` dot from `C.primary` to `C.sunshine`.

**Files:**
- Create: `src/components/NotificationDot.tsx`
- Modify: `src/components/Avatar.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/NotificationDot.tsx`:
```tsx
import { useTranslation } from 'react-i18next'
import { C, INK } from '../lib/tokens'

export default function NotificationDot({ size = 12, style }: { size?: number; style?: React.CSSProperties }) {
  const { t } = useTranslation()
  return (
    <span
      role="status"
      aria-label={t('notifications.unread')}
      style={{
        flexShrink: 0,
        width: size, height: size, borderRadius: '50%',
        background: C.sunshine, border: `2px solid ${INK}`,
        display: 'inline-block', boxSizing: 'border-box',
        ...style,
      }}
    />
  )
}
```

- [ ] **Step 2: Switch the Avatar dot color to Sunshine**

In `src/components/Avatar.tsx`, inside the `hasUnread && (...)` block, change:
```tsx
            background: C.primary,
```
to:
```tsx
            background: C.sunshine,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add src/components/NotificationDot.tsx src/components/Avatar.tsx
git commit -m "feat: NotificationDot component + sunshine avatar dot"
```

---

### Task 6: `useUnreadEvents` hook

App-level state owner: initial RPC load, live subscription via the reducer, visibility reconcile, and mark-read on open/close.

**Files:**
- Create: `src/hooks/useUnreadEvents.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useUnreadEvents.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db } from '../lib/supabase'
import { applyIncomingMessage, type UnreadState } from '../lib/unread'

export function useUnreadEvents(session: Session | null, openEventId: string | null) {
  const [unread, setUnread] = useState<UnreadState>({})
  const ctxRef = useRef({ followedIds: new Set<string>(), ownedIds: new Set<string>() })
  const openRef = useRef<string | null>(openEventId)
  openRef.current = openEventId
  const me = session?.user.id ?? null

  const reconcile = useCallback(async () => {
    if (!me) { setUnread({}); return }
    const [rows, ctx] = await Promise.all([db.getUnreadEventIds(), db.getNotifContext()])
    ctxRef.current = { followedIds: new Set(ctx.followedIds), ownedIds: new Set(ctx.ownedIds) }
    const next: UnreadState = {}
    for (const r of rows) if (r.eventId !== openRef.current) next[r.eventId] = { isOwner: r.isOwner }
    setUnread(next)
  }, [me])

  // Initial load + whenever the logged-in user changes
  useEffect(() => { reconcile() }, [reconcile])

  // Live: global message inserts → reducer
  useEffect(() => {
    if (!me) return
    const ch = db.subscribeAllMessages(m => {
      setUnread(prev => applyIncomingMessage(prev, m, {
        me,
        followedIds: ctxRef.current.followedIds,
        ownedIds: ctxRef.current.ownedIds,
        openEventId: openRef.current,
      }))
    })
    return () => db.unsub(ch)
  }, [me])

  // Reconcile when the app returns to the foreground (drops ended, fixes drift)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') reconcile() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [reconcile])

  const markRead = useCallback((id: string) => {
    setUnread(prev => {
      if (!prev[id]) return prev
      const n = { ...prev }
      delete n[id]
      return n
    })
    db.markEventRead(id)
  }, [])

  // Mark the open event read on open, and again on close (covers messages seen
  // while viewing). The open event never accrues a dot (reducer + reconcile skip it).
  useEffect(() => {
    if (!openEventId || !me) return
    markRead(openEventId)
    return () => { markRead(openEventId) }
  }, [openEventId, me, markRead])

  const hasOwned = Object.values(unread).some(v => v.isOwner)
  const hasFollowed = Object.values(unread).some(v => !v.isOwner)
  const isUnread = useCallback((id: string) => !!unread[id], [unread])

  return {
    hasAny: Object.keys(unread).length > 0,
    hasOwned,
    hasFollowed,
    isUnread,
    markRead,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useUnreadEvents.ts
git commit -m "feat: useUnreadEvents hook (RPC load, realtime, mark-read)"
```

---

### Task 7: Wire the hook into App + menu-icon dot

Instantiate the hook, compute the open event id, and pass the menu flag to `MapScreen`’s avatar.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/screens/MapScreen.tsx`

- [ ] **Step 1: Import the hook in App**

In `src/App.tsx`, add after the existing screen imports (near `import FollowedEventsScreen ...`):
```ts
import { useUnreadEvents } from './hooks/useUnreadEvents'
```

- [ ] **Step 2: Instantiate the hook in App**

In `src/App.tsx`, immediately after the line `const flyToFnRef = useRef<((lat: number, lng: number) => void) | null>(null)`, add:
```ts
  const openEventId = selEvent?.id ?? myEventSelected?.id ?? followedEventSelected?.id ?? null
  const unread = useUnreadEvents(session, openEventId)
```

- [ ] **Step 3: Add an `unreadMenu` prop to MapScreen**

In `src/screens/MapScreen.tsx`, add to the props destructuring (after `onOpenProfile,`):
```ts
  unreadMenu = false,
```
And in the props type (after `onOpenProfile: () => void`):
```ts
  unreadMenu?: boolean
```

- [ ] **Step 4: Feed the flag to the avatar**

In `src/screens/MapScreen.tsx`, change the avatar’s `hasUnread={false}` to:
```tsx
            hasUnread={unreadMenu}
```

- [ ] **Step 5: Pass the flag from App**

In `src/App.tsx`, find the `<MapScreen` usage and add this prop (alongside `onOpenProfile={...}`):
```tsx
        unreadMenu={unread.hasAny}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: no output (success).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/screens/MapScreen.tsx
git commit -m "feat: wire unread hook into App + menu avatar dot"
```

---

### Task 8: Profile-menu item dots

Dots on "Moje wydarzenia" (`hasOwned`) and "Obserwowane" (`hasFollowed`).

**Files:**
- Modify: `src/screens/ProfilePanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the dot + add props to ProfilePanel**

In `src/screens/ProfilePanel.tsx`, add the import at the top (after the tokens import):
```ts
import NotificationDot from '../components/NotificationDot'
```
Add to the props destructuring (after `onOpenFollowedEvents,`):
```ts
  myEventsUnread = false,
  followedUnread = false,
```
Add to the props type (after `onOpenFollowedEvents: () => void`):
```ts
  myEventsUnread?: boolean
  followedUnread?: boolean
```

- [ ] **Step 2: Render dots next to the titles**

In `src/screens/ProfilePanel.tsx`, change the "Moje wydarzenia" title block:
```tsx
                <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>
                  {t('profile.myEvents')}
                </div>
```
to:
```tsx
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>
                    {t('profile.myEvents')}
                  </div>
                  {myEventsUnread && <NotificationDot />}
                </div>
```
And change the "Obserwowane" title block:
```tsx
                <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>
                  {t('profile.followedEvents')}
                </div>
```
to:
```tsx
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>
                    {t('profile.followedEvents')}
                  </div>
                  {followedUnread && <NotificationDot />}
                </div>
```

- [ ] **Step 3: Pass flags from App**

In `src/App.tsx`, on the `<ProfilePanel` usage, add these props (alongside `onOpenMyEvents={...}`):
```tsx
        myEventsUnread={unread.hasOwned}
        followedUnread={unread.hasFollowed}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add src/screens/ProfilePanel.tsx src/App.tsx
git commit -m "feat: unread dots on profile-menu items"
```

---

### Task 9: Event-list item dots (MyEvents + Followed)

A dot on each list row whose event is unread.

**Files:**
- Modify: `src/screens/MyEventsScreen.tsx`
- Modify: `src/screens/FollowedEventsScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: MyEventsScreen — import, prop, render**

In `src/screens/MyEventsScreen.tsx`, add the import (after the existing component imports):
```ts
import NotificationDot from '../components/NotificationDot'
```
Add an `isUnread` prop. In the props destructuring add `isUnread,` and in the props type add:
```ts
  isUnread?: (id: string) => boolean
```
Then render the dot as the first child of the right-side action container — change:
```tsx
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {/* Mute toggle */}
```
to:
```tsx
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {isUnread?.(ev.id) && <NotificationDot />}
                  {/* Mute toggle */}
```

- [ ] **Step 2: FollowedEventsScreen — import, prop, render (same change)**

In `src/screens/FollowedEventsScreen.tsx`, add the import (after the existing component imports):
```ts
import NotificationDot from '../components/NotificationDot'
```
Add an `isUnread` prop. In the props destructuring add `isUnread,` and in the props type add:
```ts
  isUnread?: (id: string) => boolean
```
Then change:
```tsx
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {/* Mute toggle */}
```
to:
```tsx
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {isUnread?.(ev.id) && <NotificationDot />}
                  {/* Mute toggle */}
```

- [ ] **Step 3: Pass `isUnread` from App**

In `src/App.tsx`, on BOTH the `<MyEventsScreen` usage and the `<FollowedEventsScreen` usage, add:
```tsx
            isUnread={unread.isUnread}
```

- [ ] **Step 4: Type-check + full test suite**

Run: `npx tsc -b`
Expected: no output (success).
Run: `npm test`
Expected: PASS (existing suites + the new `unread.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/screens/MyEventsScreen.tsx src/screens/FollowedEventsScreen.tsx src/App.tsx
git commit -m "feat: unread dots on event list items"
```

---

### Task 10: Manual end-to-end verification

The realtime path and RLS cannot be unit-tested; verify against the running app after the migration is applied in Supabase.

**Files:** none

- [ ] **Step 1: Apply the migration**

Paste `supabase/migrations/20260602_event_reads.sql` into Supabase Dashboard → SQL Editor → Run.

- [ ] **Step 2: Verify the realtime + RLS path**

With two accounts (A follows/owns an event, B posts a message): confirm A sees a Sunshine dot appear in real time on the menu avatar, on the relevant profile-menu item, and on the event’s list row — without refreshing. If the dot only appears after navigation/refresh, realtime delivery is blocked by `event_messages` RLS for `authenticated`; in that case add/confirm a SELECT policy allowing authenticated reads (note it and stop for guidance).

- [ ] **Step 3: Verify clear + own-message + ended**

Confirm: opening the event clears its dot (and it stays cleared after closing); B sees no dot for B’s own message; a dot does not appear for the event currently open; an ended event shows no dot after foregrounding the app.

---

## Self-Review

**Spec coverage:**
- `event_reads` table + RLS → Task 1. ✓
- `get_unread_event_ids()` RPC (followed, not-ended, others’ messages, is_owner, mutes ignored) → Task 1. ✓
- Data layer (markEventRead, getUnreadEventIds, subscribeAllMessages, context) → Task 4. ✓
- Pure reducer + tests → Task 3. ✓
- Hook (init, realtime, visibility reconcile, mark-read on open/close, API) → Task 6. ✓
- UI dots at 3 levels (menu avatar, profile items, list items) + Sunshine color → Tasks 5, 7, 8, 9. ✓
- Open clears / open event never accrues → Task 6 (effect + reducer). ✓
- Real-time, own-message excluded, count binary, mutes ignored, push_enabled independent → Tasks 1, 3, 6 (+ verified in Task 10). ✓
- Ended auto-clear → Task 1 (RPC) + Task 6 (reconcile). ✓
- i18n aria-label in all locales → Task 2. ✓
- Reducer test → Task 3. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✓

**Type consistency:** `UnreadState` and `applyIncomingMessage` (Task 3) are consumed unchanged in Task 6. `getUnreadEventIds` returns `{eventId,isOwner}[]` (Task 4) and is read as such in Task 6. Hook API `{hasAny,hasOwned,hasFollowed,isUnread,markRead}` (Task 6) matches App usage in Tasks 7–9 (`unread.hasAny`, `unread.hasOwned`, `unread.hasFollowed`, `unread.isUnread`). Prop names `unreadMenu` (Task 7), `myEventsUnread`/`followedUnread` (Task 8), `isUnread` (Task 9) are defined and passed consistently. `NotificationDot` default export imported the same way everywhere. ✓
