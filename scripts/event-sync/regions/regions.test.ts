import { describe, it, expect } from 'vitest'
import { REGIONS } from './index.ts'

describe('REGIONS registry', () => {
  it('exposes the tenerife region with v1 behavior flags', () => {
    const t = REGIONS.tenerife
    expect(t.id).toBe('tenerife')
    expect(t.timezone).toBe('Atlantic/Canary')
    expect(t.country).toBe('ES')
    expect(t.precision).toBe('lenient')
    expect(t.center).toEqual({ lat: 28.2916, lng: -16.6291 })
    expect(t.cityCoords['adeje']).toEqual({ lat: 28.1222, lng: -16.7270 })
    expect(t.sources.length).toBeGreaterThanOrEqual(7)
  })
})
