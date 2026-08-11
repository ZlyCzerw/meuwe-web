# Seamless Map Panning - Design

**Date:** 2026-08-11
**Status:** Approved (brainstorming)

## Problem

Panning the map shows the full-screen "meuwe" splash and makes pins arrive in
batches. Measured on a local dev server: one drag produces a 216 ms opaque
overlay and a fresh round trip to Supabase. On a phone network that overlay is
half a second to a second and a half, and continuous panning is a continuous
splash.

Wanted instead: the map scrolls with no loading screens, every pin in the
visible area is on it, and panning fetches only the part of the world that has
not been fetched yet.

## Root Causes

Four independent causes, all confirmed against the running app.

1. **The splash is bound to a state that means "a refetch is in flight."**
   `useEvents` returns `loading = answered !== query`, and `query` carries the
   map centre and radius. Every `moveend` calls `adoptView`, which changes both,
   so `loading` flips true on every pan and `MapScreen.tsx:442` covers the map
   with an opaque cream overlay.

2. **No hysteresis.** `adoptView` sets the fetch radius to exactly the
   viewport's half-diagonal, and `useEvents` rounds the centre to ~11 m. The
   fetched box matches the visible box to the metre, so any pan larger than 11 m
   is a new question.

3. **`setEvents(data)` replaces the whole set.** After a pan the state holds
   only what the new box returned; pins from the view just left have to arrive
   again.

4. **The pin effect rebuilds every marker from scratch.** It removes all markers
   and recreates them, keyed on `[visibleEvents]` - and with a category filter
   active, `visibleEvents` is an inline `.filter()`, so it is a new array on
   every render.

Cause 4 is worse on Android/iOS than on the web. `useDeviceHeading` calls
`setHeading` on every compass event, up to ~60 Hz on a phone. Desktop browsers
emit no orientation events, so the web never sees it. On a native build with a
filter selected, every marker on the map is destroyed and recreated ~60 times a
second.

## Secondary Finding: the Notification Radius Caps the Map

`MAX_MAP_KM = 50` is documented in `geo.ts` as matching `MAX_RADIUS_KM` in the
push fan-out - it is the **notification** radius. `adoptView` also uses it to cap
the **fetch** radius. On a 390x844 phone, zoom 10 already has a ~44 km
half-diagonal and zoom 9 has ~88 km, so from roughly zoom 10 outward, zooming
out stops adding pins.

The two numbers are separated in this design. What the map fetches must not be
tied to how far the user wants to be notified.

## Non-Findings (checked, no change needed)

- **`distKm` / `distStr` staleness.** `EventSheet.tsx:199` already recomputes the
  distance from `userPos` and ignores what the query returned. Nothing in the map
  path renders the query's copy. The only real consumer is the onboarding
  nearest-event lookup (`App.tsx:787`), which calls `db.getEvents` directly with
  the user's own position as the centre and is therefore already correct.
- **Blob shapes.** `pinHTML` picks the blob from the array index, so a pin's
  shape today depends on how many other events the query returned. This does not
  need fixing: the marker signature below deliberately excludes the blob index,
  so a marker that already exists keeps its shape and is never rebuilt for it.
- **Stale pins surviving in the cache.** Cannot become visible. The fetch box
  always contains the viewport, and an answer is authoritative inside its own
  box, so every pin on screen comes from the latest answer for the current box.
  Cached events outside the box are carry-over that becomes authoritative the
  moment the user pans there. The global `subscribeEvents` channel refetches the
  box on any insert, update or delete.

## Design

### `src/lib/mapView.ts` (new, pure)

```ts
export type FetchView = { lat: number; lng: number; km: number }

export const FETCH_MARGIN = 1.3

export function fetchBox(v: FetchView): { minLat; maxLat; minLng; maxLng }
export function nextFetchView(covered: FetchView | null, viewport: FetchView): FetchView | null
```

`nextFetchView` returns the view to fetch, or `null` when `covered` already
contains the viewport. If `fetchBox(covered)` contains `fetchBox(viewport)` on
all four sides, return `null`; otherwise return the viewport scaled by
`FETCH_MARGIN`.

