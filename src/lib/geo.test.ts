import { describe, it, expect } from 'vitest'
import { haversineKm, countryToLang } from './geo'

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
