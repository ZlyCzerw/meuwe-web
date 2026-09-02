// src/lib/placeSearch.test.ts
import { describe, it, expect } from 'vitest'
import { parsePhoton, photonUrl, photonLang, PLACE_RESULT_LIMIT, type PhotonFeature } from './placeSearch'

function feature(name: string, lat: number, lng: number, extra: Partial<PhotonFeature['properties']> = {}): PhotonFeature {
  return { geometry: { coordinates: [lng, lat] }, properties: { osm_id: Math.round(lat * 1000 + lng), name, ...extra } }
}

describe('parsePhoton', () => {
  it('keeps the first of two features with the same name', () => {
    const out = parsePhoton([feature('Rzeszów', 50.04, 22.0), feature('rzeszów', 51, 21)], null)
    expect(out).toHaveLength(1)
    expect(out[0].lat).toBe(50.04)
  })
  it('skips features without a name', () => {
    expect(parsePhoton([feature('', 1, 1)], null)).toEqual([])
  })
  it('builds the secondary line from city, state, country - first two only', () => {
    const [r] = parsePhoton([feature('Puerto de la Cruz', 28.41, -16.55, { state: 'Canarias', country: 'España' })], null)
    expect(r.secondary).toBe('Canarias, España')
  })
  it('sorts by distance from `near` and caps the list', () => {
    const near = { lat: 50, lng: 22 }
    const many = Array.from({ length: 8 }, (_, i) => feature(`P${i}`, 50 + (8 - i) * 0.1, 22))
    const out = parsePhoton(many, near)
    expect(out).toHaveLength(PLACE_RESULT_LIMIT)
    expect(out[0].primary).toBe('P7')
  })
})

describe('photonUrl', () => {
  it('passes query, limit, lang and the bias point', () => {
    const u = new URL(photonUrl('rzesz', { lang: 'en', near: { lat: 50, lng: 22 }, settlementsOnly: false }))
    expect(u.origin + u.pathname).toBe('https://photon.komoot.io/api/')
    expect(u.searchParams.get('q')).toBe('rzesz')
    expect(u.searchParams.get('limit')).toBe('8')
    expect(u.searchParams.get('lang')).toBe('en')
    expect(u.searchParams.get('lat')).toBe('50')
    expect(u.searchParams.get('lon')).toBe('22')
    expect(u.searchParams.getAll('osm_tag')).toEqual([])
  })
  it('restricts to settlements with one osm_tag per kind', () => {
    const u = new URL(photonUrl('puerto', { lang: 'en', near: null, settlementsOnly: true }))
    expect(u.searchParams.getAll('osm_tag')).toEqual(['place:city', 'place:town', 'place:village'])
    expect(u.searchParams.has('lat')).toBe(false)
  })
})

describe('photonLang', () => {
  it('maps to what Photon supports and falls back to en', () => {
    expect(photonLang('de')).toBe('de')
    expect(photonLang('pl')).toBe('en')
    expect(photonLang('sl')).toBe('en')
  })
})
