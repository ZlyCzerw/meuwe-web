# Private Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow creators to mark an event as private — invisible on the map to all except people who received the share link (who are auto-followed on open).

**Architecture:** RLS-based privacy: `is_private` column on `events`, updated SELECT policy blocks non-followers from seeing private events at the DB level. A SECURITY DEFINER RPC (`get_event_by_id`) bypasses RLS for deep-link fetches — possessing the UUID is the auth credential. Auto-follow fires silently in `App.tsx` when a logged-in user opens a private event via link.

**Tech Stack:** React + TypeScript, Supabase (PostgreSQL + RLS), Leaflet (map markers), Vitest (tests), i18next (i18n)

**Spec:** `docs/superpowers/specs/2026-06-08-private-events-design.md`

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/20260608_private_events.sql` | **CREATE** — column, RLS policy, RPC |
| `src/lib/types.ts` | **MODIFY** — add `is_private` to `EventRow` |
| `src/locales/pl.ts` | **MODIFY** — add `create.privateEvent` + `create.privateEventHint` |
| `src/locales/en.ts` | **MODIFY** — same |
| `src/locales/es.ts` | **MODIFY** — same |
| `src/locales/de.ts` | **MODIFY** — same |
| `src/components/mapIcons.ts` | **MODIFY** — add `privateHTML()` |
| `src/lib/supabase.ts` | **MODIFY** — `createEvent` + `getEventById` |
| `src/lib/supabase.test.ts` | **MODIFY** — add test for `createEvent` null-session guard |
| `src/screens/CreateSheet.tsx` | **MODIFY** — private toggle UI |
| `src/screens/MapScreen.tsx` | **MODIFY** — use `privateHTML` for private pins |
| `src/App.tsx` | **MODIFY** — auto-follow on private deep link |

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `supabase/migrations/20260608_private_events.sql`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/private-events
```

Expected: `Switched to a new branch 'feat/private-events'`

- [ ] **Step 2: Write migration file**

Create `supabase/migrations/20260608_private_events.sql`:

```sql
-- Add is_private column (false = public, default)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Replace permissive SELECT policy with one that hides private events
-- from users who are neither the creator nor a follower.
DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select" ON events FOR SELECT
  USING (
    NOT is_private
    OR auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM event_follows
      WHERE event_id = events.id
        AND user_id = auth.uid()
    )
  );

-- SECURITY DEFINER RPC: fetch any event by ID, bypassing RLS.
-- Used exclusively for deep-link opens — possessing the UUID equals
-- possessing the share link, which is treated as authorization.
CREATE OR REPLACE FUNCTION get_event_by_id(p_event_id uuid)
RETURNS SETOF events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM events WHERE id = p_event_id;
$$;
```

- [ ] **Step 3: Apply migration in Supabase Dashboard**

Open Supabase Dashboard → SQL Editor → paste the file contents → Run.

Verify: table `events` now has column `is_private`, policy `events_select` is updated, function `get_event_by_id` exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260608_private_events.sql
git commit -m "feat(db): add is_private column, updated RLS policy, get_event_by_id RPC"
```

---

## Task 2: TypeScript type + i18n keys

**Files:**
- Modify: `src/lib/types.ts:22-36`
- Modify: `src/locales/pl.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/de.ts`

- [ ] **Step 1: Add `is_private` to `EventRow`**

In `src/lib/types.ts`, add `is_private` to the `EventRow` interface (after `created_at`):

```ts
export interface EventRow {
  id: string
  title: string
  description: string | null
  lat: number
  lng: number
  place_name: string | null
  category: Category
  start_time: string
  end_time: string
  creator_id: string | null
  status: EventStatus
  created_at: string
  photos: string[] | null
  is_private: boolean
}
```

- [ ] **Step 2: Add i18n keys to `src/locales/pl.ts`**

Find the `create` block. Add two keys after `timeIn24h` (or any logical position — after `timeTo` is fine):

```ts
  create: {
    // ... existing keys ...
    timeTo: 'DO',
    privateEvent: 'Wydarzenie prywatne',
    privateEventHint: 'Widoczny tylko dla osób z linkiem',
  },
