import { describe, it, expect } from 'vitest'
import { computeVisibleCount } from './filterBarFit'

describe('computeVisibleCount', () => {
  const chips = [60, 60, 70, 55, 65]
  const ALL = 70, PLUS = 34, GAP = 8

  it('returns 0 before the container is measured', () => {
    expect(computeVisibleCount(0, chips, ALL, PLUS, GAP)).toBe(0)
  })

  it('fits every chip when width is ample', () => {
    expect(computeVisibleCount(2000, chips, ALL, PLUS, GAP)).toBe(chips.length)
  })

  it('reserves room for All and Plus and packs as many chips as fit', () => {
    // All(70) + chip(60) + chip(60) + Plus(34) + gap*3(24) = 248
    expect(computeVisibleCount(248, chips, ALL, PLUS, GAP)).toBe(2)
    // one px short of the 3rd chip (needs +70 +8 = 326)
    expect(computeVisibleCount(325, chips, ALL, PLUS, GAP)).toBe(2)
    // exactly enough for the 3rd
    expect(computeVisibleCount(326, chips, ALL, PLUS, GAP)).toBe(3)
  })

  it('returns 0 when not even one chip fits (only All + Plus)', () => {
    // one chip needs All(70)+60+Plus(34)+gap*2(16) = 180
    expect(computeVisibleCount(179, chips, ALL, PLUS, GAP)).toBe(0)
    expect(computeVisibleCount(180, chips, ALL, PLUS, GAP)).toBe(1)
  })
})
