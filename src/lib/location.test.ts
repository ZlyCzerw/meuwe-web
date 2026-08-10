import { describe, it, expect } from 'vitest'
import { shouldWriteLocation, MOVE_THRESHOLD_M, HEARTBEAT_MS } from './location'

const NOW = 1_700_000_000_000
const HERE = { lat: 50.0413, lng: 21.9990 }
// ~220 m north of HERE: 0.002 degrees of latitude is about 222 m.
const THERE = { lat: 50.0433, lng: 21.9990 }
// ~55 m north of HERE, under the movement threshold.
const NEARBY = { lat: 50.0418, lng: 21.9990 }

describe('shouldWriteLocation', () => {
  it('writes the first position it is ever given', () => {
    expect(shouldWriteLocation({ next: HERE, last: null, now: NOW })).toBe(true)
  })

  it('writes once the user has actually moved', () => {
    const last = { ...HERE, at: NOW - 120_000 }
    expect(shouldWriteLocation({ next: THERE, last, now: NOW })).toBe(true)
  })

  // GPS jitter fires the watch far more often than the fan-out needs.
  it('does not write a movement that lands within a minute of the last write', () => {
    const last = { ...HERE, at: NOW - 10_000 }
    expect(shouldWriteLocation({ next: THERE, last, now: NOW })).toBe(false)
  })

  it('ignores a wobble smaller than the threshold', () => {
    const last = { ...HERE, at: NOW - 120_000 }
    expect(shouldWriteLocation({ next: NEARBY, last, now: NOW })).toBe(false)
  })

  // The same write refreshes last_seen_at, which the fan-out reads as "this
  // account is active", so standing still must not let it go stale.
  it('writes on the heartbeat even when nothing moved', () => {
    const last = { ...HERE, at: NOW - HEARTBEAT_MS - 1 }
    expect(shouldWriteLocation({ next: HERE, last, now: NOW })).toBe(true)
  })

  it('stays quiet between heartbeats when nothing moved', () => {
    const last = { ...HERE, at: NOW - 120_000 }
    expect(shouldWriteLocation({ next: HERE, last, now: NOW })).toBe(false)
  })

  it('states its threshold in metres, so callers can reason about it', () => {
    expect(MOVE_THRESHOLD_M).toBe(100)
  })
})
