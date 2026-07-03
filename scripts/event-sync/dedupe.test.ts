import { describe, it, expect } from 'vitest'
import { dedupe, haversineMeters } from './dedupe.ts'
import type { MeuweEvent } from './types.ts'

function ev(overrides: Partial<MeuweEvent>): MeuweEvent {
  return {
    externalId: 'x:1',
    title: 'Koncert Zespołu',
    description: 'opis',
    lat: 50.0435, lng: 22.0087,
    placeName: 'Filharmonia Podkarpacka, Rzeszów',
    category: 'music',
    startTime: new Date('2026-07-10T17:00:00Z'),
    endTime: new Date('2026-07-10T19:00:00Z'),
    tags: ['music'],
    photos: [],
    ...overrides,
  }
}

describe('haversineMeters', () => {
  it('measures ~111 km per degree of latitude', () => {
    const d = haversineMeters({ lat: 50.0, lng: 22.0 }, { lat: 51.0, lng: 22.0 })
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('dedupe', () => {
  it('merges same title + close time + close location across sources', () => {
    const a = ev({ externalId: 'ebilet:1', description: 'a'.repeat(500), photos: ['x.jpg'] })
    const b = ev({ externalId: 'estrada:2:2026-07-10', title: 'Koncert  Zespołu!' })
    const { kept, aliases } = dedupe([a, b])
    expect(kept).toHaveLength(1)
    expect(kept[0].externalId).toBe('ebilet:1') // richer record wins
    expect(aliases).toEqual([{ alias: 'estrada:2:2026-07-10', canonical: 'ebilet:1' }])
  })

  it('does NOT merge same title on different days', () => {
    const a = ev({ externalId: 'a:1' })
    const b = ev({
      externalId: 'b:1',
      startTime: new Date('2026-07-12T17:00:00Z'),
      endTime: new Date('2026-07-12T19:00:00Z'),
    })
    expect(dedupe([a, b]).kept).toHaveLength(2)
  })

  it('does NOT merge same title same day at distant venues (> 300 m)', () => {
    const a = ev({ externalId: 'a:1' })
    const b = ev({ externalId: 'b:1', lat: 50.0295, lng: 22.0012 }) // Podpromie, ~1.6 km away
    expect(dedupe([a, b]).kept).toHaveLength(2)
  })
})
