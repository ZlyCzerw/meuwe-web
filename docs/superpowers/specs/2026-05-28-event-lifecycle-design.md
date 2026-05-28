# Event Lifecycle Fixes — Design Spec

**Date:** 2026-05-28
**Status:** Approved

## Overview

Four fixes to event lifecycle behaviour: correct day-based filtering so long-running events appear across all days they span, stop pulsing halo once an event passes its scheduled end time, auto-set the "to" time 24h after "from" in the creation form, and prevent "to" from being set earlier than "from".

## Changes

### 1. `src/lib/supabase.ts` — `getEvents` day filter (range overlap)

**Current behaviour:** Only events whose `start_time` falls within the target day are returned.

**New behaviour:** Events whose time window *overlaps* the target day are returned. An event starting Monday and ending Wednesday appears on Monday, Tuesday, and Wednesday.

Replace:
```ts
.gte('start_time', dayStart.toISOString())
.lte('start_time', dayEnd.toISOString())
```
With:
```ts
.lte('start_time', dayEnd.toISOString())   // started before end of day
.gte('end_time',   dayStart.toISOString())  // ends after start of day
```

All other query conditions unchanged: `status IN ('live','upcoming','extended')`, geographic bounding box, `order('created_at', ascending: false)`.

### 2. `src/lib/eventStatus.ts` — `isCurrentlyLive`

**Current behaviour:** Returns `true` for both `'live'` and `'extended'` statuses → halo pulses even after `end_time` is passed.

**New behaviour:** Returns `true` only for `'live'` → halo stops once `now > end_time`.

```ts
export function isCurrentlyLive(...): boolean {
  return computeStatus(event, messages, now) === 'live'
}
```

`computeStatus` and `computeEffectiveEnd` are unchanged — the event itself still stays on the map while `extended` (chat-extended lifetime), it just loses the halo.

### 3. `src/screens/CreateSheet.tsx` — auto-set end time

**New behaviour:** Whenever `startTime` changes, `endTime` is automatically set to `startTime + 24 hours`.

```ts
useEffect(() => {
  const start = new Date(startTime)
  setEndTime(new Date(start.getTime() + 86400000).toISOString().slice(0, 16))
}, [startTime])
```

This runs on first render too, so the initial default is always exactly 24h ahead of the default start time.

### 4. `src/screens/CreateSheet.tsx` — end time minimum constraint

**New behaviour:** The `datetime-local` input for end time gets `min={startTime}`, preventing the browser from allowing a value earlier than start.

```tsx
<input type="datetime-local" value={endTime} min={startTime} onChange={...} />
```

The existing submit-time guard (`if (end <= start)`) is kept as defense-in-depth.

## Files Changed

| File | Change |
|---|---|
| `src/lib/supabase.ts` | Replace `start_time` range with overlap filter in `getEvents` |
| `src/lib/eventStatus.ts` | `isCurrentlyLive` returns true only for `'live'` |
| `src/screens/CreateSheet.tsx` | Add `useEffect` for auto-end + `min` on end input |

## What Is NOT Changing

- `computeStatus`, `computeEffectiveEnd` — chat-based lifetime extension logic untouched
- `dayOffset` parameter and timeline UI in `MapScreen` — still work, now semantically correct
- `isOnDay` helper in `supabase.ts` — unused after this change, can be removed in a separate cleanup
- Submit validation in `CreateSheet` — kept as-is
- All other event query conditions (status filter, geographic bbox, ordering)
