# Pin Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve map pins as interaction counts grow, with real-time live updates and a one-shot Pokémon-style flash animation when crossing tier thresholds.

**Architecture:** Static tier state is encoded in Leaflet divIcon HTML strings (rebuilt on every `visibleEvents` change); one-shot flash animations run in a separate React overlay positioned via `latLngToContainerPoint`; interaction counts are kept live by Supabase Realtime subscriptions with local-increment (no full reload).

**Tech Stack:** React 18, Leaflet divIcon, Supabase Realtime (`postgres_changes`), Vitest, `npx tsc -b`

---

## File Map

| File | Change |
|------|--------|
| `src/components/mapIcons.ts` | Export `getTier()`; extend `pinHTML()` with `tier`/`count` params, new HTML for tiers 1–2, return `{html,iconSize,iconAnchor}` |
| `src/components/mapIcons.test.ts` | New: unit tests for `getTier` and `pinHTML` |
| `src/lib/supabase.ts` | Add `db.subscribeFollows(cb)` |
| `src/hooks/useEvents.ts` | Add `subscribeAllMessages` + `subscribeFollows` for local-increment |
| `src/components/ConfettiBurst.tsx` | Change `position:fixed` → `position:absolute` so it renders relative to overlay parent |
| `src/components/PinFlashOverlay.tsx` | New: one-shot flash overlay at screen coordinates |
| `src/screens/MapScreen.tsx` | `prevTierMapRef`, `flashOverlays` state, tier-crossing detection, render `<PinFlashOverlay>` |

---

## Reference: Key Dimensions

```
size (circle diameter D) = 44px
sealS (seal SVG)         = 64px  (D × 1.46)
crownH                   = 23px  (D × 0.52)
crownGap                 = 16px  (crownH × 0.7)

Seal centered on circle center (y=22 in container):
  seal top = 22 - 64/2 = -10px  (overflows above, visible via overflow:visible)

Crown bottom = seal top - crownGap = -10 - 16 = -26px
Crown top    = crown bottom - crownH = -26 - 23 = -49px  (overflows above)

Tier 0: iconSize [44, 56], iconAnchor [22, 56]   — blob, unchanged
Tier 1: iconSize [44, 82], iconAnchor [22, 56]   — circle + seal + badge
Tier 2: iconSize [44, 82], iconAnchor [22, 56]   — + crown (overflow:visible above)

In 82px container, tail dot at bottom:28px puts it at y=42→54 — same as tier 0's bottom:2px in 56px container.
Anchor stays at y=56 across all tiers.
```

---

## Task 1: `getTier` + updated `pinHTML` in `mapIcons.ts`

