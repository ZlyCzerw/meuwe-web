# Adaptive category filter bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the map's fixed 3-category filter bar with one that fits as many category chips as the screen width allows, keeping `Wszystkie` + `impreza` + `muzyka` guaranteed and `+` pinned right.

**Architecture:** Extract the bar into `AdaptiveFilterBar`. It renders a hidden measurement row of all priority chips, measures their natural widths, observes the container width via `ResizeObserver`, and a pure function `computeVisibleCount` decides how many priority chips to show (reserving room for `Wszystkie` and `+`). Filtering logic stays in `MapScreen`.

**Tech Stack:** React 19, TypeScript, Vitest, ResizeObserver.

**Working dir:** `/Users/wiktormarc/meuwe-web-hotfix` (branch `feat/adaptive-filter-bar`).

---

## File Structure

- `src/lib/filterBarFit.ts` (create) — pure `computeVisibleCount(...)`. One responsibility: the fit math. Unit-tested.
- `src/lib/filterBarFit.test.ts` (create) — tests for the fit math.
- `src/components/AdaptiveFilterBar.tsx` (create) — the bar: measurement + render. Owns `PRIORITY_FILTERS`.
- `src/screens/MapScreen.tsx` (modify) — replace the inline bar JSX with `<AdaptiveFilterBar/>`; remove now-unused `POPULAR_FILTERS` and any import only the bar used.

---

## Task 1: `computeVisibleCount` pure function (TDD)

**Files:**
- Create: `src/lib/filterBarFit.ts`
- Test: `src/lib/filterBarFit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/filterBarFit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeVisibleCount } from './filterBarFit'

describe('computeVisibleCount', () => {
  const chips = [60, 60, 70, 55, 65]
  const ALL = 70, PLUS = 34, GAP = 8

  it('returns 0 before the container is measured', () => {
    expect(computeVisibleCount(0, chips, ALL, PLUS, GAP)).toBe(0)
  })

  it('fits every chip when width is ample', () => {
    expect(computeVisibleCount(2000, chips, ALL, PLUS, GAP)).toBe(chips.length)
  })

  it('reserves room for All and Plus and packs as many chips as fit', () => {
    // All(70) + chip(60) + chip(60) + Plus(34) + gap*3(24) = 248
    expect(computeVisibleCount(248, chips, ALL, PLUS, GAP)).toBe(2)
    // one px short of the 3rd chip (needs +70 +8 = 326)
    expect(computeVisibleCount(325, chips, ALL, PLUS, GAP)).toBe(2)
    // exactly enough for the 3rd
    expect(computeVisibleCount(326, chips, ALL, PLUS, GAP)).toBe(3)
  })

  it('returns 0 when not even one chip fits (only All + Plus)', () => {
    // one chip needs All(70)+60+Plus(34)+gap*2(16) = 180
    expect(computeVisibleCount(179, chips, ALL, PLUS, GAP)).toBe(0)
    expect(computeVisibleCount(180, chips, ALL, PLUS, GAP)).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/filterBarFit.test.ts`
Expected: FAIL — `computeVisibleCount` is not exported / module not found.

- [ ] **Step 3: Implement the function**

Create `src/lib/filterBarFit.ts`:

```ts
/**
 * How many priority chips fit before the "+" button.
 * Layout is: [All] [chip]... [Plus], packed with `gap` between every item.
 * With k chips there are k+2 items and k+1 gaps.
 * Returns the largest k in [0, chipWidths.length] whose total width <= available.
 */
export function computeVisibleCount(
  available: number,
  chipWidths: number[],
  allWidth: number,
  plusWidth: number,
  gap: number,
): number {
  if (available <= 0) return 0
  let count = 0
  let sum = 0
  for (let k = 1; k <= chipWidths.length; k++) {
    sum += chipWidths[k - 1]
    const total = allWidth + sum + plusWidth + gap * (k + 1)
    if (total <= available) count = k
    else break
  }
  return count
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/filterBarFit.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/filterBarFit.ts src/lib/filterBarFit.test.ts
git commit -m "feat(map): computeVisibleCount fit math for adaptive filter bar"
```

## Task 2: `AdaptiveFilterBar` component + wire into MapScreen

**Files:**
- Create: `src/components/AdaptiveFilterBar.tsx`
- Modify: `src/screens/MapScreen.tsx` (replace inline bar ~lines 310–391; remove `POPULAR_FILTERS` at line 94; add import)

- [ ] **Step 1: Create the component**

Create `src/components/AdaptiveFilterBar.tsx`:

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import { computeVisibleCount } from '../lib/filterBarFit'

