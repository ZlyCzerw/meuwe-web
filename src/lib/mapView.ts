import { bboxDeltas } from './geo'

/** A centre and a reach, in kilometres. What one map query covers. */
export type FetchView = { lat: number; lng: number; km: number }

export type LatLngBox = { minLat: number; maxLat: number; minLng: number; maxLng: number }

/**
 * How much wider than the viewport a fetch reaches. The margin is not there to
 * put more pins on the map — the cache does that — it is there so that nudging
 * the map by a few pixels does not cost a round trip.
 */
export const FETCH_MARGIN = 1.3

export function fetchBox(v: FetchView): LatLngBox {
  const { dLat, dLng } = bboxDeltas(v.km, v.lat)
  return { minLat: v.lat - dLat, maxLat: v.lat + dLat, minLng: v.lng - dLng, maxLng: v.lng + dLng }
}

function contains(outer: LatLngBox, inner: LatLngBox): boolean {
  return inner.minLat >= outer.minLat && inner.maxLat <= outer.maxLat
    && inner.minLng >= outer.minLng && inner.maxLng <= outer.maxLng
}

/**
 * The view the map should fetch for, or null when `covered` — what was last
 * fetched — already takes in the whole viewport.
 *
 * There is no ceiling. The map fetches whatever it is showing, however far out
 * that is: a limit here would be a limit on which pins appear on screen, and
 * the one that used to be here was the push fan-out's radius, which had no
 * business deciding that. The row cap in getEvents is what keeps a query
 * bounded; this only decides when to ask.
 *
 * The margin is the whole of the hysteresis. What gets fetched is the viewport
 * plus the margin, and a refetch is due only once the bare viewport leaves it,
 * so a third of a screen of panning in any direction asks nothing at all.
 */
export function nextFetchView(covered: FetchView | null, viewport: FetchView): FetchView | null {
  if (covered && contains(fetchBox(covered), fetchBox(viewport))) return null
  return { lat: viewport.lat, lng: viewport.lng, km: Math.ceil(viewport.km * FETCH_MARGIN) }
}
