import { describe, it, expect } from 'vitest'
import { clusterPublicEvents, formatClusterCount } from './eventClusters'
import type { EventWithMeta } from './types'

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