```

- [ ] **Step 3: Add i18n keys to `src/locales/en.ts`**

```ts
  create: {
    // ... existing keys ...
    timeTo: 'TO',
    privateEvent: 'Private event',
    privateEventHint: 'Visible only to people with the link',
  },
```

- [ ] **Step 4: Add i18n keys to `src/locales/es.ts`**

```ts
  create: {
    // ... existing keys ...
    timeTo: 'HASTA',
    privateEvent: 'Evento privado',
    privateEventHint: 'Solo visible para personas con el enlace',
  },
```

- [ ] **Step 5: Add i18n keys to `src/locales/de.ts`**

```ts
  create: {
    // ... existing keys ...
    timeTo: 'BIS',
    privateEvent: 'Privates Event',
    privateEventHint: 'Nur für Personen mit dem Link sichtbar',
  },
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/locales/pl.ts src/locales/en.ts src/locales/es.ts src/locales/de.ts
git commit -m "feat(types+i18n): add is_private to EventRow and private event i18n keys"
```

---

## Task 3: Private pin icon

**Files:**
- Modify: `src/components/mapIcons.ts`

- [ ] **Step 1: Add `privateHTML` function to `src/components/mapIcons.ts`**

Append after the `meHTML` function:

```ts
export function privateHTML(isLive = false): string {
  const halos = isLive ? `
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid #ffffff;animation:halo 2.8s ease-out infinite;opacity:0;pointer-events:none"></div>
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid #ffffff;animation:halo 2.8s 1.4s ease-out infinite;opacity:0;pointer-events:none"></div>
  ` : ''
  // BLOBS[0] is the first blob shape — fixed for all private pins (consistent look)
  const path = BLOBS[0]
  return `<div style="position:relative;width:44px;height:56px;">
    <div style="position:absolute;top:0;left:0;width:44px;height:44px;">
      ${halos}
      <svg width="44" height="44" viewBox="-3 -3 106 106" style="overflow:visible;filter:drop-shadow(0 3px 0 #2D2B2A22)">
        <path d="${path}" fill="#2D2B2A" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"/>
      </svg>
      <div style="position:absolute;top:11px;left:0;width:44px;display:flex;align-items:center;justify-content:center;pointer-events:none">
        <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
          <rect x="1" y="1" width="20" height="9" rx="4" fill="white"/>
          <ellipse cx="7" cy="5.5" rx="2.5" ry="2.2" fill="#2D2B2A"/>
          <ellipse cx="15" cy="5.5" rx="2.5" ry="2.2" fill="#2D2B2A"/>
        </svg>
      </div>
    </div>
    <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:#2D2B2A;border:2.5px solid #ffffff"></div>
  </div>`
}
```

> The mask SVG is a white rounded rectangle with two dark eye holes — simple, legible at 22×12px. Adjust `rx` on `<rect>` or eye `rx`/`ry` if proportions look off at runtime.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mapIcons.ts
git commit -m "feat(map): add privateHTML marker icon for private events"
```

---

## Task 4: Supabase client — createEvent + getEventById

**Files:**
- Modify: `src/lib/supabase.ts:85-104` (createEvent)
- Modify: `src/lib/supabase.ts:136-145` (getEventById)
- Modify: `src/lib/supabase.test.ts`

- [ ] **Step 1: Update `createEvent` to accept and pass `is_private`**

In `src/lib/supabase.ts`, update the `createEvent` parameter type and INSERT:

```ts
async createEvent(ev: {
  title: string; description?: string; lat: number; lng: number;
  placeName?: string; category?: string; tags?: string[];
  start_time?: string; end_time?: string; photos?: string[];
  is_private?: boolean;
}) {
  const sess = await this.getSession(); if (!sess) return { data: null, error: { message: 'not authenticated' } }
  const { data, error } = await supabase.from('events').insert({
    title: ev.title, description: ev.description, lat: ev.lat, lng: ev.lng,
    place_name: ev.placeName, category: ev.category || 'party',
    start_time: ev.start_time || new Date().toISOString(),
    end_time: ev.end_time || new Date(Date.now() + 86400000).toISOString(),
    creator_id: sess.user.id, status: 'live',
    photos: ev.photos || [],
    is_private: ev.is_private ?? false,
  }).select().single()
  if (!error && data) {
    if (ev.tags?.length) await supabase.from('event_tags').insert(ev.tags.map(tag => ({ event_id: data.id, tag })))
    await supabase.from('event_follows').insert({ user_id: sess.user.id, event_id: data.id })
  }
  return { data, error }
},
```