**Files:**
- Modify: `src/components/mapIcons.ts`
- Create: `src/components/mapIcons.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/mapIcons.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getTier, pinHTML } from './mapIcons'

describe('getTier', () => {
  it('returns 0 for 0–9', () => {
    expect(getTier(0)).toBe(0)
    expect(getTier(9)).toBe(0)
  })
  it('returns 1 for 10–99', () => {
    expect(getTier(10)).toBe(1)
    expect(getTier(99)).toBe(1)
  })
  it('returns 2 for 100+', () => {
    expect(getTier(100)).toBe(2)
    expect(getTier(999)).toBe(2)
  })
})

describe('pinHTML tier 0', () => {
  it('returns 44×56 iconSize and anchor, no seal/badge', () => {
    const { iconSize, iconAnchor, html } = pinHTML('party', 0, 0, 0)
    expect(iconSize).toEqual([44, 56])
    expect(iconAnchor).toEqual([22, 56])
    expect(html).not.toContain('M50.0 2.0') // no seal path
    expect(html).not.toContain('M4 28')     // no crown path
  })
})

describe('pinHTML tier 1', () => {
  it('returns 44×82 iconSize, seal present, badge with count', () => {
    const { iconSize, iconAnchor, html } = pinHTML('sport', 0, 1, 10)
    expect(iconSize).toEqual([44, 82])
    expect(iconAnchor).toEqual([22, 56])
    expect(html).toContain('M50.0 2.0') // seal path present
    expect(html).not.toContain('M4 28') // no crown
    expect(html).toContain('>10<')      // badge text
  })
  it('caps badge at 200+', () => {
    const { html } = pinHTML('party', 0, 1, 250)
    expect(html).toContain('>200+<')
  })
})

describe('pinHTML tier 2', () => {
  it('returns 44×82 iconSize, seal + crown + badge', () => {
    const { iconSize, iconAnchor, html } = pinHTML('culture', 1, 2, 100)
    expect(iconSize).toEqual([44, 82])
    expect(iconAnchor).toEqual([22, 56])
    expect(html).toContain('M50.0 2.0') // seal
    expect(html).toContain('M4 28')     // crown path
    expect(html).toContain('>100<')     // badge
  })
  it('shows inner ring for tier 2', () => {
    const { html } = pinHTML('outdoor', 0, 2, 120)
    expect(html).toContain('opacity:0.22') // inner ring
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/mapIcons.test.ts
```
Expected: FAIL — `getTier is not exported`, `pinHTML` signature mismatch.

- [ ] **Step 3: Implement `getTier` and updated `pinHTML`**

Replace the contents of `src/components/mapIcons.ts` with:

