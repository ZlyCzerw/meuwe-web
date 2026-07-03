import { describe, it, expect } from 'vitest'
import { canaryOffsetHours, localCanaryToUtc, localToUtc } from './timezone.ts'

describe('canaryOffsetHours', () => {
  it('returns 0 in winter (WET)', () => {
    expect(canaryOffsetHours(new Date(Date.UTC(2026, 0, 15, 12)))).toBe(0)
  })
  it('returns 1 in summer DST (WEST)', () => {
    expect(canaryOffsetHours(new Date(Date.UTC(2026, 6, 15, 12)))).toBe(1)
  })
})

describe('localCanaryToUtc', () => {
  it('subtracts 1h in summer (20:00 local → 19:00 UTC)', () => {
    const d = localCanaryToUtc('2026-07-15', '20:00')
    expect(d.toISOString()).toBe('2026-07-15T19:00:00.000Z')
  })
  it('subtracts 0h in winter (20:00 local → 20:00 UTC)', () => {
    const d = localCanaryToUtc('2026-01-15', '20:00')
    expect(d.toISOString()).toBe('2026-01-15T20:00:00.000Z')
  })
})

describe('localToUtc (Europe/Warsaw)', () => {
  it('converts summer (CEST, UTC+2) local time to UTC', () => {
    expect(localToUtc('2026-07-15', '19:00', 'Europe/Warsaw').toISOString())
      .toBe('2026-07-15T17:00:00.000Z')
  })
  it('converts winter (CET, UTC+1) local time to UTC', () => {
    expect(localToUtc('2026-01-15', '19:00', 'Europe/Warsaw').toISOString())
      .toBe('2026-01-15T18:00:00.000Z')
  })
  it('still handles Atlantic/Canary', () => {
    expect(localToUtc('2026-07-15', '19:00', 'Atlantic/Canary').toISOString())
      .toBe('2026-07-15T18:00:00.000Z')
  })
})