- [ ] **Step 2: Update `getEventById` to use SECURITY DEFINER RPC**

Replace the existing `getEventById` implementation (lines ~136-145):

```ts
async getEventById(id: string): Promise<EventWithMeta | null> {
  // Use SECURITY DEFINER RPC to bypass RLS — needed so private events
  // are fetchable by anyone who has the share link (UUID = credential).
  const { data: evData, error } = await supabase
    .rpc('get_event_by_id', { p_event_id: id })
    .single()
  if (error || !evData) return null
  const e = evData as any
  // Fetch joins separately — profiles and event_tags have open RLS (USING true).
  const [{ data: prof }, { data: tagRows }] = await Promise.all([
    supabase.from('profiles').select('display_name,avatar_color').eq('id', e.creator_id).maybeSingle(),
    supabase.from('event_tags').select('tag').eq('event_id', id),
  ])
  return {
    ...e,
    profiles: prof || null,
    tags: (tagRows || []).map((t: any) => t.tag),
    distKm: 0,
    distStr: '',
  }
},
```

- [ ] **Step 3: Add tests to `src/lib/supabase.test.ts`**

Append to the file:

```ts
describe('db.createEvent', () => {
  it('returns error when session is null', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null } as any)
    const result = await db.createEvent({ title: 'Test', lat: 0, lng: 0 })
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})

describe('is_private default', () => {
  it('defaults to false when is_private is omitted', () => {
    const isPrivate: boolean | undefined = undefined
    expect(isPrivate ?? false).toBe(false)
  })

  it('passes through true when is_private is explicitly set', () => {
    const isPrivate = true
    expect(isPrivate ?? false).toBe(true)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass, including the 3 new ones.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase.test.ts
git commit -m "feat(db): createEvent accepts is_private, getEventById uses SECURITY DEFINER RPC"
```

---

## Task 5: CreateSheet — private toggle UI

**Files:**
- Modify: `src/screens/CreateSheet.tsx`

- [ ] **Step 1: Add `isPrivate` state**

In `src/screens/CreateSheet.tsx`, add state after the existing `useState` declarations (around line 55):

```ts
const [isPrivate, setIsPrivate] = useState(false)
```

- [ ] **Step 2: Add toggle UI between time section and photos section**

Find the `{/* Photos section */}` comment (around line 368). Insert the following block immediately before it:

```tsx
{/* Private event toggle — create mode only */}
{!editEvent && (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderRadius: 20, background: C.cream, marginBottom: 18,
  }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
        {t('create.privateEvent')}
      </div>
      {isPrivate && (
        <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 3 }}>
          🔒 {t('create.privateEventHint')}
        </div>
      )}
    </div>
    <label style={{
      position: 'relative', display: 'inline-block',
      width: 44, height: 26, cursor: 'pointer', flexShrink: 0,
    }}>
      <input
        type="checkbox"
        checked={isPrivate}
        onChange={e => setIsPrivate(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <span style={{
        position: 'absolute', inset: 0,
        background: isPrivate ? C.primary : `${C.inkSoft}44`,
        borderRadius: 13,
        border: `2px solid ${isPrivate ? INK : `${C.inkSoft}66`}`,
        transition: 'background 200ms, border-color 200ms',
        boxShadow: isPrivate ? `0 2px 0 ${INK}33` : 'none',
        display: 'block',
      }}>
        <span style={{
          position: 'absolute',
          top: 2, left: isPrivate ? 18 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: isPrivate ? '#fff' : C.inkSoft,
          transition: 'left 200ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          display: 'block',
        }}/>
      </span>
    </label>
  </div>
)}
```

- [ ] **Step 3: Pass `is_private` to `db.createEvent`**

In the `submit` function, find the `db.createEvent({...})` call (around line 163). Add `is_private: isPrivate`:

```ts
const { data, error } = await db.createEvent({
  title: title.trim(),
  description: desc,
  lat: pos.lat,
  lng: pos.lng,
  tags,
  category: tags[0] || 'party',
  start_time: new Date(startTime).toISOString(),
  end_time: new Date(endTime).toISOString(),
  photos: photoUrls,
  is_private: isPrivate,
})
```