// Bar order; party + music lead per product requirement, then the rest.
const PRIORITY_FILTERS: Category[] = [
  'party', 'music', 'culture', 'sport', 'food', 'outdoor', 'family', 'art',
  'film', 'gaming', 'tech', 'nature', 'travel', 'yoga', 'dance', 'comedy',
  'kids', 'pets', 'volunteering', 'workshop', 'alert',
]
const GAP = 8

type Props = {
  selectedFilters: string[]
  onToggle: (cat: string) => void
  onClear: () => void
  onOpenPicker: () => void
}

const allStyle = (active: boolean): CSSProperties => ({
  flexShrink: 0, padding: '6px 14px', borderRadius: 999,
  background: active ? C.ink : '#fff', color: active ? '#fff' : C.inkSoft,
  fontSize: 12, fontWeight: 800,
  border: `2px solid ${active ? C.ink : INK + '22'}`,
  boxShadow: active ? `0 2px 0 ${INK}` : 'none',
  transition: 'all 180ms ease', whiteSpace: 'nowrap',
})
const chipStyle = (active: boolean, color: string): CSSProperties => ({
  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 999,
  background: active ? color : '#fff', color: active ? '#fff' : C.ink,
  fontSize: 12, fontWeight: 800,
  border: `2px solid ${active ? C.ink : INK + '22'}`,
  boxShadow: active ? `0 2px 0 ${C.ink}` : 'none',
  transition: 'all 180ms ease', whiteSpace: 'nowrap',
})
const plusStyle = (on: boolean): CSSProperties => ({
  flexShrink: 0, position: 'relative', width: 34, height: 34, borderRadius: '50%',
  background: on ? C.ink : '#fff', color: on ? '#fff' : C.ink,
  border: `2px solid ${on ? C.ink : INK + '22'}`,
  boxShadow: on ? `0 2px 0 ${INK}` : 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 20, fontWeight: 700, lineHeight: 1, transition: 'all 180ms ease',
})

