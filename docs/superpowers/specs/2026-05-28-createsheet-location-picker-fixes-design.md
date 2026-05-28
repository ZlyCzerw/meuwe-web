# CreateSheet & Location Picker Fixes — Design Spec

**Date:** 2026-05-28
**Status:** Approved

## Overview

Three focused UI improvements:
1. Move the Time section in CreateSheet to appear directly below the Title input.
2. Add an address search input with Nominatim autocomplete to the location picker overlay.
3. Fix the SearchBar suggestions dropdown being hidden behind the tag filter bar.

---

## Change 1: CreateSheet — reorder Time section

### Current order
Location picker button → Title input → Photos → Tags → **Time** → Description

### New order
Location picker button → Title input → **Time** → Photos → Tags → Description

### Implementation

In `src/screens/CreateSheet.tsx`, move the Time `<button>` block (the collapsible section with CZAS label, "Teraz · za 24h" summary, and expanded datetime inputs) from its current position (after Tags) to directly after the Title `<input>` block.

No changes to the Time component logic, state, or styling.

---

## Change 2: Location picker — address search with autocomplete

### Current layout
```
[‹]   Wybierz miejsce          [ ]
      Przesuń mapę, aby wybrać lokalizację
```

### New layout
```
[‹]   Wybierz miejsce          [ ]
      [🔍 Wpisz lokalizację          ]
      lub przesuń mapę, aby wybrać lokalizację
```

### Implementation

In `src/screens/MapScreen.tsx`, inside the location picker top banner (`pickingLocation && ...`), add a `<SearchBar>` component between the title row and the subtitle hint.

- `onSelect` callback: `p => leafRef.current?.flyTo([p.lat, p.lng], 15, { duration: 0.7 })`
- After flyTo, the crosshair pin (always centered on the map) lands exactly on the selected coordinates — no extra state needed.
- Subtitle text changes from `{t('map.pickLocationHint')}` (currently "Przesuń mapę, aby wybrać lokalizację") to `{t('map.pickLocationHintAlt')}` = "lub przesuń mapę, aby wybrać lokalizację".

New i18n keys needed (all 4 locales: `pl`, `en`, `de`, `es`):
- `map.pickLocationHintAlt`:
  - pl: `"lub przesuń mapę, aby wybrać lokalizację"`
  - en: `"or move the map to select a location"`
  - de: `"oder Karte verschieben, um Standort zu wählen"`
  - es: `"o mueve el mapa para elegir la ubicación"`

The SearchBar component already handles Nominatim search with debounce and `onSelect` — no changes needed to `SearchBar.tsx`.

The SearchBar wrapper inside the banner needs `zIndex: 50` so its dropdown appears above the crosshair pin (`zIndex: 25`) and confirm button (`zIndex: 30`).

---

## Change 3: SearchBar dropdown z-index on main map

### Problem

In `src/screens/MapScreen.tsx`, the SearchBar wrapper div is at `zIndex: 10`. The tag filter bar is also `zIndex: 10` but appears later in the DOM, so it renders on top of the SearchBar dropdown.

### Fix

Raise the SearchBar wrapper's `zIndex` from `10` to `20` in `MapScreen.tsx` (line ~211).

The SearchBar dropdown already has `zIndex: 20` internally — after this change the stacking context of the wrapper is higher than the tag bar, so the dropdown appears above it.

---

## Files Changed

| File | Change |
|---|---|
| `src/screens/CreateSheet.tsx` | Move Time block to after Title input |
| `src/screens/MapScreen.tsx` | Add SearchBar to location picker banner; raise SearchBar wrapper zIndex to 20 |
| `src/locales/pl.ts` | Add `map.pickLocationHintAlt` |
| `src/locales/en.ts` | Add `map.pickLocationHintAlt` |
| `src/locales/de.ts` | Add `map.pickLocationHintAlt` |
| `src/locales/es.ts` | Add `map.pickLocationHintAlt` |

## What Is NOT Changing

- `SearchBar.tsx` — no changes, reused as-is
- Time section logic, state, styling — unchanged, only position in JSX
- Location picker confirm button, crosshair pin — unchanged
- `reverseGeocode` and `pickedAddress` logic in `CreateSheet.tsx` — unchanged
