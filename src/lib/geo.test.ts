import { describe, it, expect, vi, afterEach } from 'vitest'
import { haversineKm, countryToLang, parseIpGeo, getIpLocation } from './geo'

describe('haversineKm', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineKm(52.2297,21.0122,52.2297,21.0122)).toBeCloseTo(0, 5)
  })
  it('Warsaw→Krakow ≈ 252 km', () => {
    expect(haversineKm(52.2297,21.0122,50.0647,19.945)).toBeGreaterThan(240)
    expect(haversineKm(52.2297,21.0122,50.0647,19.945)).toBeLessThan(265)
  })
})

describe('countryToLang', () => {
  it('PL → pl', () => expect(countryToLang('PL')).toBe('pl'))
  it('pl lowercase → pl', () => expect(countryToLang('pl')).toBe('pl'))
  it('ES → es', () => expect(countryToLang('ES')).toBe('es'))
  it('MX → es', () => expect(countryToLang('MX')).toBe('es'))
  it('US → en', () => expect(countryToLang('US')).toBe('en'))
  it('unknown → en', () => expect(countryToLang('ZZ')).toBe('en'))
})

afterEach(() => { vi.unstubAllGlobals() })

describe('parseIpGeo', () => {
  it('parses numeric lat/lng', () => {
    expect(parseIpGeo({ lat: 41.38, lng: 2.17, country: 'ES' }))
      .toEqual({ lat: 41.38, lng: 2.17, country: 'ES' })
  })
  it('coerces string lat/lng and uppercases country', () => {
    expect(parseIpGeo({ lat: '41.38', lng: '2.17', country: 'es' }))
      .toEqual({ lat: 41.38, lng: 2.17, country: 'ES' })
  })
  it('returns null without finite coords', () => {
    expect(parseIpGeo({ country: 'ES' })).toBeNull()
    expect(parseIpGeo(null)).toBeNull()
    expect(parseIpGeo({ lat: 'x', lng: 'y' })).toBeNull()
  })
})

describe('getIpLocation', () => {
  it('returns parsed location on ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ lat: 41.38, lng: 2.17, country: 'ES' }),
    }))
    expect(await getIpLocation()).toEqual({ lat: 41.38, lng: 2.17, country: 'ES' })
  })
  it('returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    expect(await getIpLocation()).toBeNull()
  })
  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await getIpLocation()).toBeNull()
  })
})
