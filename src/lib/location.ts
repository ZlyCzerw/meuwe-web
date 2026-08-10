import { haversineKm } from './geo'

// When the server copy of the user's position is worth rewriting.
//
// It used to be rewritten every five minutes with whatever value the effect
// closed over on its first run — which never changed, because the effect
// depended on `!!userPos` rather than on the position itself. The map followed
// the user while the fan-out measured from wherever they opened the app.

/** Below this the fan-out would reach the same events anyway. */
export const MOVE_THRESHOLD_M = 100
/** The watch fires on jitter; one write a minute is plenty. */
export const MIN_WRITE_INTERVAL_MS = 60_000
/** The same write refreshes last_seen_at, so standing still still reports in. */
export const HEARTBEAT_MS = 5 * 60_000

export interface WrittenLocation { lat: number; lng: number; at: number }

export function shouldWriteLocation(ctx: {
  next: { lat: number; lng: number }
  last: WrittenLocation | null
  now: number
}): boolean {
  if (!ctx.last) return true
  const since = ctx.now - ctx.last.at
  if (since >= HEARTBEAT_MS) return true
  if (since < MIN_WRITE_INTERVAL_MS) return false
  const movedM = haversineKm(ctx.last.lat, ctx.last.lng, ctx.next.lat, ctx.next.lng) * 1000
  return movedM >= MOVE_THRESHOLD_M
}
