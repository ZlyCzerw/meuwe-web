# Same-Zone Pin Clustering + Event Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When multiple public events share a 3x3 m zone on the viewed day, show one map pin with a comic circle count badge; tapping it opens a "choose event" modal whose selection opens the normal event half-sheet.

**Architecture:** Pure clustering (`eventClusters.ts`) groups public events by the 3x3 m zone rule (reusing `zonesOverlapSpatially`). `MapScreen` renders private events individually (unchanged) and one marker per public cluster - a plain pin for singletons, a `clusterHTML` pin+badge for size >= 2 that opens `EventPickerModal`. The picker reuses `pinHTML` for row icons and `onOpenEvent` for the half-sheet.

**Tech Stack:** React + TypeScript, Leaflet (divIcon HTML markers), react-i18next, vitest.

**Reference spec:** `docs/superpowers/specs/2026-07-14-pin-clustering-picker-design.md`

---

## File Structure

- Create `src/lib/eventClusters.ts` - `clusterPublicEvents` + `formatClusterCount`.
- Create `src/lib/eventClusters.test.ts` - vitest unit tests.
- Modify `src/components/mapIcons.ts` - add `clusterHTML(...)`.
- Create `src/components/EventPickerModal.tsx` - the picker modal.
- Modify `src/locales/{pl,en,es,de}.ts` - add `picker` block.
- Modify `src/screens/MapScreen.tsx` - cluster-aware markers + picker state.

---

## Task 1: Clustering logic + count formatter (TDD)

**Files:**
- Create: `src/lib/eventClusters.ts`
- Test: `src/lib/eventClusters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/eventClusters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { clusterPublicEvents, formatClusterCount } from './eventClusters'
import type { EventWithMeta } from './types'

let idc = 0
function ev(over: Partial<EventWithMeta> = {}): EventWithMeta {
  return {
    id: `e${idc++}`,
    lat: 50.0, lng: 22.0,
    start_time: '2026-07-14T10:00:00.000Z',
    end_time: '2026-07-14T12:00:00.000Z',
    is_private: false,
    ...over,
  } as EventWithMeta
}
const DLAT_2M = 2 / 111320
const DLNG_10M = 10 / (111320 * Math.cos((50 * Math.PI) / 180))

describe('clusterPublicEvents', () => {
  it('single event -> one cluster of size 1', () => {
    const c = clusterPublicEvents([ev()])
    expect(c).toHaveLength(1)
    expect(c[0]).toHaveLength(1)
  })

  it('three same-zone events -> one cluster, representative earliest by start', () => {
    const a = ev({ id: 'a', start_time: '2026-07-14T14:00:00.000Z', end_time: '2026-07-14T16:00:00.000Z' })
    const b = ev({ id: 'b', lat: 50.0 + DLAT_2M, start_time: '2026-07-14T10:00:00.000Z', end_time: '2026-07-14T12:00:00.000Z' })
    const c2 = ev({ id: 'c', lat: 50.0 - DLAT_2M, start_time: '2026-07-14T12:00:00.000Z', end_time: '2026-07-14T13:00:00.000Z' })
    const cl = clusterPublicEvents([a, b, c2])
    expect(cl).toHaveLength(1)
    expect(cl[0]).toHaveLength(3)
    expect(cl[0][0].id).toBe('b') // earliest start (10:00) is the representative
  })

  it('two far-apart events -> two clusters', () => {
    const cl = clusterPublicEvents([ev({ id: 'a' }), ev({ id: 'b', lng: 22.0 + DLNG_10M })])
    expect(cl).toHaveLength(2)
    expect(cl.every(c => c.length === 1)).toBe(true)
  })

  it('private events are excluded from clustering', () => {
    const cl = clusterPublicEvents([ev({ id: 'a' }), ev({ id: 'p', is_private: true })])
    expect(cl).toHaveLength(1)
    expect(cl[0].map(e => e.id)).toEqual(['a'])
  })
})

describe('formatClusterCount', () => {
  it('1..9 -> the number', () => {
    expect(formatClusterCount(1)).toBe('1')
    expect(formatClusterCount(9)).toBe('9')
  })
  it('>9 -> ">9"', () => {
    expect(formatClusterCount(10)).toBe('>9')
    expect(formatClusterCount(42)).toBe('>9')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eventClusters.test.ts`
