# Pin Exclusivity Zone (3x3 m) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every public pin a 3x3 m exclusivity zone for its time window, rejecting overlapping creates/edits with a localized meuwe-styled modal.

**Architecture:** A Postgres `BEFORE INSERT OR UPDATE` trigger on `events` is the atomic source of truth (raises `SQLSTATE MW001` on collision); a public RPC exposes the same check for a fast client pre-check. The client mirrors the geometry in a pure, unit-tested TS module, pre-checks before uploading photos, and shows `ConflictModal` on either the pre-check hit or a mapped `MW001` error.

**Tech Stack:** React + TypeScript, Vite, react-i18next, Supabase (Postgres), vitest.

**Reference spec:** `docs/superpowers/specs/2026-07-14-pin-exclusivity-zone-design.md`

---

## File Structure

- Create `src/lib/zoneConflict.ts` - pure collision geometry/time logic (mirror of DB rule, testable).
- Create `src/lib/zoneConflict.test.ts` - vitest unit tests for the above.
- Create `supabase/migrations/20260714_pin_exclusivity_zone.sql` - SQL function + trigger + public RPC.
- Create `src/components/ConflictModal.tsx` - meuwe-styled centred alert modal.
- Modify `src/lib/supabase.ts` - add `db.eventZoneConflict(...)`; map `MW001` in create/update callers.
- Modify `src/screens/CreateSheet.tsx` - pre-check in `submit()`, modal state, render `ConflictModal`.
- Modify `src/locales/pl.ts`, `en.ts`, `es.ts`, `de.ts` - add `conflict` block.

---

## Task 1: Pure collision logic (TDD)

**Files:**
- Create: `src/lib/zoneConflict.ts`
- Test: `src/lib/zoneConflict.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/zoneConflict.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pinsCollide, type ZonePin } from './zoneConflict'

// Base pin: a 4h public window starting "now", at a fixed point.
const T0 = '2026-07-14T10:00:00.000Z'
const T4 = '2026-07-14T14:00:00.000Z'
function pin(over: Partial<ZonePin> = {}): ZonePin {
  return { lat: 50.0, lng: 22.0, start_time: T0, end_time: T4, is_private: false, ...over }
}

// ~1 deg lat = 111320 m, so 2 m north ≈ 0.00001796 deg. cos(50°) ≈ 0.6428,
// so 2 m east ≈ 0.00002794 deg lng. 4 m east ≈ 0.00005588 deg lng.
const DLAT_2M = 2 / 111320
const DLNG_4M = 4 / (111320 * Math.cos((50 * Math.PI) / 180))

describe('pinsCollide', () => {
  it('collides: same spot, overlapping time', () => {
    expect(pinsCollide(pin(), pin())).toBe(true)
  })

  it('collides: 2 m apart (zones overlap) + overlapping time', () => {
    expect(pinsCollide(pin(), pin({ lat: 50.0 + DLAT_2M }))).toBe(true)
  })

  it('no collision: 4 m east apart (zones disjoint) even with overlapping time', () => {
    expect(pinsCollide(pin(), pin({ lng: 22.0 + DLNG_4M }))).toBe(false)
  })

  it('no collision: same spot but disjoint time', () => {
    const later = pin({ start_time: '2026-07-14T14:00:00.000Z', end_time: '2026-07-14T18:00:00.000Z' })
    expect(pinsCollide(pin(), later)).toBe(false)
  })

  it('no collision: back-to-back times touching exactly at the boundary', () => {
    const back = pin({ start_time: T4, end_time: '2026-07-14T18:00:00.000Z' })
    expect(pinsCollide(pin(), back)).toBe(false)
  })

  it('no collision: candidate is private', () => {
    expect(pinsCollide(pin({ is_private: true }), pin())).toBe(false)
  })

  it('no collision: existing is private', () => {
    expect(pinsCollide(pin(), pin({ is_private: true }))).toBe(false)
  })

  it('no collision: same id (self, edit case)', () => {
    expect(pinsCollide(pin({ id: 'abc' }), pin({ id: 'abc' }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/zoneConflict.test.ts`
Expected: FAIL - `Failed to resolve import "./zoneConflict"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/zoneConflict.ts`:

