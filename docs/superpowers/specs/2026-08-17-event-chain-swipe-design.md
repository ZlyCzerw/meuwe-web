# Event Chain Swipe - Design

**Date:** 2026-08-17
**Status:** Approved (brainstorming)

## Problem

An open event card is a dead end. To look at what else is happening nearby the
user has to close the card, find another pin, and tap it - and on a phone the
card covers the half of the map where the neighbouring pins are. Browsing the
neighbourhood costs one full close/find/open cycle per event.

Wanted instead: from an open card, a horizontal swipe (mobile) or an arrow
(desktop) moves the map onto a nearby event and opens its card, and the opposite
swipe walks back along exactly the path already taken.

## The Chain Model

The state is a **path with an anchor, growing at both ends**:

```
path      = [anchor]   // the event opened by tapping a pin
cursor    = 0          // where along the path we currently are
anchorIdx = 0          // where the anchor sits, once the path has grown westward
```

The anchor is the event the user opened by hand. The path grows east of it and
west of it, and the cursor moves along whatever has already been walked.
`anchorIdx` is carried because prepending to the path shifts every index: it is
what lets the strategy tell "this is the first step on this side" from "we are
extending a side that has already been walked", which is the difference between
a compass step and a nearest-neighbour hop.

| Situation | Result |
|---|---|
| `east`, cursor not at the end | `cursor + 1` - walk forward over known ground |
| `east`, cursor at the end | extend, append to the end, cursor follows |
| `west`, cursor not at the start | `cursor - 1` |
| `west`, cursor at the start | extend, prepend to the start, cursor stays 0 |
| extend finds nothing | no move; the card springs back |

**Swipe left means east.** The card leaves to the left and the next one arrives
from the right, which on a map is the east - the same direction the photo
carousel in the same card already moves, and the same as the desktop arrows.

### How "the next one" is chosen (geographic strategy)

Candidates are the pool minus everything already in `path`, within
`MAX_JUMP_KM = 50` of the current tip of the path. Among those, the nearest by
haversine wins; ties break on `id` so the walk is deterministic.

One extra rule applies **only to the first step on each side** - east while
`anchorIdx === path.length - 1`, west while `anchorIdx === 0`: the candidates are
restricted to a half plane - `east` keeps only `lng > anchor.lng`, `west` only `lng < anchor.lng`.
That is what makes the very first swipe mean a compass direction. Every step
after it is a plain nearest-unvisited hop, so the walk follows the actual shape
of the neighbourhood instead of marching in a straight line.

Events sharing a location are ordinary stops at ~0 km, so a swipe reads through
everything happening at one venue before moving on. That falls out of the
distance rule; it is not a special case.

### Why it is isolated

The requirement is that this mechanism can be swapped without touching the card
or the map. So the model above lives in one pure module with no React import,
behind a `ChainStrategy` interface, and `step` - the part that walks the path -
knows nothing about geography. Replacing the strategy is one file.

## Scope

The chain works everywhere the event card appears, but each context brings its
own pool and its own strategy.

- **Map card** (pin tap or deep link): `geoStrategy` over the map's events.
- **My Events / Followed Events**: `listStrategy` - the tip's position in the
  list, plus or minus one. The pool is the list in display order
  (live, then upcoming, then ended). Geography would drag the user out of the
  list they deliberately opened.

## The Pool

For the map, the pool is `visibleEvents` from `MapScreen` - everything fetched
for the current `fetchView`, after category filters, **not** clipped to the
viewport. Two consequences, both intended:

- The chain can lead past the edge of the screen, which is the point: the map
  flies to the next event.
- **The chain only ever contains what the filters allow.** With no filters
  selected that is every event; with filters selected it is only the matching
  ones. A pin that is not on the map is never a stop on the chain.

## Resetting

The chain is discarded when the card closes. It is also reset when the pool is
replaced under it - **a change of category filters or of the day on the
timeline**. Both are reachable while the card is open (the timeline is visible
in `peek`), and both swap `visibleEvents` wholesale.

A reset does **not** close the card and does not move the map. It collapses the
path to the event currently on screen:

```
path = [current], cursor = 0
```

The event being looked at becomes the new anchor. Nothing disappears from under
the user; only the history of where they have been is dropped. The next swipe is
therefore a first swipe again - half-plane east or west from the new anchor,
drawn from the new pool.

An open event that no longer matches the filters stays open. The user is looking
at it, so it has earned its place on screen - it simply stops being part of the
chain, and once left it will not be returned to.

List contexts have no filters and no timeline, so their chains reset on close
only.

## Back Button

A swipe does **not** push a history entry. The hardware back button on Android
and the back gesture on iOS close the card in one move, however many events were
swiped through. Walking back along the chain is what the opposite swipe is for;
making back do it too would mean fifteen presses to escape a card.

## Gesture

`EventSheet` currently handles `touchstart`/`touchend` only, for the
peek/half/full snaps. It gains `touchmove` and an **axis lock**: after roughly
10 px of movement the gesture commits to vertical (snaps, thresholds unchanged)
or horizontal (chain), and does not change its mind before the finger lifts.

The horizontal gesture **follows the finger**: the card content translates with
the touch, one to one, with no transition while the finger is down. What happens
on release depends on whether the walk actually moved, so `onChainStep` reports
that back as a boolean.

**The step committed** (past ~25% of the card width, minimum 70 px, and the chain
had somewhere to go): the new event is already underneath by the time the finger
lifts, so there is nothing to slide out - but there is something to slide in. The
card is placed a full width off-screen on the side **opposite** the finger's
travel and released to zero: swipe left and the next card arrives from the right,
the way the next slide of a carousel does. Two animation frames separate the
placement from the release, because otherwise the browser folds both positions
into one paint and the transition has nothing to move from.

