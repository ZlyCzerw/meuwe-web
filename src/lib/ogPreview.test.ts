import { describe, it, expect } from 'vitest'
import { formatEventDays } from './ogPreview'

// Boguchwała, lng ~21.94 → round(21.94/15) = +1h. A 14:00Z start is 15:00
// local by that estimate, comfortably inside 19 August either way.
const LNG_PL = 21.94
const NOW = new Date('2026-08-19T10:00:00Z')

describe('formatEventDays', () => {
  it('renders a single day as DD.MM', () => {
    expect(formatEventDays('2026-08-19T14:00:00Z', '2026-08-19T21:59:00Z', LNG_PL, NOW))
      .toBe('19.08')
  })

  it('renders a two-day event as DD–DD.MM when the month matches', () => {
    expect(formatEventDays('2026-08-19T14:00:00Z', '2026-08-20T10:00:00Z', LNG_PL, NOW))
      .toBe('19–20.08')
  })

  it('spells out both sides when the month changes', () => {
    expect(formatEventDays('2026-08-30T14:00:00Z', '2026-09-01T10:00:00Z', LNG_PL, NOW))
      .toBe('30.08–01.09')
  })

  it('appends the year when the event is not in the current year', () => {
    expect(formatEventDays('2027-08-19T14:00:00Z', '2027-08-19T21:00:00Z', LNG_PL, NOW))
      .toBe('19.08.2027')
  })

  it('spells out both years when the event crosses new year', () => {
    expect(formatEventDays('2026-12-31T20:00:00Z', '2027-01-01T03:00:00Z', LNG_PL, NOW))
      .toBe('31.12.2026–01.01.2027')
  })

  it('appends the year to a multi-day range not in the current year', () => {
    expect(formatEventDays('2027-08-19T14:00:00Z', '2027-08-20T10:00:00Z', LNG_PL, NOW))
      .toBe('19–20.08.2027')
  })

  it('uses the longitude offset, not UTC, to pick the day', () => {
    // 23:30Z on the 18th is 01:30 on the 19th in a +2h zone (lng 30).
    expect(formatEventDays('2026-08-18T23:30:00Z', '2026-08-19T02:00:00Z', 30, NOW))
      .toBe('19.08')
  })

  it('uses a negative longitude offset to pick the earlier local day', () => {
    // Tenerife, lng ≈ -16.6 → round(-16.6/15) = -1h. 00:30Z on the 19th is
    // still 23:30 on the 18th one hour to the west.
    expect(formatEventDays('2026-08-19T00:30:00Z', '2026-08-19T00:45:00Z', -16.6, NOW))
      .toBe('18.08')
  })

  it('falls back to UTC (no offset) when lng is not finite', () => {
    // At the same instant, the LNG_PL case above uses a +1h offset that
    // would push this into the 20th. A NaN longitude must not do that.
    expect(formatEventDays('2026-08-19T23:30:00Z', '2026-08-19T23:45:00Z', NaN, NOW))
      .toBe('19.08')
  })

  it('applies no offset for a longitude of exactly zero', () => {
    expect(formatEventDays('2026-08-19T23:30:00Z', '2026-08-19T23:45:00Z', 0, NOW))
      .toBe('19.08')
  })

  it('collapses to the start day when end is before start in the same month', () => {
    expect(formatEventDays('2026-08-20T10:00:00Z', '2026-08-19T10:00:00Z', LNG_PL, NOW))
      .toBe('20.08')
  })

  it('collapses to the start day when end is before start across a year boundary', () => {
    expect(formatEventDays('2027-01-01T03:00:00Z', '2026-12-31T20:00:00Z', LNG_PL, NOW))
      .toBe('01.01.2027')
  })

  it('collapses to the start day when end is unparseable but start is valid', () => {
    expect(formatEventDays('2026-08-19T14:00:00Z', 'not-a-date', LNG_PL, NOW))
      .toBe('19.08')
  })

  it('returns an empty string for an unparseable date', () => {
    expect(formatEventDays('not-a-date', 'not-a-date', LNG_PL, NOW)).toBe('')
  })
})
