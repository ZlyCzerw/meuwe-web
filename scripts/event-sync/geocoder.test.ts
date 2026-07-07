import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeName, matchVenue, inBbox, Geocoder } from './geocoder.ts'
import { REGIONS } from './regions/index.ts'

const rzeszow = REGIONS.rzeszow
const tmpCache = () => join(mkdtempSync(join(tmpdir(), 'geo-')), 'cache.json')

afterEach(() => vi.unstubAllGlobals())

describe('normalizeName', () => {
  it('strips Polish diacritics incl. ł', () => {
    expect(normalizeName('Zamek w Łańcucie')).toBe('zamek w lancucie')
  })
  it('drops punctuation and collapses whitespace', () => {
    expect(normalizeName('Teatr im. Wandy  Siemaszkowej!')).toBe('teatr im wandy siemaszkowej')
  })
})

describe('matchVenue', () => {
  it('matches a registry venue by substring alias', () => {
    const v = matchVenue('Filharmonia Podkarpacka im. Artura Malawskiego', rzeszow)
    expect(v?.name).toBe('Filharmonia Podkarpacka')
  })
  it('matches Skwer Kultury inside a longer place string', () => {
    const v = matchVenue('Skwer Kultury w Rzeszowie, Rynek', rzeszow)
    expect(v?.name).toBe('Rzeszowskie Piwnice / Skwer Kultury')
  })
  it('returns null for unknown venues', () => {
    expect(matchVenue('Klub Nieznany', rzeszow)).toBeNull()
  })
  it('does not match the out-of-region Underground Pub candidate alias', () => {
    expect(matchVenue('Underground Pub', rzeszow)).toBeNull()
  })
  it('matches Rzeszow venues recovered from live no-venue-match output', () => {
    expect(matchVenue('Aloha - Food, Bowling & Club', rzeszow)?.name).toBe('ALOHA Food, Bowling & Club')
    expect(matchVenue('Place zabaw na Osiedlu Baranówka', rzeszow)?.name).toBe('Place zabaw na Osiedlu Baranówka')
    expect(matchVenue('Galeria Nierzeczywista RSF, ul. J. Matejki 10, Rzeszów', rzeszow)?.name).toBe('Galeria Nierzeczywista RSF')
    expect(matchVenue('SALA KONCERTOWA FILHARMONII PODKARPACKIEJ', rzeszow)?.name).toBe('Filharmonia Podkarpacka')
    expect(matchVenue('Zespół Szkół Gospodarczych w Rzeszowie', rzeszow)?.name).toBe('Zespół Szkół Gospodarczych')
  })
})

describe('inBbox', () => {
  it('accepts a point inside and rejects one outside', () => {
    expect(inBbox({ lat: 50.04, lng: 22.0 }, rzeszow.bbox)).toBe(true)
    expect(inBbox({ lat: 52.23, lng: 21.01 }, rzeszow.bbox)).toBe(false) // Warsaw
  })
})

describe('Geocoder (strict)', () => {
  it('resolves a registry venue without any network call', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const geo = new Geocoder(rzeszow, tmpCache())
    const r = await geo.geocode('Hala Podpromie', 'Rzeszów')
    expect(r.method).toBe('venue-registry')
    expect(r.coords?.lat).toBeCloseTo(50.02, 1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns method none when Nominatim has nothing (strict drop)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })))
    const geo = new Geocoder(rzeszow, tmpCache())
    const r = await geo.geocode('Klub Nieznany', 'Rzeszów')
    expect(r).toEqual({ coords: null, method: 'none' })
  })

  it('rejects a Nominatim hit outside the bbox (strict)', async () => {
    const warsaw = JSON.stringify([{ lat: '52.2297', lon: '21.0122' }])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(warsaw, { status: 200 })))
    const geo = new Geocoder(rzeszow, tmpCache())
    const r = await geo.geocode('Klub Nieznany', 'Rzeszów')
    expect(r.method).toBe('none')
  })

  it('persists hits to the cache file and reuses them', async () => {
    const inRegion = JSON.stringify([{ lat: '50.05', lon: '22.01' }])
    const fetchSpy = vi.fn(async () => new Response(inRegion, { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const cachePath = tmpCache()
    const geo1 = new Geocoder(rzeszow, cachePath)
    await geo1.geocode('Jakiś Klub', 'Rzeszów')
    geo1.save()
    const geo2 = new Geocoder(rzeszow, cachePath)
    const r = await geo2.geocode('Jakiś Klub', 'Rzeszów')
    expect(r.coords?.lat).toBeCloseTo(50.05)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('Geocoder (lenient = tenerife)', () => {
  it('falls back to cityCoords then center instead of dropping', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })))
    const geo = new Geocoder(REGIONS.tenerife, tmpCache())
    const r = await geo.geocode('Sitio Desconocido', 'Adeje')
    expect(r.method).toBe('city-fallback')
    expect(r.coords).toEqual({ lat: 28.1222, lng: -16.7270 })
    const r2 = await geo.geocode('Sitio Desconocido', 'Ciudad Inexistente XYZ')
    expect(r2.method).toBe('region-center')
    expect(r2.coords).toEqual(REGIONS.tenerife.center)
  })
})