```ts
import { BLOBS, TAG_META, C, type Category } from '../lib/tokens'
import { isCurrentlyLive } from '../lib/eventStatus'

export function getTier(n: number): 0 | 1 | 2 {
  if (n >= 100) return 2
  if (n >= 10)  return 1
  return 0
}

const SEAL_PATH = 'M50.0 2.0 L58.0 9.8 L68.4 5.7 L72.8 15.9 L83.9 16.1 L84.1 27.2 L94.3 31.6 L90.2 42.0 L98.0 50.0 L90.2 58.0 L94.3 68.4 L84.1 72.8 L83.9 83.9 L72.8 84.1 L68.4 94.3 L58.0 90.2 L50.0 98.0 L42.0 90.2 L31.6 94.3 L27.2 84.1 L16.1 83.9 L15.9 72.8 L5.7 68.4 L9.8 58.0 L2.0 50.0 L9.8 42.0 L5.7 31.6 L15.9 27.2 L16.1 16.1 L27.2 15.9 L31.6 5.7 L42.0 9.8 Z'

export function pinHTML(
  category: string,
  idx: number,
  tier: 0 | 1 | 2,
  count: number,
  _dbStatus?: string,
  startTime?: string,
  endTime?: string,
): { html: string; iconSize: [number, number]; iconAnchor: [number, number] } {
  const meta = TAG_META[category as Category] || TAG_META.party
  const isLive = startTime && endTime
    ? isCurrentlyLive({ start_time: startTime, end_time: endTime })
    : false

  if (tier === 0) {
    const path = BLOBS[idx % BLOBS.length]
    const halos = isLive ? `
      <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${meta.color};animation:halo 2.8s ease-out infinite;opacity:0;pointer-events:none"></div>
      <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${meta.color};animation:halo 2.8s 1.4s ease-out infinite;opacity:0;pointer-events:none"></div>
    ` : ''
    const html = `<div style="position:relative;width:44px;height:56px;">
      ${halos}
      <svg width="44" height="44" viewBox="-3 -3 106 106" style="overflow:visible;filter:drop-shadow(0 3px 0 #2D2B2A22)">
        <path d="${path}" fill="${meta.color}" stroke="#2D2B2A" stroke-width="5" stroke-linejoin="round"/>
      </svg>
      <div style="position:absolute;top:10px;left:0;width:44px;display:flex;align-items:center;justify-content:center;font-size:18px;pointer-events:none">${meta.glyph}</div>
      <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:${meta.color};border:2.5px solid #2D2B2A"></div>
    </div>`
    return { html, iconSize: [44, 56], iconAnchor: [22, 56] }
  }

  const badgeText = count >= 200 ? '200+' : String(count)
  const halos = isLive ? `
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${meta.color};animation:halo 2.8s ease-out infinite;opacity:0;pointer-events:none;z-index:1"></div>
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${meta.color};animation:halo 2.8s 1.4s ease-out infinite;opacity:0;pointer-events:none;z-index:1"></div>
  ` : ''

  const crown = tier === 2 ? `
    <div style="position:absolute;top:-49px;left:8px;z-index:5">
      <svg width="28" height="23" viewBox="0 0 40 32" style="display:block">
        <path d="M4 28 L4 12 L13 20 L20 6 L27 20 L36 12 L36 28 Z"
              fill="${C.sunshine}" stroke="#2D2B2A" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="20" cy="6" r="2.6" fill="${C.berry}" stroke="#2D2B2A" stroke-width="2"/>
      </svg>
    </div>
  ` : ''

  const innerRing = tier === 2
    ? `<div style="position:absolute;inset:4px;border-radius:50%;border:2px solid #2D2B2A;opacity:0.22;pointer-events:none"></div>`
    : ''

  const html = `<div style="position:relative;width:44px;height:82px;">
    ${halos}
    ${crown}
    <svg style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;overflow:visible;filter:drop-shadow(0 2px 0 rgba(45,43,42,0.13));z-index:2" viewBox="0 0 100 100">
      <path d="${SEAL_PATH}" fill="#fff" stroke="#2D2B2A" stroke-width="3" stroke-linejoin="round"/>
    </svg>
    <div style="position:absolute;top:0;left:0;width:44px;height:44px;border-radius:50%;background:${meta.color};border:3px solid #2D2B2A;box-shadow:0 4px 0 rgba(45,43,42,0.2);display:flex;align-items:center;justify-content:center;z-index:3">
      ${innerRing}
      <div style="font-size:22px;color:#2D2B2A;line-height:1;display:flex">${meta.glyph}</div>
    </div>
    <div style="position:absolute;bottom:28px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:${meta.color};border:2.5px solid #2D2B2A;z-index:3"></div>
    <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;background:#fff;border:2px solid #2D2B2A;box-shadow:0 2px 0 rgba(45,43,42,0.2);font-size:11px;font-weight:900;color:#2D2B2A;white-space:nowrap;z-index:4;font-family:system-ui,sans-serif;">
      <svg width="11" height="11" viewBox="0 0 16 16" style="display:block"><path d="M3 3 H13 a1.4 1.4 0 0 1 1.4 1.4 V10 a1.4 1.4 0 0 1 -1.4 1.4 H7 L4 14 V11.4 H3 A1.4 1.4 0 0 1 1.6 10 V4.4 A1.4 1.4 0 0 1 3 3 Z" fill="${meta.color}" stroke="#2D2B2A" stroke-width="1.6" stroke-linejoin="round"/></svg>
      ${badgeText}
    </div>
  </div>`
  return { html, iconSize: [44, 82], iconAnchor: [22, 56] }
}

export function meHTML(): string {
  return `<div style="position:relative;width:72px;height:72px">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <div style="width:42px;height:42px;border-radius:50%;border:2px solid #FF7A45;animation:halo 2.8s ease-out infinite;opacity:0"></div>
    </div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <div style="width:42px;height:42px;border-radius:50%;border:2px solid #FF7A45;animation:halo 2.8s 1.4s ease-out infinite;opacity:0"></div>
    </div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;animation:breathe-sm 3s ease-in-out infinite">
      <div style="width:26px;height:26px;border-radius:52% 48% 50% 50%/50% 52% 48% 50%;background:#FF7A45;border:3px solid #2D2B2A;box-shadow:0 3px 0 #2D2B2A33"></div>
    </div>
  </div>`
}
```

