# Event Lifecycle Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix event day filtering to use range overlap, stop halo pulsing after `end_time`, auto-set "to" time 24h after "from", and prevent "to" < "from" in the creation form.

**Architecture:** Three independent file changes — pure-function logic fix in `eventStatus.ts` (TDD), SQL query fix in `supabase.ts`, and two UI fixes in `CreateSheet.tsx`. No new files, no new dependencies.

**Tech Stack:** React 18, TypeScript, Supabase JS client, Vitest + jsdom.

---

## File Map

| Action | Path | Change |
|---|---|---|
| Modify | `src/lib/eventStatus.ts` | `isCurrentlyLive` returns true only for `'live'` |
| Create | `src/lib/eventStatus.test.ts` | Unit tests for `isCurrentlyLive` |
| Modify | `src/lib/supabase.ts` | Replace `start_time` range with overlap filter; remove unused `isOnDay` |
| Modify | `src/screens/CreateSheet.tsx` | Auto-set end time + `min` constraint on end input |

---

## Task 1: Fix `isCurrentlyLive` — TDD

**Files:**
- Modify: `src/lib/eventStatus.ts`
- Create: `src/lib/eventStatus.test.ts`

- [ ] **Step 1a: Write failing tests**

Create `src/lib/eventStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isCurrentlyLive, computeStatus } from './eventStatus'

// Helpers — build event relative to now
function ev(startOffsetMs: number, endOffsetMs: number) {
  const now = Date.now()
  return {
    start_time: new Date(now + startOffsetMs).toISOString(),
    end_time:   new Date(now + endOffsetMs).toISOString(),
  }
}

describe('isCurrentlyLive', () => {
  it('returns true when now is between start_time and end_time (live)', () => {
    // started 1h ago, ends in 1h
    expect(isCurrentlyLive(ev(-3_600_000, 3_600_000))).toBe(true)
  })

  it('returns false when now is before start_time (upcoming)', () => {
    // starts in 1h, ends in 2h
    expect(isCurrentlyLive(ev(3_600_000, 7_200_000))).toBe(false)
  })

  it('returns false when now is after end_time but within effectiveEnd (extended)', () => {
    // started 2h ago, ended 30min ago — effectiveEnd = end_time + 1h = now+30min → extended
    expect(isCurrentlyLive(ev(-7_200_000, -1_800_000))).toBe(false)
  })

  it('returns false when now is past effectiveEnd (ended)', () => {
    // started 3h ago, ended 2h ago — effectiveEnd = end_time + 1h = now-1h → ended
    expect(isCurrentlyLive(ev(-10_800_000, -7_200_000))).toBe(false)
  })
})

describe('computeStatus', () => {
  it('returns live when now is between start and end', () => {
    expect(computeStatus(ev(-3_600_000, 3_600_000))).toBe('live')
  })

  it('returns upcoming when now is before start', () => {
    expect(computeStatus(ev(3_600_000, 7_200_000))).toBe('upcoming')
  })

  it('returns extended when now is past end_time but within effectiveEnd', () => {
    // ended 30min ago, no messages → effectiveEnd = end + 1h = now+30min → extended
    expect(computeStatus(ev(-7_200_000, -1_800_000))).toBe('extended')
  })

  it('returns ended when now is past effectiveEnd', () => {
    // ended 2h ago, no messages → effectiveEnd = end + 1h = now-1h → ended
    expect(computeStatus(ev(-10_800_000, -7_200_000))).toBe('ended')
  })
})
```

- [ ] **Step 1b: Run tests — confirm `isCurrentlyLive` extended test fails**

```bash
cd /Users/wiktormarc/meuwe-web && npm test -- --reporter=verbose src/lib/eventStatus.test.ts
```

Expected: the test `'returns false when now is after end_time but within effectiveEnd (extended)'` FAILS because current `isCurrentlyLive` returns `true` for `extended`. All other tests may also fail since the file doesn't exist yet — that's expected.

- [ ] **Step 1c: Update `isCurrentlyLive` in `src/lib/eventStatus.ts`**

