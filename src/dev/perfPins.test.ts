import { describe, it, expect } from 'vitest'
import { makePerfEvents } from './perfPins'
import { haversineKm, MAX_MAP_KM } from '../lib/geo'
import { isCurrentlyLive } from '../lib/eventStatus'
import { clusterPublicEvents } from '../lib/eventClusters'

const C = { lat: 52.2297, lng: 21.0122 }
const NOW = new Date('2026-09-24T12:00:00Z')

describe('makePerfEvents', () => {
  it('is deterministic for a seed', () => {
    const a = makePerfEvents(200, C, 7, NOW)
    const b = makePerfEvents(200, C, 7, NOW)
    expect(a.map(e => [e.id, e.lat, e.lng, e.category])).toEqual(b.map(e => [e.id, e.lat, e.lng, e.category]))
  })

  it('returns n events within MAX_MAP_KM of the centre', () => {
    const evs = makePerfEvents(1000, C, 1, NOW)
    expect(evs).toHaveLength(1000)
    for (const e of evs) expect(haversineKm(C.lat, C.lng, e.lat, e.lng)).toBeLessThanOrEqual(MAX_MAP_KM + 0.01)
  })

  it('mixes live, private and same-spot events', () => {
    const evs = makePerfEvents(1000, C, 1, NOW)
    const live = evs.filter(e => isCurrentlyLive(e, [], NOW)).length
    expect(live).toBeGreaterThan(50)
    expect(live).toBeLessThan(150)
    expect(evs.some(e => e.is_private)).toBe(true)
    const pub = evs.filter(e => !e.is_private)
    expect(clusterPublicEvents(pub).length).toBeLessThan(pub.length)
  })
})
