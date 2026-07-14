# Same-Zone Pin Clustering + Event Picker - Design

**Date:** 2026-07-14
**Status:** Approved (brainstorming)

## Problem

When several events happen at the same place on the same day, their map pins
render at (nearly) identical coordinates and stack exactly on top of each other,
so the user can't pick the one they want. (This is common now that the 3x3 m
exclusivity zone forces same-place events into a disjoint time sequence rather
than truly overlapping.)

When more than one **public** event shares a zone on the viewed day:
1. The map shows a single pin for the current-or-next event, plus a white cloud
   badge with the number of events at that place from now to end of day.
2. Tapping it opens a modal with a scrollable list ("Wybierz wydarzenie"); each
   row shows the event's map-pin icon (default map-pin size), title, and time
   range. Selecting a row closes the modal and opens the normal event half-sheet.

## Key Context (already handled upstream)

`db.getEvents(lat,lng,km,dayOffset)` already scopes results per day and, for
**today** (`dayOffset===0`), floors `end_time` at `now` - so already-ended
events are excluded. For future days it returns the whole day. Therefore the
cluster's list/count is simply "the public events in that zone for the viewed
day"; the "from now to end of day" semantics come for free. No extra time filter
is needed in the cluster logic.

## Clustering Rule

- **Scope:** public events only (`is_private === false`). Private events keep
  their current individual `privateHTML` markers and never join a cluster.
- **Zone:** two events are in the same zone when their 3x3 m squares overlap -
  reuse `zonesOverlapSpatially(a, b)` from `src/lib/zoneConflict.ts`.
- **Clusters** = connected components under that relation, computed with a
  single-pass anchor sweep: iterate events; for each not-yet-grouped event, open
  a cluster and pull in every other not-yet-grouped event whose zone overlaps the
  anchor. (Real data places same-venue events at identical coordinates, so
  chaining is a non-issue; the anchor sweep is deterministic and simple.)
- **Order & representative:** within a cluster, sort by `start_time` ascending.
  The representative is the first element - a currently-live event has the
  earliest start so it wins ("obecne"); otherwise the nearest upcoming one.

## Files

- Create `src/lib/eventClusters.ts` - pure clustering (`clusterPublicEvents`) and
  the badge helper `formatClusterCount(n)` (`n > 9 ? '>9' : String(n)`).
- Create `src/lib/eventClusters.test.ts` - vitest unit tests.
- Modify `src/components/mapIcons.ts` - add `clusterHTML(...)` (representative pin
  + white count bubble).
- Create `src/components/EventPickerModal.tsx` - the "choose event" modal.
- Modify `src/screens/MapScreen.tsx` - build markers from clusters + private
  events; wire picker modal state.
- Modify `src/locales/{pl,en,es,de}.ts` - add `picker` block.

## Map Rendering (`MapScreen.tsx` + `mapIcons.ts`)

The pins `useEffect` changes from a 1:1 `visibleEvents` loop to:
1. Split `visibleEvents` into private (rendered individually as today via
   `privateHTML`, click -> `onOpenEvent`) and public.
2. `clusterPublicEvents(publicEvents)` -> array of clusters.
3. For each cluster:
   - **size 1:** existing `pinHTML(...)` marker; click -> `onOpenEvent(ev)`.
   - **size >= 2:** `clusterHTML(rep.category, idx, rep.status, rep.start_time,
     rep.end_time, count)` marker; click -> open the picker modal with the
     cluster's events.

`clusterHTML` renders the same pin body as `pinHTML` plus a **comic circle
badge** in the pin's upper-right. Style matches the rest of meuwe (white fill,
comic ink outline `#2D2B2A`, subtle drop shadow) - a simple round badge, NOT a
cloud and with NO tail. The count sits centred inside in the display font (bold
ink), text `formatClusterCount(count)` (`> 9` -> `>9`, else the number).
Rendered as an absolutely-positioned overlay (top-right, may slightly overflow
the 44x56 icon box - divIcons aren't clipped). Badge shown only for size >= 2
(the only path that calls `clusterHTML`).

Concrete badge: a 28x28 SVG `<circle>` in viewBox `0 0 100 100`, `r=46.5`,
`fill:#fff stroke:#2D2B2A stroke-width:7`, `filter:drop-shadow(0 2px 0
#2D2B2A22)`, positioned `top:-8px right:-8px`. The number is a centred flex
`<div>` layered over it in `F.display`, weight 900, colour `#2D2B2A`, font-size
14 for a single char and 11 for the two-char `>9`. `formatClusterCount` is
imported from `eventClusters.ts`.

## Event Picker Modal (`EventPickerModal.tsx`)

Props: `{ events: EventWithMeta[]; onSelect: (ev) => void; onClose: () => void }`.

- Styled after `ConflictModal`: fixed backdrop `rgba(45,43,42,0.45)` + `fadeIn`,
  centred white card (radius 32, `bubble-up`), `zIndex 300`. Clicking the
  backdrop closes.
- Header: title `t('picker.title')`.
- Body: a scrollable list (`maxHeight` ~60vh, `overflowY:auto`) of rows, events
  already sorted by `start_time` ascending by the caller. Each row:
  - the event's map-pin icon at default size (44x56) via
    `dangerouslySetInnerHTML` of `pinHTML(ev.category, i, ev.status,
    ev.start_time, ev.end_time)` inside a clipped 44x56 box;
  - title (bold, ink), and the time range below it;
  - clicking the row calls `onSelect(ev)`.
- Time range formatted per locale:
  `new Date(start).toLocaleTimeString(loc, { hour:'2-digit', minute:'2-digit' })`
  joined with a plain hyphen to the end time -> e.g. `18:00-21:00`. `loc` from
  the same `LOC_MAP` used in `MapScreen`.

`MapScreen` holds `const [pickerEvents, setPickerEvents] = useState<EventWithMeta[] | null>(null)`
and renders `{pickerEvents && <EventPickerModal events={pickerEvents}
onSelect={ev => { setPickerEvents(null); onOpenEvent(ev) }}
onClose={() => setPickerEvents(null)} />}`.

## i18n (all four languages)

New `picker` block. No long dashes in copy (plain hyphen only).

| key   | pl                 | en               | es               | de              |
|-------|--------------------|------------------|------------------|-----------------|
| title | Wybierz wydarzenie | Choose an event  | Elige un evento  | Wahle ein Event |

(German diacritic written normally in the file: "Wähle".)

The time range and count use runtime formatting, not translation strings.

## Testing

`src/lib/eventClusters.test.ts` (vitest):
- single public event -> one cluster of size 1 (no badge path).
- three public events sharing a zone -> one cluster, size 3, representative is
  the earliest by `start_time`, list sorted ascending.
- two events > 3 m apart -> two separate clusters of size 1 each.
- private events are excluded from clustering input entirely.
- `formatClusterCount`: `1..9` -> that number as a string; `10`, `42` -> `>9`.

Manual verification on the preview: seed/craft several public events at one spot
on today -> map shows one pin + white count badge; tap -> picker lists them with
pin icon + title + `HH:mm-HH:mm`, scrollable when tall; selecting opens the
half-sheet; a lone event still opens directly; a private event stays separate.

## Out of Scope

- Changing how private events render or are grouped.
- Cross-day clustering (each day is viewed independently via the timeline).
- Spiderfy/zoom-to-expand map interactions (the picker modal replaces that need).