Expected: FAIL - `Failed to resolve import "./eventClusters"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/eventClusters.ts`:

```ts
import { zonesOverlapSpatially } from './zoneConflict'
import type { EventWithMeta } from './types'

// Group PUBLIC events that share a 3x3 m zone into clusters. Private events are
// filtered out here (clustering is public-only). Each cluster is sorted by
// start_time ascending, so cluster[0] is the current-or-next representative.
// Single-pass anchor sweep: real data places same-venue events at identical
// coordinates, so transitive chaining is a non-issue.
export function clusterPublicEvents(events: EventWithMeta[]): EventWithMeta[][] {
  const pub = events.filter(e => !e.is_private)
  const used = new Array(pub.length).fill(false)
  const clusters: EventWithMeta[][] = []
  for (let i = 0; i < pub.length; i++) {
    if (used[i]) continue
    used[i] = true
    const anchor = pub[i]
    const group = [anchor]
    for (let j = i + 1; j < pub.length; j++) {
      if (used[j]) continue
      if (zonesOverlapSpatially(anchor, pub[j])) {
        used[j] = true
        group.push(pub[j])
      }
    }
    group.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    clusters.push(group)
  }
  return clusters
}

// Badge label: 1..9 verbatim, anything above -> ">9".
export function formatClusterCount(n: number): string {
  return n > 9 ? '>9' : String(n)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/eventClusters.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventClusters.ts src/lib/eventClusters.test.ts
git commit -m "feat: public-event zone clustering + count formatter"
```

---

## Task 2: `clusterHTML` map icon (representative pin + comic circle badge)

**Files:**
- Modify: `src/components/mapIcons.ts`

- [ ] **Step 1: Add the import**

At the top of `src/components/mapIcons.ts`, below the existing imports, add:

```ts
import { formatClusterCount } from '../lib/eventClusters'
```

- [ ] **Step 2: Append `clusterHTML`**

At the end of `src/components/mapIcons.ts`, add:

```ts
// Representative pin for a same-zone cluster (size >= 2): the normal pin plus a
// comic circle badge (white, ink outline, no tail) in the upper-right carrying
// the event count. Same 44x56 icon box as pinHTML.
export function clusterHTML(
  category: string,
  idx: number,
  dbStatus: string | undefined,
  startTime: string,
  endTime: string,
  count: number,
): string {
  const label = formatClusterCount(count)
  const fontSize = label.length > 1 ? 11 : 14
  const badge = `<div style="position:absolute;top:-8px;right:-8px;width:28px;height:28px;pointer-events:none">
    <svg width="28" height="28" viewBox="0 0 100 100" style="filter:drop-shadow(0 2px 0 #2D2B2A22)"><circle cx="50" cy="50" r="46.5" fill="#fff" stroke="#2D2B2A" stroke-width="7"/></svg>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Hanken Grotesk','Nunito',sans-serif;font-size:${fontSize}px;font-weight:900;color:#2D2B2A">${label}</div>
  </div>`
  return `<div style="position:relative;width:44px;height:56px">
    ${pinHTML(category, idx, dbStatus, startTime, endTime, 1)}
    ${badge}
  </div>`
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/mapIcons.ts
git commit -m "feat: clusterHTML map icon with comic circle count badge"
```

---

## Task 3: `EventPickerModal` component