```ts
// Pin exclusivity zone: each public pin owns a 3x3 m square (centre +/- 1.5 m,
// axis-aligned N/E) for its whole time window. This is a pure mirror of the DB
// trigger rule (supabase/migrations/20260714_pin_exclusivity_zone.sql) used for
// the fast client pre-check and for unit tests. The DB trigger stays the source
// of truth.

export interface ZonePin {
  lat: number
  lng: number
  start_time: string // ISO 8601
  end_time: string   // ISO 8601
  is_private?: boolean
  id?: string
}

const M_PER_DEG_LAT = 111320
const ZONE_SIDE_M = 3 // two 1.5 m half-squares -> overlap when centres < 3 m per axis

export function zonesOverlapSpatially(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): boolean {
  const dLatM = (a.lat - b.lat) * M_PER_DEG_LAT
  const dLngM = (a.lng - b.lng) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180)
  return Math.abs(dLatM) < ZONE_SIDE_M && Math.abs(dLngM) < ZONE_SIDE_M
}

export function intervalsOverlap(
  aStart: string, aEnd: string, bStart: string, bEnd: string,
): boolean {
  const as = Date.parse(aStart), ae = Date.parse(aEnd)
  const bs = Date.parse(bStart), be = Date.parse(bEnd)
  return as < be && bs < ae // strict: touching endpoints do not overlap
}

export function pinsCollide(candidate: ZonePin, existing: ZonePin): boolean {
  if (candidate.is_private || existing.is_private) return false
  if (candidate.id != null && candidate.id === existing.id) return false
  return (
    zonesOverlapSpatially(candidate, existing) &&
    intervalsOverlap(candidate.start_time, candidate.end_time, existing.start_time, existing.end_time)
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/zoneConflict.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/zoneConflict.ts src/lib/zoneConflict.test.ts
git commit -m "feat: pure 3x3 m pin exclusivity collision logic + tests"
```

---

## Task 2: Database trigger + RPC migration

**Files:**
- Create: `supabase/migrations/20260714_pin_exclusivity_zone.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260714_pin_exclusivity_zone.sql`:

```sql
-- Pin exclusivity zone: every PUBLIC event owns a 3x3 m square for its duration.
-- Two public events collide when their squares overlap (centres < 3 m on each
-- axis) AND their time windows overlap. Enforced atomically by a BEFORE trigger
-- (SQLSTATE MW001 on collision); a public RPC exposes the same check so the
-- client can pre-check before doing expensive work (photo upload).

-- Shared rule: returns the id of a conflicting public, non-self event (or NULL).
create or replace function _event_zone_conflict(
  p_lat double precision,
  p_lng double precision,
  p_start timestamptz,
  p_end   timestamptz,
  p_exclude_id uuid
) returns uuid
language sql stable as $$
  select e.id
  from events e
  where e.is_private = false
    and (p_exclude_id is null or e.id <> p_exclude_id)
    -- temporal overlap (strict: touching endpoints allowed)
    and p_start < e.end_time
    and e.start_time < p_end
    -- spatial overlap of the two 3x3 m squares (centres < 3 m on each axis)
    and abs((p_lat - e.lat) * 111320) < 3
    and abs((p_lng - e.lng) * 111320 * cos(radians(p_lat))) < 3
  limit 1
$$;

-- Trigger: the atomic guard. Skips private rows and skips writes that do not
-- touch any zone-relevant column (so status/title/photo edits never trip it).
create or replace function events_zone_guard() returns trigger
language plpgsql as $$
begin
  if NEW.is_private then
    return NEW;
  end if;
  if TG_OP = 'UPDATE'
     and NEW.lat = OLD.lat and NEW.lng = OLD.lng
     and NEW.start_time = OLD.start_time and NEW.end_time = OLD.end_time
     and NEW.is_private = OLD.is_private then
    return NEW;
  end if;
  if _event_zone_conflict(NEW.lat, NEW.lng, NEW.start_time, NEW.end_time, NEW.id) is not null then
    raise exception 'zone occupied' using errcode = 'MW001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_events_zone_guard on events;
create trigger trg_events_zone_guard
  before insert or update on events
  for each row execute function events_zone_guard();

-- Public wrapper for the client pre-check.
create or replace function event_zone_conflict(
  p_lat double precision,
  p_lng double precision,
  p_start timestamptz,
  p_end   timestamptz,
  p_exclude_id uuid default null
) returns boolean
language sql stable security definer set search_path = public as $$
  select _event_zone_conflict(p_lat, p_lng, p_start, p_end, p_exclude_id) is not null
$$;

grant execute on function event_zone_conflict(
  double precision, double precision, timestamptz, timestamptz, uuid
) to anon, authenticated;
```

- [ ] **Step 2: Apply the migration to STAGING and verify**

The repo `.env` points at PROD Supabase - do NOT apply there. Apply to the
**staging** project (per the deploy-branch rule, PROD is reached only via `main`).
Using the staging DB connection, run the migration file, then verify in the SQL
editor:

