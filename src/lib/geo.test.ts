import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  haversineKm, countryToLang, parseIpGeo, getIpLocation,
  kmToZoom, startupZoom, MAX_MAP_ZOOM,
} from './geo'

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
  it('SI → sl', () => expect(countryToLang('SI')).toBe('sl'))
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

describe('kmToZoom', () => {
  const WARSAW_LAT = 52.23
  // The map is square-cropped by the shorter screen edge, so the framing rule is
  // about that edge. jsdom reports 1024x768 unless a test says otherwise.
  const screen = (w: number, h: number) => {
    Object.defineProperty(window, 'innerWidth', { value: w, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
  }

  it('frames the requested distance to roughly half the shorter edge', () => {
    screen(375, 812)
    // A 2 km half-width should put the whole 4 km across the short edge; the
    // exact zoom is whatever gets closest, but it has to be in the right place.
    const z = kmToZoom(2, WARSAW_LAT)
    expect(z).toBeGreaterThanOrEqual(12)
    expect(z).toBeLessThanOrEqual(14)
  })

  it('goes further out for a further target', () => {
    screen(375, 812)
    expect(kmToZoom(20, WARSAW_LAT)).toBeLessThan(kmToZoom(2, WARSAW_LAT))
  })

  // 18 is close enough to read street names without landing on a roof; without a
  // cap, an event 200 m away would frame a single building.
  it('never zooms in past 18, however close the target', () => {
    screen(375, 812)
    expect(kmToZoom(0.05, WARSAW_LAT)).toBe(MAX_MAP_ZOOM)
    expect(MAX_MAP_ZOOM).toBe(18)
  })

  it('never zooms out past the widest radius the fan-out honours', () => {
    screen(375, 812)
    expect(kmToZoom(500, WARSAW_LAT)).toBe(kmToZoom(50, WARSAW_LAT))
  })

  it('returns whole zoom levels', () => {
    screen(375, 812)
    expect(Number.isInteger(kmToZoom(7.3, WARSAW_LAT))).toBe(true)
  })
})

describe('startupZoom', () => {
  const LAT = 52.23

  // Same rule as the notification radius: reach the nearest thing happening and
  // the same distance again, so the first thing on screen has company.
  it('frames twice the distance to the nearest event', () => {
    expect(startupZoom(6, LAT)).toBe(kmToZoom(12, LAT))
  })

  it('stops widening at 50 km', () => {
    expect(startupZoom(80, LAT)).toBe(kmToZoom(50, LAT))
  })

  // Nothing found, or no position: show the whole area rather than a street.
  it('opens up all the way when there is nothing to measure against', () => {
    expect(startupZoom(null, LAT)).toBe(kmToZoom(50, LAT))
  })
})
