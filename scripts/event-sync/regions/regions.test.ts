import { describe, it, expect } from 'vitest'
import { REGIONS } from './index.ts'
import { TribeEventsSource } from '../sources/tribe.ts'

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

describe('rzeszow region', () => {
  it('is strict, Polish, and covers the surrounding towns', () => {
    const r = REGIONS.rzeszow
    expect(r.precision).toBe('strict')
    expect(r.timezone).toBe('Europe/Warsaw')
    expect(r.country).toBe('PL')
    for (const town of ['rzeszów', 'tyczyn', 'boguchwała', 'łańcut', 'jasionka']) {
      expect(r.cityCoords[town], town).toBeDefined()
    }
  })
  it('every venue and city sits inside the region bbox', () => {
    const r = REGIONS.rzeszow
    const inBox = (lat: number, lng: number) =>
      lat >= r.bbox.minLat && lat <= r.bbox.maxLat && lng >= r.bbox.minLng && lng <= r.bbox.maxLng
    for (const v of r.venues) expect(inBox(v.lat, v.lng), v.name).toBe(true)
    for (const [city, c] of Object.entries(r.cityCoords)) expect(inBox(c.lat, c.lng), city).toBe(true)
  })
  it('venue aliases are already normalized (lowercase ascii)', () => {
    for (const v of REGIONS.rzeszow.venues)
      for (const a of v.aliases)
        expect(a, `${v.name}: "${a}"`).toMatch(/^[a-z0-9 ]+$/)
  })
  it('includes configured Tribe sources for RDK, Koncerty w Rzeszowie and Pod Palma', () => {
    const tribe = REGIONS.rzeszow.sources.find((s): s is TribeEventsSource => s instanceof TribeEventsSource)
    expect(tribe?.siteIds()).toEqual(['rdk', 'koncertywrzeszowie', 'podpalma'])
  })
})