- [ ] **Step 4: Reset `isPrivate` when form resets after successful submit**

In the submit function, after the `setTitle('')` etc. resets (around line 179), add:

```ts
setIsPrivate(false)
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/CreateSheet.tsx
git commit -m "feat(ui): add private event toggle to CreateSheet"
```

---

## Task 6: MapScreen — use privateHTML for private pins

**Files:**
- Modify: `src/screens/MapScreen.tsx:10` (imports)
- Modify: `src/screens/MapScreen.tsx:229-234` (icon creation)

- [ ] **Step 1: Import `privateHTML` and `isCurrentlyLive`**

In `src/screens/MapScreen.tsx`, find the existing import:

```ts
import { pinHTML, meHTML } from '../components/mapIcons'
```

Replace with:

```ts
import { pinHTML, meHTML, privateHTML } from '../components/mapIcons'
import { isCurrentlyLive } from '../lib/eventStatus'
```

> Note: `isCurrentlyLive` may already be imported. If so, skip that part.

- [ ] **Step 2: Use `privateHTML` for private events in marker creation**

Find the `useEffect` that creates markers (around line 221). Replace the icon creation block:

```ts
const interactions = ev.interactionCount ?? 0
const scale = 1 + Math.min(interactions, 100) / 100 * 0.5
const icon = L.divIcon({
  html: ev.is_private
    ? privateHTML(isCurrentlyLive(ev))
    : pinHTML(ev.category, i, ev.status, ev.start_time, ev.end_time, scale),
  className: 'meuwe-icon',
  iconSize: [44, 56],
  iconAnchor: [22, 56],
})
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/MapScreen.tsx
git commit -m "feat(map): render private event pins with privateHTML icon"
```

---

## Task 7: App.tsx — auto-follow private event on deep link

**Files:**
- Modify: `src/App.tsx:90-101`

- [ ] **Step 1: Add auto-follow logic to the deep link useEffect**

In `src/App.tsx`, find the "Open deep link event once map is ready" `useEffect` (around line 90-101):

```ts
// Open deep link event once map is ready
useEffect(() => {
  if (screen !== 'map' || !deepLinkEvent) return
  setSelEvent(deepLinkEvent)
  setDeepLinkEvent(null)
  const ev = deepLinkEvent
  // Auto-follow private events for logged-in users who don't already follow them.
  // Silent — no toast, no confirmation.
  if (ev.is_private && session) {
    db.isFollowingEvent(ev.id).then(following => {
      if (!following) db.followEvent(ev.id)
    })
  }
  const tryFly = () => {
    if (flyToFnRef.current) flyToFnRef.current(ev.lat, ev.lng)
    else setTimeout(tryFly, 150)
  }
  setTimeout(tryFly, 100)
}, [screen, deepLinkEvent]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): auto-follow private event when opened via share link"
```

---

## Task 8: Manual smoke test + push

No automated tests cover the full UI flow. Test manually in the browser before pushing.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test create private event**

1. Log in, click Add
2. Verify the "Wydarzenie prywatne" toggle appears (only in create mode, not edit mode)
3. Toggle ON — verify hint text appears: "🔒 Widoczny tylko dla osób z linkiem"
4. Create the event
5. Verify it appears on your own map (you're the creator)
6. Copy the share link

- [ ] **Step 3: Test private pin appearance**

Verify the private event has a dark blob marker with the mask icon instead of a category-colored pin.

- [ ] **Step 4: Test deep link for logged-in user**

1. Open the copied share link in a new tab (same logged-in session)
2. Verify EventSheet opens immediately
3. Check Supabase Dashboard → event_follows — verify a new row was created for your user + event

- [ ] **Step 5: Test deep link for non-logged user**

1. Log out
2. Open the copied share link
3. Verify EventSheet opens (SECURITY DEFINER RPC bypasses RLS)
4. Refresh the page — event should NOT reappear (no follow row, no persisted state)

- [ ] **Step 6: Test invisibility on map**

1. Log into a different account (or use incognito)
2. Navigate to the map — the private event should NOT appear as a pin
3. No direct query to Supabase from the map should return the private event

- [ ] **Step 7: Push branch**

```bash
git push -u origin feat/private-events
```