Change only the last function. Replace:

```ts
/** True if the event is currently active (halo should pulse). */
export function isCurrentlyLive(
  event: { start_time: string; end_time: string },
  messages: { created_at: string }[] = [],
  now = new Date(),
): boolean {
  const s = computeStatus(event, messages, now)
  return s === 'live' || s === 'extended'
}
```

With:

```ts
/** True if the event is within its scheduled window (halo should pulse). */
export function isCurrentlyLive(
  event: { start_time: string; end_time: string },
  messages: { created_at: string }[] = [],
  now = new Date(),
): boolean {
  return computeStatus(event, messages, now) === 'live'
}
```

- [ ] **Step 1d: Run tests — all should pass**

```bash
npm test -- --reporter=verbose src/lib/eventStatus.test.ts
```

Expected: 8/8 PASS

- [ ] **Step 1e: Run full suite**

```bash
npm test
```

Expected: all tests pass (no regressions)

- [ ] **Step 1f: Commit**

```bash
git add src/lib/eventStatus.ts src/lib/eventStatus.test.ts
git commit -m "fix: halo pulses only during live window, not extended"
```

---

## Task 2: Fix `getEvents` day filter (range overlap)

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 2a: Apply range overlap filter in `src/lib/supabase.ts`**

Locate the `getEvents` function (around line 39). Find these two lines:

```ts
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString())
```

Replace with:

```ts
      .lte('start_time', dayEnd.toISOString())
      .gte('end_time',   dayStart.toISOString())
```

That's the only change in `getEvents`. The `dayStart`/`dayEnd` computation above it is unchanged.

- [ ] **Step 2b: Remove unused `isOnDay` export**

The `isOnDay` function at the top of `src/lib/supabase.ts` (lines 16–19) is no longer called anywhere. Delete it:

```ts
export function isOnDay(startTime:string, today:Date, dayOffset:number):boolean {
  const target = new Date(today); target.setDate(today.getDate()+dayOffset)
  const d = new Date(startTime)
  return d.toDateString() === target.toDateString()
}
```

Verify no other file imports `isOnDay`:

```bash
grep -r "isOnDay" /Users/wiktormarc/meuwe-web/src/
```

Expected: no results (if any appear, do NOT delete `isOnDay` — update this task accordingly).

- [ ] **Step 2c: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 2d: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2e: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "fix: getEvents uses range overlap so multi-day events appear on all their days"
```

---

## Task 3: CreateSheet — auto-set end time + min constraint

**Files:**
- Modify: `src/screens/CreateSheet.tsx`

- [ ] **Step 3a: Add auto-set `useEffect` after existing effects**

In `src/screens/CreateSheet.tsx`, after the existing `useEffect` for reverse geocoding (ends around line 70), add:

```ts
  // Auto-set end time to start + 24h whenever start changes
  useEffect(() => {
    setEndTime(new Date(new Date(startTime).getTime() + 86_400_000).toISOString().slice(0, 16))
  }, [startTime])
```

- [ ] **Step 3b: Add `min` constraint to end time input**

Find the end time `<input>` (around line 443–448):

```tsx
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={{ fontSize: 13, fontWeight: 700, color: C.ink, width: '100%' }}
                />
```

Replace with:

```tsx
                <input
                  type="datetime-local"
                  value={endTime}
                  min={startTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={{ fontSize: 13, fontWeight: 700, color: C.ink, width: '100%' }}
                />
```

- [ ] **Step 3c: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3d: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3e: Manual smoke test**

Start the dev server (`npm run dev`) and open the Create sheet:

1. Open the time section — confirm "to" shows exactly 24h after "from"
2. Change "from" to tomorrow — confirm "to" auto-updates to tomorrow+24h
3. Try manually setting "to" earlier than "from" — browser should prevent it
4. Submit a valid event — confirm it creates without error

- [ ] **Step 3f: Commit**

```bash
git add src/screens/CreateSheet.tsx
git commit -m "feat: auto-set end time to start+24h, prevent end before start"
```
