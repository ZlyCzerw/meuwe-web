# Pin Spread On Click Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a pin that overlaps other pins on screen centres the map on it and flies to the closest zoom that still frames the whole overlap chain, instead of opening the event.

**Architecture:** A new pure module `src/lib/pinOverlap.ts` decides, in pixel space, which pins overlap the tapped one (transitive chain, clipped to the viewport). `MapScreen` gains one function `spreadOrOpen()` that projects pins to pixels, asks that module for the chain, and hands the chain's bounds to Leaflet's `map.getBoundsZoom()`. When zooming cannot help, it falls through to the existing open behaviour. Same-zone clustering (`eventClusters.ts`, `clusterHTML`, `EventPickerModal`) is untouched.

**Tech Stack:** TypeScript, React, Leaflet 1.9.4, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-pin-spread-on-click-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/pinOverlap.ts` (create) | Pure pixel-space geometry: do two pin boxes intersect, and which pins form the tapped pin's in-view overlap chain. No Leaflet, no DOM. |
| `src/lib/pinOverlap.test.ts` (create) | Unit tests for the above - plain numbers in, indices out. |
| `src/screens/MapScreen.tsx` (modify) | `spreadOrOpen()` plus two call sites in the pin effect. Leaflet lives only here. |

---

### Task 1: Pin box intersection

**Files:**
- Create: `src/lib/pinOverlap.ts`
- Test: `src/lib/pinOverlap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/pinOverlap.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pinsOverlap } from './pinOverlap'

