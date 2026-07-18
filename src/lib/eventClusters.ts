import { zonesOverlapSpatially } from './zoneConflict'
import type { EventWithMeta } from './types'

// Group PUBLIC events that share a 3x3 m zone into clusters. Private events are
// filtered out here (clustering is public-only). Each cluster is sorted by
// start_time ascending, so cluster[0] is the current-or-next representative.
// Single-pass anchor sweep: real data places same-venue events at identical
// coordinates, so transitive chaining is a non-issue.
export function clusterPublicEvents(events: EventWithMeta[]): EventWithMeta[][] {
  const pub = events.filter(e => !e.is_private)
  const used = new Array(pub.length).fill(false)
  const clusters: EventWithMeta[][] = []
  for (let i = 0; i < pub.length; i++) {
    if (used[i]) continue
    used[i] = true
    const anchor = pub[i]
    const group = [anchor]
    for (let j = i + 1; j < pub.length; j++) {
      if (used[j]) continue
      if (zonesOverlapSpatially(anchor, pub[j])) {
        used[j] = true
        group.push(pub[j])
      }
    }
    group.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    clusters.push(group)
  }
  return clusters
}

// Badge label: 1..9 verbatim, anything above -> ">9".
export function formatClusterCount(n: number): string {
  return n > 9 ? '>9' : String(n)
}