- [ ] **Step 4: Run tests and TypeScript check**

```bash
npx vitest run src/components/mapIcons.test.ts
npx tsc -b
```
Expected: all tests PASS; no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/mapIcons.ts src/components/mapIcons.test.ts
git commit -m "feat(pins): add getTier + tier-aware pinHTML with seal/crown/badge"
```

---

## Task 2: `db.subscribeFollows` in `supabase.ts`

**Files:**
- Modify: `src/lib/supabase.ts`
- Modify: `src/lib/supabase.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/supabase.test.ts`:

```ts
describe('db.subscribeFollows', () => {
  it('is defined on db', () => {
    expect(typeof db.subscribeFollows).toBe('function')
  })

  it('returns an object with unsubscribe (duck-type: has .unsubscribe)', () => {
    // We only test the shape because actual Supabase channels need a live connection.
    // subscribeFollows accepts a callback and returns a RealtimeChannel.
    const noop = () => {}
    const chan = db.subscribeFollows(noop)
    // Supabase RealtimeChannel has an `unsubscribe` method
    expect(typeof chan.unsubscribe).toBe('function')
    chan.unsubscribe()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/supabase.test.ts
```
Expected: FAIL — `subscribeFollows is not a function`.

- [ ] **Step 3: Add `subscribeFollows` to `src/lib/supabase.ts`**

Inside the `db` object, directly after `subscribeAllMessages`:

```ts
  subscribeFollows(cb: (row: { event_id: string }, type: 'INSERT' | 'DELETE') => void) {
    return supabase.channel('follows:all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_follows' },
          (p: any) => cb(p.new, 'INSERT'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_follows' },
          (p: any) => cb(p.old, 'DELETE'))
      .subscribe()
  },
```

Note: `event_follows` has `PRIMARY KEY (user_id, event_id)`. With Supabase's default replica identity, `p.old.event_id` is available on DELETE because `event_id` is part of the PK.

- [ ] **Step 4: Run tests and TypeScript check**

```bash
npx vitest run src/lib/supabase.test.ts
npx tsc -b
```
Expected: PASS, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase.test.ts
git commit -m "feat(realtime): add subscribeFollows to db client"
```

---

## Task 3: Live interaction tracking in `useEvents`

**Files:**
- Modify: `src/hooks/useEvents.ts`

No new test file needed — interaction tracking uses the same `setEvents` path that existing tests cover indirectly. The logic is straightforward enough to verify via integration.

- [ ] **Step 1: Update `src/hooks/useEvents.ts`**

Replace the file contents with:

```ts
import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../lib/supabase'
import type { EventWithMeta } from '../lib/types'

export function useEvents(pos: { lat: number; lng: number } | null, dayOffset: number, refreshKey = 0, km = 15) {
  const [events, setEvents] = useState<EventWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const chanRef     = useRef<ReturnType<typeof db.subscribeEvents> | null>(null)
  const msgChanRef  = useRef<ReturnType<typeof db.subscribeAllMessages> | null>(null)
  const followChanRef = useRef<ReturnType<typeof db.subscribeFollows> | null>(null)

  // Round to 4 decimal places (~11m) to avoid refetching on tiny GPS jitter
  const lat = pos != null ? Math.round(pos.lat * 1e4) / 1e4 : null
  const lng = pos != null ? Math.round(pos.lng * 1e4) / 1e4 : null

  const load = useCallback(async () => {
    if (lat === null || lng === null) return
    const data = await db.getEvents(lat, lng, km, dayOffset)
    setEvents(data)
    setLoading(false)
  }, [lat, lng, dayOffset, km])

  // reload whenever load changes OR refreshKey bumps
  useEffect(() => { load() }, [load, refreshKey])

  // auto-refresh every 5 minutes so ended events disappear without user action
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  // full-reload subscription (new events created nearby)
  useEffect(() => {
    if (lat === null || lng === null) return
    db.unsub(chanRef.current)
    chanRef.current = db.subscribeEvents(() => load())
    return () => db.unsub(chanRef.current)
  }, [lat, lng, load])

  // local-increment subscriptions — no full reload, just bump interactionCount
  useEffect(() => {
    if (lat === null || lng === null) return
    db.unsub(msgChanRef.current)
    db.unsub(followChanRef.current)

    msgChanRef.current = db.subscribeAllMessages(msg => {
      setEvents(prev => prev.map(e =>
        e.id === msg.event_id
          ? { ...e, interactionCount: (e.interactionCount ?? 0) + 1 }
          : e
      ))
    })

    followChanRef.current = db.subscribeFollows((row, type) => {
      setEvents(prev => prev.map(e =>
        e.id === row.event_id
          ? { ...e, interactionCount: Math.max(0, (e.interactionCount ?? 0) + (type === 'INSERT' ? 1 : -1)) }
          : e
      ))
    })

    return () => {
      db.unsub(msgChanRef.current)
      db.unsub(followChanRef.current)
    }
  }, [lat, lng])

  return { events, loading }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc -b
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useEvents.ts
git commit -m "feat(realtime): live-increment interactionCount on messages and follows"
```

---

## Task 4: Fix `ConfettiBurst` positioning

**Files:**
- Modify: `src/components/ConfettiBurst.tsx`

The component currently uses `position:fixed` which pins confetti to the screen center. When used inside `PinFlashOverlay` (which is already positioned at the pin's screen coordinates), it must be `position:absolute` so it renders relative to the overlay container.

- [ ] **Step 1: Change positioning in `src/components/ConfettiBurst.tsx`**

Change line 15:
```ts
// Before:
<div style={{ position: 'fixed', left: '50%', top: '50%', pointerEvents: 'none', zIndex: 200 }}>
// After:
<div style={{ position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none', zIndex: 200 }}>
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ConfettiBurst.tsx
git commit -m "fix(confetti): use position:absolute so it renders relative to overlay container"
```

---

## Task 5: New `PinFlashOverlay` component

**Files:**
- Create: `src/components/PinFlashOverlay.tsx`

A one-shot React component that fires at screen coordinates. It auto-removes after 850ms via `onDone`. The CSS keyframes are injected inline — harmless if multiple overlays exist simultaneously.

- [ ] **Step 1: Create `src/components/PinFlashOverlay.tsx`**

```tsx
import { useEffect } from 'react'
import { C } from '../lib/tokens'
import ConfettiBurst from './ConfettiBurst'

interface Props {
  x: number
  y: number
  tier: 1 | 2
  color: string
  onDone: () => void
}

const D = 44

export default function PinFlashOverlay({ x, y, tier, color, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 850)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // empty deps: timer fires once on mount; onDone captured in closure is stable
  // because setFlashOverlays is a stable React dispatch and o.id never changes.

  const ringColor = tier === 2 ? C.sunshine : color

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 0,
      height: 0,
      pointerEvents: 'none',
      zIndex: 500,
    }}>
      <style>{`
        @keyframes evo-flashcore {
          0%{opacity:0;transform:scale(.6)} 25%{opacity:.95} 100%{opacity:0;transform:scale(1.9)}
        }
        @keyframes evo-flashring {
          0%{transform:scale(.4);opacity:.7} 100%{transform:scale(2.6);opacity:0}
        }
        @media (prefers-reduced-motion:reduce) {
          .evo-flash-el { animation: none !important; }
        }
      `}</style>
      {/* white core burst */}
      <div className="evo-flash-el" style={{
        position: 'absolute',
        left: -D * 0.65,
        top: -D * 0.65,
        width: D * 1.3,
        height: D * 1.3,
        borderRadius: '50%',
        background: '#fff',
        animation: 'evo-flashcore 600ms ease-out forwards',
      }} />
      {/* ring 1 */}
      <div className="evo-flash-el" style={{
        position: 'absolute',
        left: -D / 2,
        top: -D / 2,
        width: D,
        height: D,
        borderRadius: '50%',
        border: `3px solid ${ringColor}`,
        animation: 'evo-flashring 800ms ease-out forwards',
      }} />
      {/* ring 2 (150ms delay) */}
      <div className="evo-flash-el" style={{
        position: 'absolute',
        left: -D / 2,
        top: -D / 2,
        width: D,
        height: D,
        borderRadius: '50%',
        border: `3px solid ${ringColor}`,
        animation: 'evo-flashring 800ms 150ms ease-out forwards',
      }} />
      <ConfettiBurst visible />
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc -b
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PinFlashOverlay.tsx
git commit -m "feat(pins): add PinFlashOverlay — one-shot flash animation at screen coords"
```

---

## Task 6: Wire everything in `MapScreen.tsx`

**Files:**
- Modify: `src/screens/MapScreen.tsx`

Four changes:
1. Import `getTier` and `PinFlashOverlay`
2. Add `prevTierMapRef` and `flashOverlays` state
3. Replace the pin-rendering effect with tier-aware version + tier-crossing detection
4. Render flash overlays

- [ ] **Step 1: Update imports**

Change the existing mapIcons import line:
```ts
// Before:
import { pinHTML, meHTML } from '../components/mapIcons'
// After:
import { pinHTML, meHTML, getTier } from '../components/mapIcons'
```

Add PinFlashOverlay import after the Avatar/AddButton imports:
```ts
import PinFlashOverlay from '../components/PinFlashOverlay'
```

- [ ] **Step 2: Add refs and state**

After the existing `const pinsRef = useRef(...)` line, add:

```ts
const prevTierMapRef = useRef<Record<string, 0 | 1 | 2>>({})
const [flashOverlays, setFlashOverlays] = useState<
  Array<{ id: string; x: number; y: number; tier: 1 | 2; color: string }>
>([])
```

Also add `useState` to the import if `flashOverlays` state is the first useState usage (it's not — `useState` is already imported on line 1).

- [ ] **Step 3: Replace the pin-rendering `useEffect`**

Find the useEffect at lines 221–239:
```ts
useEffect(() => {
  const map = leafRef.current
  if (!map) return
  Object.values(pinsRef.current).forEach(m => m.remove())
  pinsRef.current = {}
  visibleEvents.forEach((ev, i) => {
    const interactions = ev.interactionCount ?? 0
    const scale = 1 + Math.min(interactions, 100) / 100 * 0.5
    const icon = L.divIcon({
      html: pinHTML(ev.category, i, ev.status, ev.start_time, ev.end_time, scale),
      className: 'meuwe-icon',
      iconSize: [44, 56],
      iconAnchor: [22, 56],
    })
    const m = L.marker([ev.lat, ev.lng], { icon, zIndexOffset: interactions }).addTo(map)
    m.on('click', () => onOpenEvent(ev))
    pinsRef.current[ev.id] = m
  })
}, [visibleEvents])
```

Replace with:
```ts
useEffect(() => {
  const map = leafRef.current
  if (!map) return
  Object.values(pinsRef.current).forEach(m => m.remove())
  pinsRef.current = {}
  const newFlashes: Array<{ id: string; x: number; y: number; tier: 1 | 2; color: string }> = []

  visibleEvents.forEach((ev, i) => {
    const interactions = ev.interactionCount ?? 0
    const tier = getTier(interactions)
    const meta = TAG_META[ev.category as Category] || TAG_META.party
    const { html, iconSize, iconAnchor } = pinHTML(
      ev.category, i, tier, interactions, ev.status, ev.start_time, ev.end_time,
    )
    const icon = L.divIcon({ html, className: 'meuwe-icon', iconSize, iconAnchor })
    const m = L.marker([ev.lat, ev.lng], { icon, zIndexOffset: interactions }).addTo(map)
    m.on('click', () => onOpenEvent(ev))
    pinsRef.current[ev.id] = m

    // tier-crossing detection — suppress animation on first render
    if (prevTierMapRef.current[ev.id] === undefined) {
      prevTierMapRef.current[ev.id] = tier
    } else {
      const prev = prevTierMapRef.current[ev.id]
      if (tier > prev) {
        const pt = map.latLngToContainerPoint([ev.lat, ev.lng])
        newFlashes.push({
          id: `${ev.id}-${Date.now()}`,
          x: pt.x,
          y: pt.y,
          tier: tier as 1 | 2,
          color: meta.color,
        })
      }
      prevTierMapRef.current[ev.id] = tier
    }
  })

  if (newFlashes.length > 0) {
    setFlashOverlays(s => [...s, ...newFlashes])
  }
}, [visibleEvents]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Render flash overlays in JSX**

Inside the return JSX, after the `<div ref={mapRef} .../>` line:

```tsx
{/* Pin flash overlays — absolutely positioned over the map */}
{flashOverlays.map(o => (
  <PinFlashOverlay
    key={o.id}
    x={o.x}
    y={o.y}
    tier={o.tier}
    color={o.color}
    onDone={() => setFlashOverlays(s => s.filter(f => f.id !== o.id))}
  />
))}
```

The outermost `<div style={{ position: 'relative', width: '100%', height: '100%' }}>` already has `position:relative`, so `PinFlashOverlay`'s `position:absolute` with `latLngToContainerPoint` coordinates will be correct.

- [ ] **Step 5: TypeScript check and test run**

```bash
npx tsc -b
npx vitest run
```
Expected: no errors, all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/MapScreen.tsx
git commit -m "feat(pins): wire tier animations — prevTierRef + flashOverlays + PinFlashOverlay render"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 2: Smoke test in browser**

Start dev server:
```bash
npm run dev
```

Manual checks:
1. Open the map — tier 0 pins display as current blob shape (no badge).
2. Find or manually seed an event with ≥ 10 `interactionCount` — tier 1 pin shows white scalloped seal + badge.
3. Find or seed an event with ≥ 100 interactions — tier 2 pin shows crown above seal.
4. Open browser console — no errors about missing animations.
5. Send a message to a visible event in another tab → the `interactionCount` increments locally in the first tab (check with React DevTools or observe badge update if count crosses a tier threshold).
6. Manually set an event's `interactionCount` to 9 in another tab's Supabase session, then add a message → confirm the tier-1 flash fires on the map.

To seed interaction counts quickly for visual testing, run in Supabase SQL editor:
```sql
-- Temporarily set a specific event to tier 1
UPDATE events SET status='live' WHERE id='<event-id>';
-- Check interactions via:
SELECT * FROM get_event_interactions(ARRAY['<event-id>']::uuid[]);
```

- [ ] **Step 3: Final commit if any fixups needed**

```bash
git add -p
git commit -m "fix(pins): <describe any fixup>"
```

---

## Appendix: Crown & Seal Position Math

```
D = 44px (circle diameter)
sealS = 64px

Container 44×82px, anchor at y=56 from top.

In container:
  circle:  y=0..44, center y=22
  seal:    top = 22 - 64/2 = -10px  (overflow above)
  dot:     bottom:28px → top=42px, center y=48  (same as tier-0's bottom:2px in 56px)
  badge:   bottom:2px, height≈18px → top≈62px  (6px below anchor)

Crown (tier 2):
  crownH = 23px, crownGap = 16px
  crownBottom = sealTop - crownGap = -10 - 16 = -26px
  crownTop    = crownBottom - crownH = -26 - 23 = -49px  ← position:absolute;top:-49px
  crownWidth  = 28px  → center: left = (44-28)/2 = 8px
```
