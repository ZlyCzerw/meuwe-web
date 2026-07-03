import type { Coords, MeuweEvent } from './types.ts'
import { normalizeName } from './geocoder.ts'
import type { AliasPair } from './sql.ts'

export interface DedupeResult {
  kept: MeuweEvent[]
  aliases: AliasPair[]
}

const MAX_DIST_M = 300

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
 * match, they start on the same calendar day, and venues are within 300 m.
 * Same-day only — consecutive-day occurrences (multi-day exhibitions, runs
 * of shows) are distinct events. Losers become external-id aliases of the
 * kept event so they never re-insert.
 */
export function dedupe(events: MeuweEvent[]): DedupeResult {
  const sorted = [...events].sort((a, b) => richness(b) - richness(a))
  const kept: MeuweEvent[] = []
  const aliases: AliasPair[] = []

  const day = (d: Date) => d.toISOString().slice(0, 10)

  for (const ev of sorted) {
    const dup = kept.find(k =>
      normalizeName(k.title) === normalizeName(ev.title) &&
      day(k.startTime) === day(ev.startTime) &&
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