**Files:**
- Create: `src/components/EventPickerModal.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/EventPickerModal.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { C, F } from '../lib/tokens'
import type { EventWithMeta } from '../lib/types'
import { pinHTML } from './mapIcons'

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE' }

// "Choose an event" picker, styled after ConflictModal. Lists same-zone same-day
// events (already sorted by start_time by the caller); selecting one opens the
// normal event half-sheet via onSelect.
export default function EventPickerModal({ events, onSelect, onClose }: {
  events: EventWithMeta[]
  onSelect: (ev: EventWithMeta) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const loc = LOC_MAP[i18n.language] || 'en-US'
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
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
          width: '100%', maxWidth: 360, maxHeight: '70vh', background: '#fff', borderRadius: 32,
          padding: '24px 20px 20px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, textAlign: 'center', marginBottom: 16 }}>
          {t('picker.title')}
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, margin: '0 -4px', padding: '0 4px' }}>
          {events.map((ev, i) => (
            <button
              key={ev.id}
              onClick={() => onSelect(ev)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: 20, background: C.cream, border: '2px solid transparent',
              }}
            >
              <div
                style={{ width: 44, height: 56, flexShrink: 0, position: 'relative' }}
                dangerouslySetInnerHTML={{ __html: pinHTML(ev.category, i, ev.status, ev.start_time, ev.end_time, 1) }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ev.title}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.inkSoft, marginTop: 2 }}>
                  {fmt(ev.start_time)}-{fmt(ev.end_time)}
                </div>
              </div>
            </button>
          ))}
        </div>
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
git add src/components/EventPickerModal.tsx
git commit -m "feat: EventPickerModal (choose event from a same-zone cluster)"
```

---

## Task 4: i18n `picker` block (all four languages)

**Files:** `src/locales/pl.ts`, `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/de.ts`

Add a top-level `picker` key as a sibling of `conflict` (right after the
`conflict: { ... },` block) in each file. No long dashes in copy.

- [ ] **Step 1: `pl.ts`**

```ts
  picker: {
    title: 'Wybierz wydarzenie',
  },
```

- [ ] **Step 2: `en.ts`**

```ts
  picker: {
    title: 'Choose an event',
  },
```

- [ ] **Step 3: `es.ts`**

```ts
  picker: {
    title: 'Elige un evento',
  },
```

- [ ] **Step 4: `de.ts`**

```ts
  picker: {
    title: 'Wähle ein Event',
  },
```

- [ ] **Step 5: Typecheck (locale shape parity)**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors (the shared `Resources` type forces all four to match).

- [ ] **Step 6: Commit**

```bash
git add src/locales/pl.ts src/locales/en.ts src/locales/es.ts src/locales/de.ts
git commit -m "feat(i18n): event picker title in pl/en/es/de"
```

---

## Task 5: Wire clustering + picker into MapScreen

**Files:**
- Modify: `src/screens/MapScreen.tsx`

- [ ] **Step 1: Add imports**

Add `clusterHTML` to the existing mapIcons import, and add two new imports.
Change:

```tsx
import { pinHTML, meHTML, privateHTML } from '../components/mapIcons'
```
to:
```tsx
import { pinHTML, meHTML, privateHTML, clusterHTML } from '../components/mapIcons'
```

And add near the other component imports:

```tsx
import EventPickerModal from '../components/EventPickerModal'
import { clusterPublicEvents } from '../lib/eventClusters'
```

- [ ] **Step 2: Add picker state**

Next to the other `useState` hooks (e.g. right after
`const [filterModalOpen, setFilterModalOpen] = useState(false)`), add:

```tsx
  const [pickerEvents, setPickerEvents] = useState<EventWithMeta[] | null>(null)
```

- [ ] **Step 3: Replace the pins effect**

Find this exact block (the pins `useEffect`):

```tsx
  // Pins — update on events change
  useEffect(() => {
    const map = leafRef.current
    if (!map) return
    Object.values(pinsRef.current).forEach(m => m.remove())
    pinsRef.current = {}
    visibleEvents.forEach((ev, i) => {
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
      const m = L.marker([ev.lat, ev.lng], { icon, zIndexOffset: interactions }).addTo(map)
      m.on('click', () => onOpenEvent(ev))
      pinsRef.current[ev.id] = m
    })
  }, [visibleEvents]) // eslint-disable-line react-hooks/exhaustive-deps
```

Replace it with:

