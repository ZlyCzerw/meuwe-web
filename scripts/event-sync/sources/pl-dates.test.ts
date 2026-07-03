import { describe, it, expect } from 'vitest'
import { inferYear, parsePlDate } from './pl-dates.ts'

const NOW = new Date('2026-07-03T12:00:00Z')

describe('inferYear', () => {
  it('keeps the current year for upcoming dates', () => {
    expect(inferYear(15, 7, NOW)).toBe(2026)
  })
  it('keeps the current year for dates a few weeks back (already-running events)', () => {
    expect(inferYear(20, 6, NOW)).toBe(2026)
  })
  it('rolls far-past dates to next year', () => {
    expect(inferYear(10, 1, NOW)).toBe(2027)
  })
})

describe('parsePlDate', () => {
  it('parses dd.mm.yyyy', () => {
    expect(parsePlDate('Spacer po rynku | 31.05.2026 r.', NOW)).toBe('2026-05-31')
  })
  it('parses dd.mm and infers the year', () => {
    expect(parsePlDate('23.06 | Wernisaż prac', NOW)).toBe('2026-06-23')
  })
  it('returns null when there is no date', () => {
    expect(parsePlDate('Dni Tyczyna | Parkingi', NOW)).toBeNull()
  })
  it('rejects impossible dates', () => {
    expect(parsePlDate('45.13 | coś', NOW)).toBeNull()
  })
})