Fetching the scaled box while testing containment against the bare viewport is
the whole of the hysteresis: a 30% margin of panning in any direction costs
nothing.

Boxes come from `bboxDeltas` (`geo.ts`), which already handles the
longitude/latitude asymmetry.

**There is no ceiling on the fetch radius.** A ceiling here is a ceiling on
which pins reach the screen, and the one that used to be here was `MAX_MAP_KM` -
the push fan-out's radius, which had no business deciding what the map shows. It
bit from about zoom 9. The row cap in `getEvents` is what keeps a single query
bounded; `nextFetchView` only decides when to ask.

### `src/lib/eventCache.ts` (new, pure)

```ts
export function mergeEvents(
  cache: EventWithMeta[],
  answer: EventWithMeta[],
  box: FetchView,
  keepOutsideBox: number,
): EventWithMeta[]
```

1. Drop from `cache` every event whose **cached** coordinates fall inside
   `fetchBox(box)`. The answer is authoritative there, so this is what removes
   events that ended or were deleted. Using cached rather than answered
   coordinates is what makes a relocated event leave no ghost.
2. If more than `keepOutsideBox` survive, sort by distance from the box centre
   and keep the nearest `keepOutsideBox`.
3. Return `answer` followed by the survivors, deduplicated by `id` with `answer`
   winning.

Eviction can only ever touch events outside the current fetch box, and the
viewport is always inside that box, so a visible pin is never evicted. There is
no cap on how many pins the map may show - only on how much carry-over is kept
for regions the user has left. `keepOutsideBox = 400`.

### `src/hooks/useEvents.ts`

Signature changes from `(pos, dayOffset, refreshKey, km)` to
`(view: FetchView | null, dayOffset, refreshKey)`. The old split existed because
the fetch centre was the map centre; it no longer is.

- `load` merges through `mergeEvents` instead of calling `setEvents(data)`.
- A `dayOffset` change clears the cache immediately via its own effect, so
  yesterday's pins never sit under today's question.
- `getEvents` returning `null` (a failed query) sets `answered` but leaves the
  cache untouched: we stop claiming to load, and we do not delete good pins
  because a request failed.
- The realtime subscription is created once on mount and calls `load` through a
  ref. Today it is torn down and recreated on every pan because `load` changes
  identity with the query.
- Returns `{ events, loading, ready }`. `ready` is `answered !== null` - has this
  hook ever answered anything. `loading` keeps its current meaning and its
  current job of gating the empty-state card.

### `src/lib/supabase.ts`

`getEvents` returns `EventWithMeta[] | null`, with `null` for a failed query -
the convention `probeNearby` already uses in the same file, and documented there
for the same reason. Today it returns `[]` on error, which the cache would read
as an authoritative "nothing is here" and act on.

It also gains `.limit(1500)`. The query is unbounded today; now that the fetch
radius is no longer capped at 50 km, one pinch-out in a dense city could pull a
very large response. The query already orders by `created_at` descending, so the
limit keeps the 1500 most recently created and drops the oldest - not a
distinction the user can see at a zoom that wide.

`App.tsx:787` gains a `null` guard.

### `src/screens/MapScreen.tsx`

**Two radii instead of one.** `adoptView` keeps setting `mapCenter` and
`mapRadiusKm` on every `moveend` - they are free, and they feed the empty-state
card's "we looked within X km", `handleNotifyHere`'s profile radius, and
`canNotifyHere`. `mapRadiusKm` keeps its `MAX_MAP_KM` cap and its current
meaning. Separately, `adoptView` asks `nextFetchView` whether the fetch anchor
needs to move, and only then updates it. The anchor lives in state (to drive
`useEvents`) with a ref alongside it (to be read synchronously inside
`adoptView`).

**Overlay.** Rendered on `!ready` instead of `loading`. It survives only as the
cold-start splash. A day change no longer shows it; the empty-state card is
already gated on `!loading`, and `loading` is true from the instant `dayOffset`
enters the query, so the map is briefly bare but says nothing false.

