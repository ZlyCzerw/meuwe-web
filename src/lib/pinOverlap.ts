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
