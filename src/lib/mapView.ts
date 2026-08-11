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

/**
 * The furthest a single map query will ever reach. Deliberately its own number
 * and not MAX_MAP_KM: that one is the push fan-out's radius, and using it here
 * meant that from about zoom 10 outwards, zooming out stopped adding pins
 * because the user's notification radius said so.
 *
 * 300 km is roughly zoom 7 on a phone — the scale of a country. Past that the
 * map is not showing individual pins in any useful way.
 */
export const MAX_FETCH_KM = 300

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
 * Two boxes, not one. `want` is what gets fetched: the viewport plus the
 * margin. `need` is what has to be inside `covered` for the answer in hand to
 * still be complete. Testing the smaller box while fetching the larger one is
 * the whole of the hysteresis: a third of a screen of panning in any direction
 * asks nothing of the network.
 *
 * At MAX_FETCH_KM the two would collapse into each other and every moveend
 * would refetch, so past the ceiling the requirement shrinks with the fetch
 * rather than the other way round.
 */
export function nextFetchView(covered: FetchView | null, viewport: FetchView): FetchView | null {
  const wantKm = Math.min(Math.ceil(viewport.km * FETCH_MARGIN), MAX_FETCH_KM)
  const needKm = Math.min(viewport.km, wantKm / FETCH_MARGIN)
  const want = { lat: viewport.lat, lng: viewport.lng, km: wantKm }
  if (covered && contains(fetchBox(covered), fetchBox({ ...viewport, km: needKm }))) return null
  return want
}