```sql
-- Should return true for two coincident public windows...
select event_zone_conflict(50.0, 22.0, '2026-07-14T10:00Z', '2026-07-14T14:00Z', null);
-- ...assuming a public event already exists at ~(50.0, 22.0) in that window.
-- Insert two overlapping public events by hand; the second must raise MW001.
```

Expected: the wrapper returns `true` when a conflicting public event exists;
a direct second overlapping `insert into events (...)` fails with `SQLSTATE MW001`;
an overlapping insert with `is_private = true` succeeds.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260714_pin_exclusivity_zone.sql
git commit -m "feat(db): 3x3 m pin exclusivity trigger + pre-check RPC"
```

---

## Task 3: Client RPC wrapper `db.eventZoneConflict`

**Files:**
- Modify: `src/lib/supabase.ts` (add method inside the `db` object, near `createEvent`)

- [ ] **Step 1: Add the method**

In `src/lib/supabase.ts`, add this method to the `db` object (e.g. immediately
before `async createEvent(`):

```ts
  // Fast pre-check mirroring the DB trigger; returns true if a public pin's
  // 3x3 m zone overlaps this candidate during an overlapping time window.
  // Fails OPEN (returns false) on error — the BEFORE-INSERT trigger (MW001) is
  // the real guard, so a transient RPC failure must not block a valid create.
  async eventZoneConflict(p: {
    lat: number; lng: number; start: string; end: string; excludeId?: string | null
  }): Promise<boolean> {
    const { data, error } = await supabase.rpc('event_zone_conflict', {
      p_lat: p.lat, p_lng: p.lng, p_start: p.start, p_end: p.end,
      p_exclude_id: p.excludeId ?? null,
    })
    if (error) { console.error('[eventZoneConflict]', error); return false }
    return data === true
  },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: db.eventZoneConflict client pre-check wrapper"
```

---

## Task 4: i18n `conflict` block (all four languages)

**Files:**
- Modify: `src/locales/pl.ts`, `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/de.ts`

No long dashes in copy (plain hyphen only).

- [ ] **Step 1: Add the block to `pl.ts`**

Add this top-level key as a sibling of `create` (e.g. right after the
`common: { ... }` line) in `src/locales/pl.ts`:

```ts
  conflict: {
    title: 'Miejsce zajęte',
    body: 'Wydarzenie w tym miejscu i czasie już istnieje, popraw czas wydarzenia lub zmień miejsce',
    ok: 'Zamknij',
  },
```

- [ ] **Step 2: Add the block to `en.ts`**

```ts
  conflict: {
    title: 'Spot taken',
    body: 'An event already exists at this place and time - adjust the time or move the location.',
    ok: 'Close',
  },
```

- [ ] **Step 3: Add the block to `es.ts`**

```ts
  conflict: {
    title: 'Lugar ocupado',
    body: 'Ya existe un evento en este lugar y horario: ajusta la hora o cambia la ubicación.',
    ok: 'Cerrar',
  },
```

- [ ] **Step 4: Add the block to `de.ts`**

```ts
  conflict: {
    title: 'Platz belegt',
    body: 'An diesem Ort und zu dieser Zeit existiert bereits ein Event - passe die Zeit an oder ändere den Ort.',
    ok: 'Schließen',
  },
```

- [ ] **Step 5: Typecheck (locale shape parity)**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors (all four locales share the same shape, so a missing key in
one would error if the locale type is inferred from another).

- [ ] **Step 6: Commit**

```bash
git add src/locales/pl.ts src/locales/en.ts src/locales/es.ts src/locales/de.ts
git commit -m "feat(i18n): conflict modal copy in pl/en/es/de"
```

---

## Task 5: `ConflictModal` component

**Files:**
- Create: `src/components/ConflictModal.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/ConflictModal.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'

// Meuwe-styled alert: dimmed backdrop + centred card. Shown when a pin's 3x3 m
// exclusivity zone overlaps an existing public pin during an overlapping window.
export default function ConflictModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, background: '#fff', borderRadius: 32,
          padding: '28px 24px 24px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }}>📍</div>
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {t('conflict.title')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {t('conflict.body')}
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px', borderRadius: 999,
            background: C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
            border: `2.5px solid ${INK}`, boxShadow: '0 6px 16px rgba(255,122,69,0.35)',
          }}
        >
          {t('conflict.ok')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ConflictModal.tsx
git commit -m "feat: ConflictModal (meuwe-styled zone-occupied alert)"
```

---

## Task 6: Wire the pre-check + error mapping into CreateSheet

**Files:**
- Modify: `src/screens/CreateSheet.tsx`

- [ ] **Step 1: Import the modal**

Add near the other imports at the top of `src/screens/CreateSheet.tsx`:

```tsx
import ConflictModal from '../components/ConflictModal'
```

- [ ] **Step 2: Add modal state**

Next to the other `useState` hooks (e.g. right after `const [err, setErr] = useState('')`):

```tsx
  const [conflictOpen, setConflictOpen] = useState(false)
```

- [ ] **Step 3: Pre-check before photo upload**

In `submit()`, the block currently reads (after the `pastError` guard):

```tsx
    const startISO = new Date(startMs).toISOString()
    const endISO = new Date(endMs).toISOString()
    // Upload new photos, keep existing URLs, preserve slot order.
    let photoUrls: string[]
```

Replace it with (moves `pos` up and inserts the pre-check before upload):

```tsx
    const startISO = new Date(startMs).toISOString()
    const endISO = new Date(endMs).toISOString()
    const pos = defaultPos || { lat: 52.2297, lng: 21.0122 }

    // Zone pre-check (skip for private pins — they are exempt from exclusivity).
    // The DB trigger is the real guard; this just avoids uploading photos for a
    // create/edit that will be rejected, and surfaces the modal early.
    const isPrivateNow = editEvent ? editEvent.is_private : isPrivate
    if (!isPrivateNow) {
      const conflict = await db.eventZoneConflict({
        lat: pos.lat, lng: pos.lng, start: startISO, end: endISO,
        excludeId: editEvent ? editEvent.id : null,
      })
      if (conflict) { setConflictOpen(true); setSubmitting(false); return }
    }

    // Upload new photos, keep existing URLs, preserve slot order.
    let photoUrls: string[]
```

Then delete the now-duplicate `pos` declaration that currently sits just before
the `if (editEvent) {` update branch:

```tsx
    const pos = defaultPos || { lat: 52.2297, lng: 21.0122 }
```

(Remove that single line — `pos` is now declared earlier.)

- [ ] **Step 4: Map MW001 on the update branch**

In the edit branch, replace:

```tsx
      setSubmitting(false)
      if (error || !data) { setErr(t('create.submitError')); return }
```

with:

```tsx
      setSubmitting(false)
      if (error || !data) {
        if ((error as { code?: string } | null)?.code === 'MW001') setConflictOpen(true)
        else setErr(t('create.submitError'))
        return
      }
```

- [ ] **Step 5: Map MW001 on the create branch**

In the create branch, replace:

```tsx
    setSubmitting(false)
    if (error) {
      setErr(t('create.submitError'))
      return
    }
```

with:

```tsx
    setSubmitting(false)
    if (error) {
      if ((error as { code?: string }).code === 'MW001') setConflictOpen(true)
      else setErr(t('create.submitError'))
      return
    }
```

- [ ] **Step 6: Render the modal**

At the top level of the component's returned JSX (e.g. as the first child inside
the outer sheet `<div>`, right after `<DragHandle />`), add:

```tsx
      {conflictOpen && <ConflictModal onClose={() => setConflictOpen(false)} />}
```

- [ ] **Step 7: Typecheck + tests + build**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx vitest run && npm run build`
Expected: no type errors, all tests pass, build succeeds.

- [ ] **Step 8: Manual verification on staging preview**

With the staging DB migration applied, run the dev server (via preview tooling)
and verify:
- Create a public pin, then create another at the same spot + overlapping time -> `ConflictModal` appears, no photo upload happens.
- Move the second pin > 3 m away, or shift its time so it no longer overlaps -> create succeeds.
- Create a **private** pin over an existing public one -> succeeds (no modal).
- Edit an existing public pin onto another public pin's zone/time -> modal; editing only its title/photos -> succeeds.
- Switch app language to en/es/de -> modal copy is localized.

- [ ] **Step 9: Commit**

```bash
git add src/screens/CreateSheet.tsx
git commit -m "feat: block overlapping pins with ConflictModal (pre-check + MW001)"
```

---

## Self-Review Notes

- **Spec coverage:** collision rule (Task 1 + 2), DB source-of-truth trigger + pre-check RPC (Task 2), client wrapper (Task 3), modal (Task 5), i18n x4 (Task 4), wiring incl. edit + MW001 safety net (Task 6), tests (Task 1) + manual staging checks (Task 6). All spec sections mapped.
- **Known caveat (accepted, out of scope):** pre-existing overlapping public rows created before the migration are not backfilled/de-duplicated; the UPDATE guard only runs when a zone-relevant column changes, so unrelated edits to such rows won't be blocked.
- **Deploy:** migration runs on staging first; PROD only when the change reaches `main`.
