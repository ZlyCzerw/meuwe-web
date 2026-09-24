import { describe, it, expect } from 'vitest'
import { clusterPublicEvents, formatClusterCount } from './eventClusters'
import type { EventWithMeta } from './types'
import { zonesOverlapSpatially } from './zoneConflict'

let idc = 0
function ev(over: Partial<EventWithMeta> = {}): EventWithMeta {
  return {
    id: `e${idc++}`,
    lat: 50.0, lng: 22.0,
    start_time: '2026-07-14T10:00:00.000Z',
    end_time: '2026-07-14T12:00:00.000Z',
    is_private: false,
    ...over,
  } as EventWithMeta
}
const DLAT_2M = 2 / 111320
const DLNG_10M = 10 / (111320 * Math.cos((50 * Math.PI) / 180))

describe('clusterPublicEvents', () => {
  it('single event -> one cluster of size 1', () => {
    const c = clusterPublicEvents([ev()])
    expect(c).toHaveLength(1)
    expect(c[0]).toHaveLength(1)
  })

  it('three same-zone events -> one cluster, representative earliest by start', () => {
    const a = ev({ id: 'a', start_time: '2026-07-14T14:00:00.000Z', end_time: '2026-07-14T16:00:00.000Z' })
    const b = ev({ id: 'b', lat: 50.0 + DLAT_2M, start_time: '2026-07-14T10:00:00.000Z', end_time: '2026-07-14T12:00:00.000Z' })
    const c2 = ev({ id: 'c', lat: 50.0 - DLAT_2M, start_time: '2026-07-14T12:00:00.000Z', end_time: '2026-07-14T13:00:00.000Z' })
    const cl = clusterPublicEvents([a, b, c2])
    expect(cl).toHaveLength(1)
    expect(cl[0]).toHaveLength(3)
    expect(cl[0][0].id).toBe('b') // earliest start (10:00) is the representative
  })

  it('two far-apart events -> two clusters', () => {
    const cl = clusterPublicEvents([ev({ id: 'a' }), ev({ id: 'b', lng: 22.0 + DLNG_10M })])
    expect(cl).toHaveLength(2)
    expect(cl.every(c => c.length === 1)).toBe(true)
  })

  it('private events are excluded from clustering', () => {
    const cl = clusterPublicEvents([ev({ id: 'a' }), ev({ id: 'p', is_private: true })])
    expect(cl).toHaveLength(1)
    expect(cl[0].map(e => e.id)).toEqual(['a'])
  })
})

describe('formatClusterCount', () => {
  it('1..9 -> the number', () => {
    expect(formatClusterCount(1)).toBe('1')
    expect(formatClusterCount(9)).toBe('9')
  })
  it('>9 -> ">9"', () => {
    expect(formatClusterCount(10)).toBe('>9')
    expect(formatClusterCount(42)).toBe('>9')
  })
})

// Wzorzec: implementacja sprzed siatki, słowo w słowo.
function legacyCluster(events: EventWithMeta[]): EventWithMeta[][] {
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
      if (zonesOverlapSpatially(anchor, pub[j])) { used[j] = true; group.push(pub[j]) }
    }
    group.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    clusters.push(group)
  }
  return clusters
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

const ids1 = (cs: EventWithMeta[][]) => cs.map(c => c.map(e => e.id))

describe('clusterPublicEvents - grid matches the pairwise sweep', () => {
  const M = 111320
  for (const [label, lat0] of [['Rzeszów', 50.04], ['Teneryfa', 28.3], ['Gdańsk', 54.35]] as const) {
    it(`same groups in the same order around ${label}`, () => {
      const r = seeded(lat0 * 1000)
      const cosL = Math.cos((lat0 * Math.PI) / 180)
      const evs: EventWithMeta[] = []
      for (let i = 0; i < 600; i++) {
        const base = evs.length && r() < 0.4 ? evs[Math.floor(r() * evs.length)] : null
        // obok istniejącego: 0-4 m, czyli także tuż pod i tuż nad progiem 3 m
        const dN = base ? (r() * 8 - 4) : (r() - 0.5) * 2000
        const dE = base ? (r() * 8 - 4) : (r() - 0.5) * 2000
        const lat = (base ? base.lat : lat0) + dN / M
        const lng = (base ? base.lng : 22) + dE / (M * cosL)
        const h = Math.floor(r() * 5)
        evs.push(ev({
          id: `r${i}`, lat, lng, is_private: r() < 0.05,
          start_time: `2026-07-14T1${h}:00:00.000Z`, end_time: `2026-07-14T1${h + 1}:00:00.000Z`,
        }))
      }
      const legacy = legacyCluster(evs)
      expect(legacy.filter(c => c.length > 1).length).toBeGreaterThan(20) // dane naprawdę tworzą klastry
      expect(ids1(clusterPublicEvents(evs))).toEqual(ids1(legacy))
    })
  }

  it('exactly on a grid line still groups with a neighbour 1 m away', () => {
    const cell = 3 / M
    const a = ev({ id: 'a', lat: cell * 16680, lng: 22 })
    const b = ev({ id: 'b', lat: cell * 16680 - 1 / M, lng: 22 })
    expect(ids1(clusterPublicEvents([a, b]))).toEqual([['a', 'b']])
  })
})