**The step was blocked or the throw was short**: the card springs back to zero
from wherever the finger left it, with the same event still under it. That
spring, with nothing new behind it, is how the end of the chain announces itself
- and it must stay visibly different from the entry above, which is why the two
cases animate from different places.

Regions that already own the horizontal axis opt out via `data-no-hswipe`: the
photo frame and the tag bar, both of which scroll horizontally today. The
vertical gesture keeps working there exactly as it does now. The chain is also
disabled while the chat panel covers the card.

## Desktop

Chevrons - the caret alone, no stem - sit beside the card at its vertical middle,
in ink, with no background or border: a 12x20 drawing inside a 44x44 hit area.
At the end of the chain the chevron drops to 25% opacity.

The card is pinned to `left: 24px` from 768 px up, which leaves no room for a
left-hand chevron. The card moves to `left: 76px`. At the narrowest desktop
width that is 76 + 320 + 44 = 440 px of a 768 px viewport, so the map stays
visible on the right, where the zoom controls already are.

The card element carries `overflow: hidden`, so a chevron placed beside it would
be clipped. The sheet splits into two elements: `.event-sheet` keeps the
position, size and height animation and stops clipping, and a new
`.event-sheet-card` inside it takes the white background, the rounded corners and
the overflow. The chevrons are siblings of that card inside the shell.

The left and right arrow keys do the same thing as the chevron on their own side
- right for the next event, left for the previous. That is deliberately **not**
the swipe's mapping: a swipe left means east because the card leaves to the left
and the next one arrives from the right, but a key press drags nothing, and what
the user sees is two chevrons with the right one labelled "next". The keys follow
the chevrons. They are ignored when focus is in an `input` or `textarea` (the
chat composer) or when a modal is open.

## Components

**`src/lib/eventChain.ts`** (new, pure)

```ts
export type Chain = { path: EventWithMeta[]; cursor: number; anchorIdx: number }
export type Dir   = 'east' | 'west'        // 'east' is a swipe to the left

export const MAX_JUMP_KM = 50

export interface ChainStrategy {
  /** The event a step in this direction lands on, or null at the end. */
  extend(chain: Chain, pool: EventWithMeta[], dir: Dir): EventWithMeta | null
}

export const geoStrategy: ChainStrategy
export const listStrategy: ChainStrategy

export function startChain(anchor: EventWithMeta): Chain
export function step(
  chain: Chain, pool: EventWithMeta[], dir: Dir, strategy: ChainStrategy,
): Chain | null
```

**`src/hooks/useEventChain.ts`** - holds the `Chain`, exposes
`{ current, start(ev), close(), replace(ev), canGo(dir), go(dir) }`. `go` returns
the new event or `null`, so the caller knows whether to fly the map or bounce the
card. `replace` swaps the event under the cursor without disturbing the path -
that is what an edit saved from the card needs. Takes a `poolKey`; when it
changes, the path collapses to `[current]`.

**`src/lib/cardDrag.ts`** (new, pure) - the axis lock and the commit threshold as
plain functions, following the `blobPhysics.ts` / `useBlobPhysics.ts` split the
codebase already uses.

**`src/hooks/useCardDrag.ts`** - the React glue around it, lifted out of
`EventSheet` so the sheet is not carrying gesture arithmetic.

**`src/components/ChainArrow.tsx`** - the chevron.

## Wiring

`MapScreen` gains `onPoolChange?: (events: EventWithMeta[], poolKey: string) => void`,
called from an effect on `visibleEvents`. The key is a signature of the selected
filters and the day index - one call rather than two states to keep in sync,
since `selectedFilters` and `dayIdx` both live in `MapScreen`.

`App` runs three independent chains: the map's (`geoStrategy`) and one each for
My Events and Followed Events (`listStrategy`). The list screens hand their
ordered list up alongside the tapped event: `onOpenEvent(ev, list)`.

`selEvent` stops being state of its own and becomes `chain.current`.
`setSelEvent(ev)` becomes `chain.start(ev)` and `setSelEvent(null)` becomes
`chain.close()`. Two sources of truth about which event is open would drift; the
touched call sites in `App.tsx` are the price of not having them.

Flying the map needs nothing new - `flyToFnRef` already offsets the centre so
the pin lands above the card.

## Testing

The decisions all live in `eventChain.test.ts`: the first step lands on the
nearest event with a greater longitude; walking back retraces the same events;
crossing the anchor opens the western side; the 50 km cap ends the chain;
visited events never come back; co-located events are walked in turn;
`listStrategy` moves by index. A component test covers the arrows, their
disabled state, and the keyboard.

## Edge Cases

- **The pool changes under the chain.** Visited events stay in `path` even if
  they leave the pool - they have been seen. New steps read the current pool.
- **`peek`** responds to the swipe like any other snap state.
- **`prefers-reduced-motion`** is already handled globally in `index.css`, which
  kills the commit animation. Dragging still tracks the finger.
- **Deep-linked and private events** are ordinary anchors.

## Out of Scope

No visual hint that a chain exists (no counter, no dots). No persistence across
app restarts. No change to how pins, clusters, or the picker behave on the map.

## i18n

`event.chainNext` and `event.chainPrev` (aria-labels) in all five locale files -
`pl`, `en`, `es`, `de`, `sl`. `locales/parity.test.ts` enforces the set.