describe('pinsOverlap', () => {
  it('identical positions overlap', () => {
    expect(pinsOverlap({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(true)
  })

  it('43 px apart horizontally still overlaps, 44 px does not', () => {
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 43, y: 0 })).toBe(true)
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 44, y: 0 })).toBe(false)
  })

  it('55 px apart vertically still overlaps, 56 px does not', () => {
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 0, y: 55 })).toBe(true)
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 0, y: 56 })).toBe(false)
  })

  it('is symmetric and sign-independent', () => {
    expect(pinsOverlap({ x: 0, y: 0 }, { x: -43, y: -55 })).toBe(true)
    expect(pinsOverlap({ x: -43, y: -55 }, { x: 0, y: 0 })).toBe(true)
  })

  it('clear of each other on one axis is enough to not overlap', () => {
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 10, y: 200 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/pinOverlap.test.ts
```

Expected: FAIL — `Failed to resolve import "./pinOverlap"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/pinOverlap.ts`:

```ts
// Screen-space overlap between map pins. Pure pixel geometry: it takes points
// already projected by the caller, so it needs neither Leaflet nor a DOM and
// its tests are plain numbers.
//
// Same-zone stacking is a different problem with a different answer - see
// eventClusters.ts, which collapses public events sharing a 3x3 m zone into one
// badged pin regardless of zoom. This module is about pins that are genuinely
// apart on the ground but land on the same patch of screen.

export interface PinPoint {
  x: number
  y: number
}

// The icon box from MapScreen's L.divIcon: 44x56 with a [22, 56] anchor. Points
// coming in are anchor positions, so comparing anchors compares boxes.
const PIN_W = 44
const PIN_H = 56

/** True when two pins' icon boxes intersect at the zoom the points came from. */
export function pinsOverlap(a: PinPoint, b: PinPoint): boolean {
  return Math.abs(a.x - b.x) < PIN_W && Math.abs(a.y - b.y) < PIN_H
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/pinOverlap.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pinOverlap.ts src/lib/pinOverlap.test.ts
git commit -m "Tell when two map pins share the same patch of screen"
```

---

### Task 2: In-view overlap chain

**Files:**
- Modify: `src/lib/pinOverlap.ts`
- Test: `src/lib/pinOverlap.test.ts`

- [ ] **Step 1: Write the failing test**

Widen the existing import at the top of `src/lib/pinOverlap.test.ts`:

```ts
import { pinsOverlap, overlapChainInView } from './pinOverlap'
```

Then append to the same file:

```ts
const VIEW = { x: 400, y: 800 }

describe('overlapChainInView', () => {
  it('a lone pin returns just itself', () => {
    expect(overlapChainInView([{ x: 0, y: 0 }], 0, VIEW)).toEqual([0])
  })

  it('a neighbour in view but clear of the box is not in the chain', () => {
    // 100 px is well inside the 400-wide frame, so this isolates "no overlap"
    // from "out of view".
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    expect(overlapChainInView(pts, 0, VIEW)).toEqual([0])
  })

  it('follows the chain transitively even when the ends do not overlap', () => {
    // A-B-C each 30 px apart: A and C are 60 px apart and do not overlap,
    // but C is still reachable through B.
    const pts = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }]
    expect(overlapChainInView(pts, 0, VIEW).sort()).toEqual([0, 1, 2])
  })

  it('drops chain members that fall outside the viewport', () => {
    // A tail of pins 30 px apart running off past the frame edge. The viewport
    // is 400 wide, so centred on A it reaches x = 200; the pin at 210 is out.
    const pts = [
      { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }, { x: 90, y: 0 },
      { x: 120, y: 0 }, { x: 150, y: 0 }, { x: 180, y: 0 }, { x: 210, y: 0 },
    ]
    const chain = overlapChainInView(pts, 0, VIEW)
    expect(chain).not.toContain(7)
    expect(chain.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('clips vertically too', () => {
    // A short frame: 200 tall, so centred on A it reaches y = 100. The pins are
    // 50 px apart, close enough to chain, so only the frame can stop the walk.
    const short = { x: 400, y: 200 }
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 0, y: 100 }, { x: 0, y: 150 }]
    const chain = overlapChainInView(pts, 0, short)
    expect(chain).not.toContain(3)
    expect(chain.sort((a, b) => a - b)).toEqual([0, 1, 2])
  })

  it('always includes the clicked pin even when it is off-centre in the data', () => {
    const pts = [{ x: 1000, y: 1000 }, { x: 0, y: 0 }, { x: 20, y: 0 }]
    expect(overlapChainInView(pts, 1, VIEW).sort()).toEqual([1, 2])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/pinOverlap.test.ts
```

Expected: FAIL — `overlapChainInView is not a function` (or an import error).

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/pinOverlap.ts`:

```ts
/**
 * The transitive overlap chain containing `clickedIdx`, restricted to pins that
 * fall inside the viewport once it is centred on the clicked pin.
 *
 * Points are container pixels at the CURRENT zoom, so the clipping rectangle is
 * the frame as it would look after centring but before flying. Clipping at the
 * destination zoom would be circular: the destination is what the chain is being
 * computed to determine.
 *
 * Breadth-first from the clicked pin, so a pin joins only if something already
 * in the chain overlaps it. Returns indices into `points`, clicked pin first.
 */
export function overlapChainInView(
  points: PinPoint[],
  clickedIdx: number,
  viewSize: { x: number; y: number },
): number[] {
  const origin = points[clickedIdx]
  const halfW = viewSize.x / 2
  const halfH = viewSize.y / 2
  const inView = (p: PinPoint) =>
    Math.abs(p.x - origin.x) <= halfW && Math.abs(p.y - origin.y) <= halfH

  const chain = [clickedIdx]
  const seen = new Set([clickedIdx])
  for (let head = 0; head < chain.length; head++) {
    const cur = points[chain[head]]
    for (let i = 0; i < points.length; i++) {
      if (seen.has(i)) continue
      if (!inView(points[i])) continue
      if (!pinsOverlap(cur, points[i])) continue
      seen.add(i)
      chain.push(i)
    }
  }
  return chain
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/pinOverlap.test.ts
```

Expected: PASS, 11 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pinOverlap.ts src/lib/pinOverlap.test.ts
git commit -m "Walk the chain of pins piled on top of a tapped one"
```

---

### Task 3: Spread instead of opening

**Files:**
- Modify: `src/screens/MapScreen.tsx` (import near line 24; new function before the pin effect at line ~449; two `onClick` call sites at lines ~467 and ~486)

- [ ] **Step 1: Add the import**

In `src/screens/MapScreen.tsx`, next to the existing `clusterPublicEvents` import:

```ts
import { clusterPublicEvents } from '../lib/eventClusters'
import { overlapChainInView } from '../lib/pinOverlap'
```

- [ ] **Step 2: Add `spreadOrOpen`**

Insert immediately before the `// Pins — update on events change.` comment block that opens the pin `useEffect`:

```ts
  /**
   * A tap on a pin buried under its neighbours spreads them out instead of
   * opening anything: centre on the tapped pin, fly to the closest zoom that
   * still frames its whole overlap chain, and let the user tap again once the
   * pins have separated.
   *
   * `open` is the fall-through for every case where zooming would not help -
   * nothing overlaps, or the map is already as close as it goes. Without it a
   * pin that no zoom can separate (two private events at one address share
   * exact coordinates, and private events never go through clusterPublicEvents)
   * would be permanently unopenable.
   *
   * The zoom comes from getBoundsZoom, which frames the chain rather than
   * measuring the gaps inside it - see the spec for why that trade was taken.
   */
  function spreadOrOpen(
    id: string,
    all: Record<string, { lat: number; lng: number }>,
    open: () => void,
  ) {
    const map = leafRef.current
    if (!map) { open(); return }
    const ids = Object.keys(all)
    const clickedIdx = ids.indexOf(id)
    if (clickedIdx < 0) { open(); return }

    const points = ids.map(k => {
      const p = map.latLngToContainerPoint([all[k].lat, all[k].lng])
      return { x: p.x, y: p.y }
    })
    const size = map.getSize()
    const chain = overlapChainInView(points, clickedIdx, { x: size.x, y: size.y })
    if (chain.length < 2) { open(); return }

    // Mirrored about the tapped pin: the map centres on it, so the frame has to
    // reach as far on the empty side as on the crowded one.
    const origin = all[id]
    const bounds = L.latLngBounds([[origin.lat, origin.lng]])
    chain.forEach(i => {
      const q = all[ids[i]]
      bounds.extend([q.lat, q.lng])
      bounds.extend([2 * origin.lat - q.lat, 2 * origin.lng - q.lng])
    })

    const target = map.getBoundsZoom(bounds, false, L.point(40, 40))
    if (target <= map.getZoom()) { open(); return }
    flyAdopting(map, origin.lat, origin.lng, target, 0.7)
  }
```

- [ ] **Step 3: Route the private-pin tap through it**

Replace the private-event `onClick` (currently `onClick: () => onOpenEvent(ev),`):

```ts
        onClick: () => spreadOrOpen(ev.id, desired, () => onOpenEvent(ev)),
```

`desired` is the same object the effect is still filling in; by the time a tap
fires it holds every rendered pin, and the effect rebinds handlers on each run
so the closure is never stale.

- [ ] **Step 4: Route the public-pin tap through it**

Replace the public-event `onClick`:

```ts
        onClick: () => spreadOrOpen(rep.id, desired, () => {
          if (group.length >= 2) setPickerEvents(group)
          else onOpenEvent(rep)
        }),
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc -b
```

Expected: no output (clean build). Cloudflare's build is stricter than the dev
server, so `tsc -b` is the gate, not `--noEmit`.

- [ ] **Step 6: Run the full test suite**

```bash
npx vitest run
```

Expected: PASS. The existing `MapScreen` tests must be unaffected — a pin with
no overlapping neighbours returns a chain of length 1 and falls straight through
to `open()`.

- [ ] **Step 7: Commit**

```bash
git add src/screens/MapScreen.tsx
git commit -m "Spread piled-up pins on tap instead of opening a guess"
```

---

### Task 4: Verify in the running app

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server**

Use the preview tooling (`preview_start`), not a bare shell command.

- [ ] **Step 2: Check the overlapping case**

Zoom out to roughly city level (z12–13) over an area with several events. Tap a
pin that visibly sits on top of others.

Expected: the map centres on that pin and flies in; no half-sheet opens; the
neighbouring pins separate.

- [ ] **Step 3: Check the isolated case**

Tap a pin that stands alone with no neighbour within ~44 px.

Expected: the half-sheet opens immediately, exactly as before. No zoom movement.

- [ ] **Step 4: Check the safety valve**

Zoom to maximum (19) on a pin that still overlaps another.

Expected: the tap opens the half-sheet rather than doing nothing.

- [ ] **Step 5: Check the same-zone cluster is unchanged**

Tap a pin carrying a count badge.

Expected: `EventPickerModal` opens with the list, as before — unless that badged
pin also overlaps a separate pin on screen, in which case the first tap spreads
and the second opens the picker.

- [ ] **Step 6: Check the console**

Read console messages and dev-server logs.

Expected: no new errors or warnings.