```tsx
  // Pins — update on events change. Private events render individually; public
  // events are grouped by 3x3 m zone: singletons open the half-sheet directly,
  // clusters (>= 2) show a count badge and open the event picker.
  useEffect(() => {
    const map = leafRef.current
    if (!map) return
    Object.values(pinsRef.current).forEach(m => m.remove())
    pinsRef.current = {}

    // Private events — one marker each, unchanged behaviour.
    visibleEvents.filter(e => e.is_private).forEach(ev => {
      const icon = L.divIcon({
        html: privateHTML(isCurrentlyLive(ev)),
        className: 'meuwe-icon', iconSize: [44, 56], iconAnchor: [22, 56],
      })
      const m = L.marker([ev.lat, ev.lng], { icon }).addTo(map)
      m.on('click', () => onOpenEvent(ev))
      pinsRef.current[ev.id] = m
    })

    // Public events — grouped by zone (clusterPublicEvents ignores private).
    clusterPublicEvents(visibleEvents).forEach((group, ci) => {
      const rep = group[0]
      const interactions = rep.interactionCount ?? 0
      const scale = 1 + Math.min(interactions, 100) / 100 * 0.5
      const html = group.length >= 2
        ? clusterHTML(rep.category, ci, rep.status, rep.start_time, rep.end_time, group.length)
        : pinHTML(rep.category, ci, rep.status, rep.start_time, rep.end_time, scale)
      const icon = L.divIcon({ html, className: 'meuwe-icon', iconSize: [44, 56], iconAnchor: [22, 56] })
      const m = L.marker([rep.lat, rep.lng], { icon, zIndexOffset: interactions }).addTo(map)
      m.on('click', () => {
        if (group.length >= 2) setPickerEvents(group)
        else onOpenEvent(rep)
      })
      pinsRef.current[rep.id] = m
    })
  }, [visibleEvents]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Render the picker modal**

Find the empty-state block near the end of the returned JSX (it starts with
`{visibleEvents.length === 0 && !loading && !pickingLocation && (`). Immediately
BEFORE it, add:

```tsx
      {/* Event picker — same-zone cluster */}
      {pickerEvents && (
        <EventPickerModal
          events={pickerEvents}
          onSelect={ev => { setPickerEvents(null); onOpenEvent(ev) }}
          onClose={() => setPickerEvents(null)}
        />
      )}

```

- [ ] **Step 5: Verify**

Run all three:
```
npx tsc -p tsconfig.app.json --noEmit
npx vitest run
npm run build
```
Expected: no type errors, all tests pass, build succeeds.

- [ ] **Step 6: Manual verification on the preview**

Start the dev server (preview tooling), then:
- Craft/seed 3 public events at the same coordinates on today -> map shows ONE pin with a white comic circle badge reading "3".
- Tap it -> `EventPickerModal` lists the 3 events (pin icon + title + `HH:mm-HH:mm`), sorted by start; the list scrolls when tall.
- Select a row -> modal closes and the event half-sheet opens.
- A lone public event still opens the half-sheet directly (no badge).
- A private event over the cluster stays a separate pin.
- More than 9 in a zone -> badge reads ">9".
- Switch language -> picker title localizes.

- [ ] **Step 7: Commit**

```bash
git add src/screens/MapScreen.tsx
git commit -m "feat: cluster same-zone pins with count badge + event picker"
```

---

## Self-Review Notes

- **Spec coverage:** clustering + representative (Task 1), count badge helper (Task 1) + comic circle icon (Task 2), picker modal styled after ConflictModal with pin icon + title + time range (Task 3), i18n x4 (Task 4), map wiring incl. private-event passthrough, singleton vs cluster, and half-sheet handoff (Task 5). All spec sections mapped.
- **Type consistency:** `clusterHTML(category, idx, dbStatus, startTime, endTime, count)` mirrors `pinHTML`'s parameter order; `clusterPublicEvents` returns `EventWithMeta[][]`; `EventPickerModal` props `{ events, onSelect, onClose }` match the MapScreen call site.
- **No new DB / migration** - this is a pure client/presentation change; nothing to apply to Supabase.
