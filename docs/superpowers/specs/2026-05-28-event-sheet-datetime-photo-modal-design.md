# EventSheet — DateTime Range + Photo Modal Design Spec

**Date:** 2026-05-28
**Status:** Approved

## Overview

Two improvements to `EventSheet.tsx`:
1. Show full start → end datetime range next to the status pill (instead of just the current time).
2. Tapping a photo opens it fullscreen in a modal with navigation.

## Change 1: Status Row — Datetime Range

### Current layout
Single flex row:
```
[StatusPill]  15:22  ·  🔴 823 m od Ciebie
```

### New layout — two lines
```
[StatusPill]
28.05 15:22 → 29.05 15:22  ·  🔴 823 m od Ciebie
```

### Implementation

Change the container from `flexDirection: 'row'` to `flexDirection: 'column'`, `alignItems: 'flex-start'`.

**Line 1:** `<StatusPill status={computedStatus} />`

**Line 2:** datetime range span + `·` separator + existing distance button.

Date format (both start and end):
```ts
new Date(event.start_time).toLocaleString(loc, {
  day: '2-digit', month: '2-digit',
  hour: '2-digit', minute: '2-digit',
})
```
Produces `28.05 15:22` in `pl` locale. Arrow `→` between them.

### Scope

- **Full view** (around line 275): full two-line layout as described above.
- **Compact header** (around line 157, shown when sheet is fully expanded): keep single-line, show only `StatusPill · distStr` — no datetime range, to avoid crowding the sticky header.

## Change 2: Photo Modal

### New state

```ts
const [photoModal, setPhotoModal] = useState<number | null>(null)
```
`null` = modal closed. Number = index of photo displayed in modal.

### Trigger

Add `onClick={() => setPhotoModal(photoIdx)}` and `cursor: 'pointer'` to the existing `<img>` in the photo carousel.

### Modal markup

Rendered at the bottom of `EventSheet`'s JSX return, outside the scrollable area:

```
position: fixed, inset: 0, zIndex: 200
background: rgba(0,0,0,0.92)
display: flex, alignItems: center, justifyContent: center
```

Contents:
- `<img>` of `event.photos[photoModal]`, `max-width: 90vw`, `max-height: 90vh`, `object-fit: contain`, `border-radius: 12px`
- `×` close button: `position: absolute, top: 20px, right: 20px`
- Previous `‹` / next `›` buttons (only when `event.photos.length > 1`): `position: absolute`, vertically centered, left/right 16px
- Clicking the backdrop (`onClick` on the fixed div, `stopPropagation` on the img) closes the modal

### State independence

`photoModal` (modal index) and `photoIdx` (carousel index) are independent. The modal opens at the current carousel position but navigates independently. No sync needed.

### z-index note

`position: fixed` on a child of `EventSheet` works correctly — `fixed` positioning escapes the stacking context of any `position: absolute` ancestor and covers the full viewport. No changes to `App.tsx` or portal needed.

## Files Changed

| File | Change |
|---|---|
| `src/screens/EventSheet.tsx` | Status row layout + `photoModal` state + modal JSX + img onClick |

## What Is NOT Changing

- Carousel navigation logic (`photoIdx`, prev/next buttons, dot indicators) — unchanged
- `StatusPill` component — unchanged
- Distance button / `onLocate` logic — unchanged
- Compact header (line ~157) — keeps existing single-line layout
