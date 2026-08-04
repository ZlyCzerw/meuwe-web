import { describe, it, expect } from 'vitest'
import {
  summariseProbe, pickEmptyStateVariant, PROBE_DAYS,
  type ProbeEvent, type NearbyProbe,
} from './emptyState'

// Rzeszów centre, and a clock fixed mid-afternoon so "today" is unambiguous.
const HERE = { lat: 50.0413, lng: 21.9990 }
const NOW = new Date('2026-08-04T14:00:00')

/** Places an event `km` east of HERE, on the day `dayOffset` from NOW. */
function ev(km: number, dayOffset = 0, hour = 20): ProbeEvent {
  const day = new Date(NOW)
  day.setDate(day.getDate() + dayOffset)
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0)
  const end = new Date(start.getTime() + 3 * 3600_000)
  const lngPerKm = 1 / (111 * Math.cos(HERE.lat * Math.PI / 180))
  return { lat: HERE.lat, lng: HERE.lng + km * lngPerKm, start_time: start.toISOString(), end_time: end.toISOString() }
}

const probe = (events: ProbeEvent[], viewKm = 5) =>
  summariseProbe(events, { ...HERE, viewKm, now: NOW })

describe('summariseProbe', () => {
  it('reports an empty neighbourhood as empty rather than as unknown', () => {
    expect(probe([])).toEqual({ nearestKm: null, widerToday: 0, nextDay: null })
  })

  it('measures the nearest thing happening today', () => {
    const p = probe([ev(12), ev(3.2), ev(30)])
    expect(p.nearestKm).toBeCloseTo(3.2, 1)
  })

  it('counts today only what the current view is missing', () => {
    // 3 km is inside the 5 km view; 12 and 30 are not.
    expect(probe([ev(3), ev(12), ev(30)]).widerToday).toBe(2)
  })

  it('ignores what is further out than the fan-out would ever reach', () => {
    expect(probe([ev(80)]).widerToday).toBe(0)
    expect(probe([ev(80)]).nearestKm).toBeNull()
  })

  it('finds the first later day that has anything, not just any day', () => {
    const p = probe([ev(2, 3), ev(2, 1), ev(2, 1)])
    expect(p.nextDay).toEqual({ dayOffset: 1, count: 2 })
  })

  // The sentence promises what the user will see after tapping through, so it
  // counts what is inside the view they are looking at, not the whole county.
  it('counts the later day within the same view the user has now', () => {
    expect(probe([ev(2, 1), ev(40, 1)]).nextDay).toEqual({ dayOffset: 1, count: 1 })
  })

  it('looks a week ahead and no further', () => {
    expect(probe([ev(2, PROBE_DAYS)]).nextDay).toEqual({ dayOffset: PROBE_DAYS, count: 1 })
    expect(probe([ev(2, PROBE_DAYS + 1)]).nextDay).toBeNull()
  })

  // An event that started at noon and runs till late is still today's event at
  // 14:00; one that ended at 13:00 is not.
  it('keeps today what is still running and drops what has finished', () => {
    const running: ProbeEvent = { ...ev(2, 0, 12), end_time: new Date('2026-08-04T23:00:00').toISOString() }
    const over: ProbeEvent = { ...ev(2, 0, 9), end_time: new Date('2026-08-04T13:00:00').toISOString() }
    expect(probe([running], 1).widerToday + (probe([running]).nearestKm !== null ? 1 : 0)).toBeGreaterThan(0)
    expect(probe([over]).nearestKm).toBeNull()
  })
})

describe('pickEmptyStateVariant', () => {
  const base: NearbyProbe = { nearestKm: null, widerToday: 0, nextDay: null }

  // Another day is the cheapest way out: one tap and the map has content.
  it('offers another day before anything else', () => {
    const v = pickEmptyStateVariant({ ...base, nearestKm: 8, widerToday: 4, nextDay: { dayOffset: 1, count: 3 } })
    expect(v).toEqual({ kind: 'nextDay', dayOffset: 1, count: 3 })
  })

  it('offers a wider look when today has something further out', () => {
    expect(pickEmptyStateVariant({ ...base, nearestKm: 12, widerToday: 2 }))
      .toEqual({ kind: 'wider', nearestKm: 12 })
  })

  // Only now is "be the first" honest.
  it('asks the user to be the first only when there is genuinely nothing', () => {
    expect(pickEmptyStateVariant(base)).toEqual({ kind: 'nothing' })
  })

  // A failed probe must not be read as an empty neighbourhood — that would put
  // "be the first" in front of someone standing next to a festival.
  it('says nothing at all when the probe never came back', () => {
    expect(pickEmptyStateVariant(null)).toEqual({ kind: 'unknown' })
  })
})
