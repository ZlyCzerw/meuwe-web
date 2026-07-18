import { describe, it, expect } from 'vitest'
import { pinsCollide, type ZonePin } from './zoneConflict'

// Base pin: a 4h public window starting "now", at a fixed point.
const T0 = '2026-07-14T10:00:00.000Z'
const T4 = '2026-07-14T14:00:00.000Z'
function pin(over: Partial<ZonePin> = {}): ZonePin {
  return { lat: 50.0, lng: 22.0, start_time: T0, end_time: T4, is_private: false, ...over }
}

// ~1 deg lat = 111320 m, so 2 m north ≈ 0.00001796 deg. cos(50°) ≈ 0.6428,
// so 2 m east ≈ 0.00002794 deg lng. 4 m east ≈ 0.00005588 deg lng.
const DLAT_2M = 2 / 111320
const DLNG_4M = 4 / (111320 * Math.cos((50 * Math.PI) / 180))

describe('pinsCollide', () => {
  it('collides: same spot, overlapping time', () => {
    expect(pinsCollide(pin(), pin())).toBe(true)
  })

  it('collides: 2 m apart (zones overlap) + overlapping time', () => {
    expect(pinsCollide(pin(), pin({ lat: 50.0 + DLAT_2M }))).toBe(true)
  })

  it('no collision: 4 m east apart (zones disjoint) even with overlapping time', () => {
    expect(pinsCollide(pin(), pin({ lng: 22.0 + DLNG_4M }))).toBe(false)
  })

  it('no collision: same spot but disjoint time', () => {
    const later = pin({ start_time: '2026-07-14T14:00:00.000Z', end_time: '2026-07-14T18:00:00.000Z' })
    expect(pinsCollide(pin(), later)).toBe(false)
  })

  it('no collision: back-to-back times touching exactly at the boundary', () => {
    const back = pin({ start_time: T4, end_time: '2026-07-14T18:00:00.000Z' })
    expect(pinsCollide(pin(), back)).toBe(false)
  })

  it('no collision: candidate is private', () => {
    expect(pinsCollide(pin({ is_private: true }), pin())).toBe(false)
  })

  it('no collision: existing is private', () => {
    expect(pinsCollide(pin(), pin({ is_private: true }))).toBe(false)
  })

  it('no collision: same id (self, edit case)', () => {
    expect(pinsCollide(pin({ id: 'abc' }), pin({ id: 'abc' }))).toBe(false)
  })
})
