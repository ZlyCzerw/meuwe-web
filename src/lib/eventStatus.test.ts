import { describe, it, expect } from 'vitest'
import { isCurrentlyLive, computeStatus } from './eventStatus'

// Helpers — build event relative to now
function ev(startOffsetMs: number, endOffsetMs: number) {
  const now = Date.now()
  return {
    start_time: new Date(now + startOffsetMs).toISOString(),
    end_time:   new Date(now + endOffsetMs).toISOString(),
  }
}

describe('isCurrentlyLive', () => {
  it('returns true when now is between start_time and end_time (live)', () => {
    // started 1h ago, ends in 1h
    expect(isCurrentlyLive(ev(-3_600_000, 3_600_000))).toBe(true)
  })

  it('returns false when now is before start_time (upcoming)', () => {
    // starts in 1h, ends in 2h
    expect(isCurrentlyLive(ev(3_600_000, 7_200_000))).toBe(false)
  })

  it('returns false when now is after end_time but within effectiveEnd (extended)', () => {
    // started 2h ago, ended 30min ago — effectiveEnd = end_time + 1h = now+30min → extended
    expect(isCurrentlyLive(ev(-7_200_000, -1_800_000))).toBe(false)
  })

  it('returns false when now is past effectiveEnd (ended)', () => {
    // started 3h ago, ended 2h ago — effectiveEnd = end_time + 1h = now-1h → ended
    expect(isCurrentlyLive(ev(-10_800_000, -7_200_000))).toBe(false)
  })
})

describe('computeStatus', () => {
  it('returns live when now is between start and end', () => {
    expect(computeStatus(ev(-3_600_000, 3_600_000))).toBe('live')
  })

  it('returns upcoming when now is before start', () => {
    expect(computeStatus(ev(3_600_000, 7_200_000))).toBe('upcoming')
  })

  it('returns extended when now is past end_time but within effectiveEnd', () => {
    // ended 30min ago, no messages → effectiveEnd = end + 1h = now+30min → extended
    expect(computeStatus(ev(-7_200_000, -1_800_000))).toBe('extended')
  })

  it('returns ended when now is past effectiveEnd', () => {
    // ended 2h ago, no messages → effectiveEnd = end + 1h = now-1h → ended
    expect(computeStatus(ev(-10_800_000, -7_200_000))).toBe('ended')
  })
})