**`visibleEvents`** wrapped in `useMemo` on `[events, selectedFilters]`.

**A `ResizeObserver` on the map container**, calling `invalidateSize` and
re-adopting the view. Found while verifying: `map.getSize()` can be `0x0` when
the init effect runs, because the map is mounted behind the landing screen, and
then the first fetch box is measured from a viewport of nothing and stands until
the first drag. Leaflet binds its own `window` resize handler, so window resizes
and rotations already reach `moveend` and are not the gap here; a container that
changes size without the window doing so is. Watching the element closes it.

**Marker diffing.** `pinsRef` becomes `Record<string, { marker: L.Marker; sig: string }>`,
keyed by `ev.id` for private events and `rep.id` for public clusters.

```
sig = `${isPrivate}|${category}|${groupLength}|${status}|${isCurrentlyLive}|${scale}|${lat}|${lng}`
```

The blob index is deliberately absent: it is decorative and derived from array
position, and including it would rebuild markers as the set changes.

Per effect run: remove markers whose key is gone; for a key whose `sig` is
unchanged, keep the DOM node and only rebind the click handler and
`setZIndexOffset`; for a key whose `sig` changed, reuse the marker via `setIcon`
and `setLatLng`; create only genuinely new keys.

## Resulting Behaviour

| Action | Today | After |
|---|---|---|
| Pan 20 m | splash + full refetch + full marker rebuild | nothing |
| Pan past the fetched box | as above | background query, existing pins stay, new ones join |
| Zoom 15 -> 10 | splash, pins cut off at 50 km | pins for the whole new field of view, existing pins untouched |
| Zoom 10 -> 15 | splash + refetch | nothing |
| Day change | splash | briefly bare map, no card, then pins |
| Cold start | splash | splash |
| Native, filter active | ~60 marker rebuilds/second | none |

## Testing

`src/lib/mapView.test.ts`
- a viewport inside the covered box returns `null`
- a viewport that escapes any one of the four sides returns a fetch view
- the returned view is the viewport scaled by `FETCH_MARGIN`
- a continental-scale viewport is fetched in full, with no ceiling applied
- the margin holds at that scale too: a few kilometres of panning asks nothing
- `null` covered always returns a fetch view
- longitude containment is correct at a high latitude (asymmetric deltas)

`src/lib/eventCache.test.ts`
- an event inside the box that is absent from the answer is dropped (ended or
  deleted)
- an event outside the box is retained
- an event that moved from inside the box to outside leaves no ghost
- an event that moved from outside to inside appears once, at its new position
- an empty answer for a box clears exactly that box and nothing else
- eviction above `keepOutsideBox` never removes an event inside the box

`src/hooks/useEvents.test.tsx` - the three existing tests stay (checked: they
pass under merge semantics). New:
- a second view's answer adds to the first view's events rather than replacing
- a `dayOffset` change empties the events immediately, before any answer
- a `null` answer leaves the events in place and clears `loading`
- `ready` stays true across a query change; `loading` goes back to true

Manual verification on the preview, over Rzeszow (6 events on the day tested),
with `fetch` and a `MutationObserver` instrumented and every marker element
branded with a `data-brand` attribute so reuse can be told from rebuilding:

- small pan: 0 requests, 0 splash, all 7 marker nodes survive
- pan out of the fetched box: exactly 1 request (8 km span, the margin applied),
  0 splash, all 7 marker nodes still survive - the pins were carried across, not
  refetched and rebuilt
- zoom out one step: the fetch view widens 4 km -> 7 km, no splash
- day change: 0 splash, and the empty-state card never appears while the pins
  are in the air (observed `hasCard` false throughout); the event markers are
  replaced, the "me" marker is kept

## Out of Scope

- The empty-state probe keeps following the map centre exactly as it does today.
- Viewport culling of markers. Everything cached is rendered. If marker count
  becomes a problem on phones at wide zooms, that is a separate change.
- Canvas rendering for markers.
- `MAX_MAP_KM` itself, the push fan-out, and startup framing (`startupZoom`).
