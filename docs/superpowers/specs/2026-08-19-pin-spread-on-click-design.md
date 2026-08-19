# Pin Spread On Click - Design

**Date:** 2026-08-19
**Status:** Approved (brainstorming)

## Problem

Two events 80 m apart are two distinct pins, but at zoom 12 they land on the
same 44 px of screen. The user sees one pin, taps it, and gets whichever event
happened to be on top - the other one is unreachable without guessing that a
pinch-zoom would reveal it.

Same-zone stacking is already handled: public events sharing a 3x3 m zone
collapse into one pin with a count badge (`clusterPublicEvents`, `clusterHTML`,
`EventPickerModal`). That mechanism is zoom-independent and stays exactly as it
is. What is missing is the zoom-dependent case - pins far enough apart to be
separate events, close enough on screen to be one blob.

**Explicitly rejected:** merging screen-overlapping pins into a single cluster
pin. The count badge stays reserved for same-zone clusters.

## Behaviour

Tapping a pin that overlaps other pins does not open the event. It centres the
map on that pin and flies to a closer zoom, so the neighbours separate. The
half-sheet does not open - the user looks at the spread-out pins and taps again.

When zooming cannot help, the tap opens the event as it always did. This is the
safety valve: two private events at one address sit at identical coordinates and
no zoom will ever separate them, and without this rule such a pin would be
permanently unopenable. (Private events do not pass through
`clusterPublicEvents`, so they are rendered as individual overlapping markers -
see `MapScreen` pin effect.)

## Zoom Criterion

The target zoom Y is **the highest zoom at which the whole overlapping chain
still fits in the viewport**, computed by Leaflet's `map.getBoundsZoom()`.

This is a deliberate substitution and worth stating plainly: the original wording
of the request was "a zoom at which at least 90% of the originally overlapping
pins are separated". `getBoundsZoom` does not measure that. It measures the
spread of the outermost pins, not the density between them. In the common layout
- a handful of events in one venue plus something down the street - the distant
pin sets the zoom and the tight group can remain stacked.

The bounds-fit criterion was chosen anyway, with that trade-off understood: it
guarantees the neighbourhood stays on screen, needs no threshold tuning, and
inherits projection, viewport size and `maxZoom` handling from Leaflet. Pin
separation is its usual effect, not its guarantee.

## Components

### `src/lib/pinOverlap.ts` (new)

Pure functions over pixel-space points. No Leaflet, no DOM, so the tests are
arrays of numbers.

| Function | Contract |
|---|---|
| `pinsOverlap(a, b)` | Icon boxes intersect: `abs(dx) < 44 && abs(dy) < 56` |
| `overlapChainInView(points, clickedIdx, viewSize)` | Transitive overlap chain containing `clickedIdx`, restricted to pins inside the viewport once it is centred on the clicked pin. Returns indices, always including `clickedIdx`. |

`points` are container pixels at the **current** zoom, so the clipping rectangle
is `viewSize` centred on `points[clickedIdx]` - the frame as it would look after
centring but before flying. Clipping at the destination zoom would be circular:
the destination is what the chain is being computed to determine.

The 44x56 box and its `[22, 56]` anchor mirror the `L.divIcon` in `MapScreen`.
A pin's popularity scale (up to 1.5x via `interactionCount`) is ignored - the
threshold stays nominal. Scale is a decorative transform that does not change
`iconSize`, and folding it in would make overlap depend on interaction counts
that change under the user.

### `MapScreen` - `spreadOrOpen(rep, onOpen)`

Wired into the existing pin `onClick`, in front of `onOpenEvent` / `setPickerEvents`.

1. Project every rendered pin to container pixels at the current zoom
   (`map.latLngToContainerPoint`).
2. Build the chain via `overlapChainInView`. Length 1 -> `onOpen(rep)`, done.
3. Build `L.latLngBounds` from the chain, **mirrored about the clicked pin** -
   for every member at `(lat, lng)`, also include `(2*rep.lat - lat,
   2*rep.lng - lng)`, i.e. its reflection through `rep` in lat/lng
   space. The map centres on `rep`, so the frame must reach equally far on both
   sides. Reflecting in degrees rather than pixels is exact enough here: chains
   span at most a viewport, where the Mercator scale is effectively constant.
4. `Y = map.getBoundsZoom(bounds, false, L.point(40, 40))` - padding keeps pins
   off the screen edge.
5. `Y <= map.getZoom()` -> `onOpen(rep)`. One condition covers both "nothing
   overlaps" and "already as close as the map goes".
6. Otherwise `flyAdopting(map, rep.lat, rep.lng, Y, 0.7)`.

`flyAdopting` is reused deliberately: it adopts the destination as the fetch
view at request time rather than on `moveend`, so events for the closer view
load while the flight is still in the air.

## Overlap Set

Every rendered marker takes part, private and public alike - they occlude each
other on screen regardless of type. A same-zone cluster counts as one pin,
because one pin is what it draws.

## Testing

- `pinOverlap.test.ts`: box intersection at the boundary (43 vs 44 px), chain
  transitivity (A-B-C-D with A and D far apart), viewport clipping drops the
  distant tail, singleton input returns just the clicked index.
- `MapScreen`: existing pin tests must still pass - a non-overlapping pin opens
  its half-sheet, a same-zone cluster still opens `EventPickerModal`.

## Out Of Scope

`clusterHTML`, `formatClusterCount`, `eventClusters.ts`, `EventPickerModal`,
`zoneConflict.ts` - untouched.