export default function AdaptiveFilterBar({ selectedFilters, onToggle, onClear, onOpenPicker }: Props) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const allMeasureRef = useRef<HTMLButtonElement>(null)
  const plusMeasureRef = useRef<HTMLButtonElement>(null)
  const chipMeasureRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [visibleCount, setVisibleCount] = useState(PRIORITY_FILTERS.length)

  const recompute = () => {
    const container = containerRef.current
    if (!container) return
    const available = container.clientWidth - 32 // 16px horizontal padding each side
    const allWidth = allMeasureRef.current?.offsetWidth ?? 0
    const plusWidth = plusMeasureRef.current?.offsetWidth ?? 0
    const chipWidths = chipMeasureRefs.current.map(el => el?.offsetWidth ?? 0)
    setVisibleCount(computeVisibleCount(available, chipWidths, allWidth, plusWidth, GAP))
  }

  // Re-measure when labels change language (chip widths change).
  useLayoutEffect(() => { recompute() }, [i18n.language])

  // Re-measure on container resize / orientation change.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => recompute())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const renderChip = (cat: Category, measureRef?: (el: HTMLButtonElement | null) => void) => {
    const meta = TAG_META[cat]
    const active = selectedFilters.includes(cat)
    return (
      <button key={cat} ref={measureRef} onClick={() => onToggle(cat)} style={chipStyle(active, meta.color)}>
        {/* SAFETY: meta.glyph is a static SVG from tokens.ts — not user input */}
        <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: meta.glyph }} />
        {t('tags.' + cat)}
      </button>
    )
  }

  const visible = PRIORITY_FILTERS.slice(0, visibleCount)
  const hiddenSelected = selectedFilters.filter(f => !visible.includes(f as Category)).length
  const plusActive = hiddenSelected > 0

  return (
    <>
      <div ref={containerRef} style={{
        position: 'absolute', top: 76, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: GAP, padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: GAP, minWidth: 0 }}>
          <button onClick={onClear} style={allStyle(selectedFilters.length === 0)}>{t('map.allCategories')}</button>
          {visible.map(cat => renderChip(cat))}
        </div>
        <button onClick={onOpenPicker} aria-label="More filters" style={plusStyle(plusActive)}>
          +
          {plusActive && (
            <span style={{
              position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 999, background: C.primary, color: '#fff', fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff',
            }}>{hiddenSelected}</span>
          )}
        </button>
      </div>

      {/* Hidden measurement row — off-screen, measures natural chip widths. */}
      <div aria-hidden style={{
        position: 'absolute', top: -9999, left: 0, visibility: 'hidden', pointerEvents: 'none',
        display: 'flex', gap: GAP,
      }}>
        <button ref={allMeasureRef} style={allStyle(false)}>{t('map.allCategories')}</button>
        {PRIORITY_FILTERS.map((cat, i) => renderChip(cat, el => { chipMeasureRefs.current[i] = el }))}
        <button ref={plusMeasureRef} style={plusStyle(false)}>+</button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Wire it into MapScreen — add the import**

In `src/screens/MapScreen.tsx`, add near the other component imports (by `import TagPickerModal from '../components/TagPickerModal'`, line ~16):

```tsx
import AdaptiveFilterBar from '../components/AdaptiveFilterBar'
```

- [ ] **Step 3: Replace the inline bar JSX**

In `src/screens/MapScreen.tsx`, replace the entire block that starts with the comment `{/* Category filter bar — fixed popular set ... */}` and its `{!pickingLocation && ( <div style={{ position: 'absolute', top: 76, ... }}> ... </div> )}` (the bar with the All button, `POPULAR_FILTERS.map(...)`, and the `+` IIFE) with:

```tsx
      {/* Category filter bar — adapts the number of chips to the screen width */}
      {!pickingLocation && (
        <AdaptiveFilterBar
          selectedFilters={selectedFilters}
          onToggle={toggleFilter}
          onClear={() => setSelectedFilters([])}
          onOpenPicker={() => setFilterModalOpen(true)}
        />
      )}
```

- [ ] **Step 4: Remove now-unused `POPULAR_FILTERS`**

In `src/screens/MapScreen.tsx`, delete line 94 and its comment (line 93):

```tsx
  // Popular categories shown directly on the bar; the rest live behind the "+" modal.
  const POPULAR_FILTERS: Category[] = ['party', 'music', 'culture']
```

- [ ] **Step 5: Typecheck and drop any now-unused imports**

Run: `npx tsc -b`
Expected: passes. If `tsc`/lint reports `TAG_META` or `Category` as unused in `MapScreen.tsx` (they moved into the component), remove them from the MapScreen import line. Re-run `npx tsc -b` until clean.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: green (existing tests + the new `filterBarFit` test). Note: `src/lib/supabase.test.ts` may fail to load locally if this worktree has no `.env` — that is a pre-existing env gap, unrelated to this change.

- [ ] **Step 7: Commit**

```bash
git add src/components/AdaptiveFilterBar.tsx src/screens/MapScreen.tsx
git commit -m "feat(map): adaptive category filter bar (fits chips to screen width)"
```

## Task 3: Verify visually across widths

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 2: Preview at three widths**

Start the dev server and open the map. Using the browser preview, check:
- **mobile (375px):** bar shows `Wszystkie · impreza · muzyka · +` (roughly), no overflow past the right edge, `+` aligned right (near where the search bar ends).
- **tablet (768px) / desktop (1280px):** more chips appear (`kultura`, `sport`, `jedzenie`, …), `+` stays pinned right, chips packed left with no large gaps between them.
- Resize the window narrower → chips drop and reflow to `+`; wider → more appear. No horizontal scrollbar.
- Toggle a category that is currently hidden behind `+` (open the picker, select one) → the `+` badge shows the count.

- [ ] **Step 3: No commit** (visual verification only).

---

## Self-Review (plan vs spec)

- Spec §"Wszystkie first + party/music guaranteed, fill with priority, + at end" → Task 2 component render + `PRIORITY_FILTERS` + `computeVisibleCount`. ✅
- Spec §"dynamic measurement (ResizeObserver + chip width measurement)" → Task 2 hidden measurement row + `ResizeObserver` + `recompute`. ✅
- Spec §"pure `computeVisibleCount` is the only unit-tested part" → Task 1 (TDD). ✅
- Spec §"extract `AdaptiveFilterBar`, filtering logic unchanged in MapScreen" → Task 2 (props: selectedFilters/onToggle/onClear/onOpenPicker; MapScreen keeps `toggleFilter`/`selectedFilters`/`TagPickerModal`). ✅
- Spec §"overflow selected → badge count (not pull-to-front)" → Task 2 `hiddenSelected`/`plusActive` badge. ✅
- Spec §"+ pinned right (aligns ~search); chips packed left (aligns ~avatar)" → Task 2 outer `justify-content: space-between`, inner packed left group. ✅
- Spec §"web + Android + future iOS (shared MapScreen)" → change is in shared components, no platform branch. ✅
- Placeholder scan: none — full component + test code inline. ✅
- Type consistency: `computeVisibleCount(available, chipWidths, allWidth, plusWidth, gap)` signature identical in Task 1 and its use in Task 2; `Category`, `PRIORITY_FILTERS`, prop names consistent. ✅
- Priority order matches spec's `PRIORITY_FILTERS`. ✅
