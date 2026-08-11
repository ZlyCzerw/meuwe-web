import { haversineKm } from './geo'
import { fetchBox, type FetchView } from './mapView'
import type { EventWithMeta } from './types'

/** Carry-over kept for regions the map has left. Events inside the current
 *  fetch box are never counted against it, so nothing on screen is evicted. */
export const KEEP_OUTSIDE_BOX = 400

/**
 * Folds a fresh answer into the events already in hand.
 *
 * The rule is that an answer is authoritative inside its own box and silent
 * about everything else. So the box is emptied of what the cache thought was in
 * it — that is what makes an event that ended, was deleted or was moved
 * disappear — and refilled from the answer, while events from views the map has
 * already left are simply left alone.
 *
 * They cannot go stale on screen: the fetch box always contains the viewport,
 * so anything visible has just been re-stated by the answer. Carry-over only
 * exists so that panning does not blank the map while the next answer is in the
 * air, and it becomes authoritative again the moment the user reaches it.
 *
 * Emptying the box by the *cached* coordinates rather than the answered ones is
 * what keeps a relocated event from leaving a copy of itself behind.
 */
export function mergeEvents(
  cache: EventWithMeta[],
  answer: EventWithMeta[],
  box: FetchView,
  keepOutsideBox: number = KEEP_OUTSIDE_BOX,
): EventWithMeta[] {
  const b = fetchBox(box)
  let carried = cache.filter(e =>
    e.lat < b.minLat || e.lat > b.maxLat || e.lng < b.minLng || e.lng > b.maxLng)

  if (carried.length > keepOutsideBox) {
    carried = carried
      .map(e => ({ e, d: haversineKm(box.lat, box.lng, e.lat, e.lng) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, keepOutsideBox)
      .map(x => x.e)
  }

  const seen = new Set(answer.map(e => e.id))
  return [...answer, ...carried.filter(e => !seen.has(e.id))]
}
