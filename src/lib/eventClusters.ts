import { zonesOverlapSpatially, M_PER_DEG_LAT, ZONE_SIDE_M } from './zoneConflict'
import type { EventWithMeta } from './types'

// Group PUBLIC events that share a 3x3 m zone into clusters. Private events are
// filtered out here (clustering is public-only). Each cluster is sorted by
// start_time ascending, so cluster[0] is the current-or-next representative.
// Single-pass anchor sweep: real data places same-venue events at identical
// coordinates, so transitive chaining is a non-issue.
//
// Kandydaci do strefy kotwicy pochodzą z siatki o boku strefy: wszystko, co
// może się z nią nakładać, leży w jej komórce albo w jednej z ośmiu sąsiednich.
// Komórka w długości liczona jest dla największej |szerokości| w zbiorze - tam
// stopień długości jest najkrótszy, więc komórka wychodzi najszersza i nikt nie
// wypada poza sąsiadów. Kolejność i warunek są te same co w przeglądzie każdy z
// każdym, więc wynik też (pilnuje tego test równoważności).
export function clusterPublicEvents(events: EventWithMeta[]): EventWithMeta[][] {
  const pub = events.filter(e => !e.is_private)
  let maxAbsLat = 0
  for (const e of pub) maxAbsLat = Math.max(maxAbsLat, Math.abs(e.lat))
  const cellLat = ZONE_SIDE_M / M_PER_DEG_LAT
  const cellLng = ZONE_SIDE_M / (M_PER_DEG_LAT * Math.cos((Math.min(maxAbsLat, 89) * Math.PI) / 180))

  const cx = new Array<number>(pub.length)
  const cy = new Array<number>(pub.length)
  const cells = new Map<string, number[]>()
  for (let i = 0; i < pub.length; i++) {
    cx[i] = Math.floor(pub[i].lng / cellLng)
    cy[i] = Math.floor(pub[i].lat / cellLat)
    const k = `${cx[i]}:${cy[i]}`
    const bucket = cells.get(k)
    if (bucket) bucket.push(i)
    else cells.set(k, [i])
  }

  const used = new Array(pub.length).fill(false)
  const clusters: EventWithMeta[][] = []
  for (let i = 0; i < pub.length; i++) {
    if (used[i]) continue
    used[i] = true
    const anchor = pub[i]
    const found: number[] = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = cells.get(`${cx[i] + dx}:${cy[i] + dy}`)
        if (!bucket) continue
        for (const j of bucket) {
          if (j > i && !used[j] && zonesOverlapSpatially(anchor, pub[j])) found.push(j)
        }
      }
    }
    found.sort((a, b) => a - b)
    const group = [anchor]
    for (const j of found) { used[j] = true; group.push(pub[j]) }
    group.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    clusters.push(group)
  }
  return clusters
}

// Badge label: 1..9 verbatim, anything above -> ">9".
export function formatClusterCount(n: number): string {
  return n > 9 ? '>9' : String(n)
}
