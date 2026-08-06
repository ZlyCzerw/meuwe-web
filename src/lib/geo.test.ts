import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  haversineKm, countryToLang, parseIpGeo, getIpLocation,
  kmToZoom, startupZoom, MAX_MAP_ZOOM, bboxDeltas,
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

describe('bboxDeltas', () => {
  const RZESZOW = { lat: 50.0413, lng: 21.9990 }
  const TENERIFE = { lat: 28.4636, lng: -16.2518 }

  // The box is only useful if its edge is actually the distance it promises, so
  // every reach test asks haversineKm rather than re-deriving the arithmetic.
  const reachesNorth = (km: number, lat: number, lng: number) => {
    const { dLat } = bboxDeltas(km, lat)
    return haversineKm(lat, lng, lat + dLat, lng)
  }
  const reachesEast = (km: number, lat: number, lng: number) => {
    const { dLng } = bboxDeltas(km, lat)
    return haversineKm(lat, lng, lat, lng + dLng)
  }

  it('reaches the asked-for distance north, at any latitude', () => {
    for (const lat of [0, 28.4636, 50.0413, -33.9]) {
      expect(reachesNorth(50, lat, 21)).toBeCloseTo(50, 0)
    }
  })

  it('reaches the asked-for distance east too — the point of the fix', () => {
    expect(reachesEast(50, RZESZOW.lat, RZESZOW.lng)).toBeCloseTo(50, 0)
    expect(reachesEast(50, TENERIFE.lat, TENERIFE.lng)).toBeCloseTo(50, 0)
    expect(reachesEast(15, RZESZOW.lat, RZESZOW.lng)).toBeCloseTo(15, 0)
  })

  it('widens longitude away from the equator and leaves it alone on it', () => {
    const equator = bboxDeltas(50, 0)
    expect(equator.dLng).toBeCloseTo(equator.dLat, 10)
    expect(bboxDeltas(50, RZESZOW.lat).dLng).toBeGreaterThan(bboxDeltas(50, RZESZOW.lat).dLat)
    // Rzeszów squashes harder than Tenerife: cos(50) < cos(28).
    expect(bboxDeltas(50, RZESZOW.lat).dLng).toBeGreaterThan(bboxDeltas(50, TENERIFE.lat).dLng)
  })

  it('is symmetric about the equator', () => {
    expect(bboxDeltas(50, -50.0413)).toEqual(bboxDeltas(50, 50.0413))
  })

  it('now fetches the event 40 km due east that the old box missed', () => {
    // 40 km east of Rzeszów, built without touching bboxDeltas.
    const east = { lat: RZESZOW.lat, lng: RZESZOW.lng + 40 / (111.19 * Math.cos(RZESZOW.lat * Math.PI / 180)) }
    expect(haversineKm(RZESZOW.lat, RZESZOW.lng, east.lat, east.lng)).toBeCloseTo(40, 0)

    const offset = east.lng - RZESZOW.lng
    expect(offset).toBeLessThanOrEqual(bboxDeltas(50, RZESZOW.lat).dLng)
    expect(offset).toBeGreaterThan(50 / 111) // the one-delta box the queries used to build
  })

  it('stays finite at the poles', () => {
    for (const lat of [90, -90, 89.999]) {
      const { dLng } = bboxDeltas(50, lat)
      expect(Number.isFinite(dLng)).toBe(true)
      expect(dLng).toBeLessThanOrEqual(180)
    }
    expect(bboxDeltas(50, 90).dLng).toBe(180)
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
