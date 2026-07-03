import type { Coords, MeuweEvent } from './types.ts'
import { normalizeName } from './geocoder.ts'
import type { AliasPair } from './sql.ts'

export interface DedupeResult {
  kept: MeuweEvent[]
  aliases: AliasPair[]
}

const MAX_DIST_M = 300
const MAX_TIME_DIFF_MS = 24 * 3_600_000

export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Richer record wins: images count double, description length breaks ties. */
function richness(e: MeuweEvent): number {
  return (e.photos.length ? 2 : 0) + Math.min(e.description.length, 1000) / 1000
}

/**
 * Cross-source dedup: two events are duplicates when the normalized titles
 * match, starts are within 24 h, and venues within 300 m. Losers become
 * external-id aliases of the kept event so they never re-insert.
 */
export function dedupe(events: MeuweEvent[]): DedupeResult {
  const sorted = [...events].sort((a, b) => richness(b) - richness(a))
  const kept: MeuweEvent[] = []
  const aliases: AliasPair[] = []

  for (const ev of sorted) {
    const dup = kept.find(k =>
      normalizeName(k.title) === normalizeName(ev.title) &&
      Math.abs(k.startTime.getTime() - ev.startTime.getTime()) <= MAX_TIME_DIFF_MS &&
      haversineMeters(k, ev) < MAX_DIST_M,
    )
    if (dup) {
      aliases.push({ alias: ev.externalId, canonical: dup.externalId })
    } else {
      kept.push(ev)
    }
  }
  return { kept, aliases }
}
