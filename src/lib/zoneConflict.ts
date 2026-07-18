// Pin exclusivity zone: each public pin owns a 3x3 m square (centre +/- 1.5 m,
// axis-aligned N/E) for its whole time window. This is a pure mirror of the DB
// trigger rule (supabase/migrations/20260714_pin_exclusivity_zone.sql) used for
// the fast client pre-check and for unit tests. The DB trigger stays the source
// of truth.

export interface ZonePin {
  lat: number
  lng: number
  start_time: string // ISO 8601
  end_time: string   // ISO 8601
  is_private?: boolean
  id?: string
}

const M_PER_DEG_LAT = 111320
const ZONE_SIDE_M = 3 // two 1.5 m half-squares -> overlap when centres < 3 m per axis

export function zonesOverlapSpatially(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): boolean {
  const dLatM = (a.lat - b.lat) * M_PER_DEG_LAT
  const dLngM = (a.lng - b.lng) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180)
  return Math.abs(dLatM) < ZONE_SIDE_M && Math.abs(dLngM) < ZONE_SIDE_M
}

export function intervalsOverlap(
  aStart: string, aEnd: string, bStart: string, bEnd: string,
): boolean {
  const as = Date.parse(aStart), ae = Date.parse(aEnd)
  const bs = Date.parse(bStart), be = Date.parse(bEnd)
  return as < be && bs < ae // strict: touching endpoints do not overlap
}

export function pinsCollide(candidate: ZonePin, existing: ZonePin): boolean {
  if (candidate.is_private || existing.is_private) return false
  if (candidate.id != null && candidate.id === existing.id) return false
  return (
    zonesOverlapSpatially(candidate, existing) &&
    intervalsOverlap(candidate.start_time, candidate.end_time, existing.start_time, existing.end_time)
  )
}
