import { describe, it, expect } from 'vitest'
import {
  timezoneFor, localClock, isDigestSlot, digestFor, spanKm,
  digestTitle, digestBody, digestUrl, DIGEST_LEAD_MS,
  type DigestCandidate, type DigestEvent,
} from './digest'

// 2026-08-07 is a Friday. Warsaw runs UTC+2 in August, the Canaries UTC+1, so
// one instant is a different hour in each — which is the whole reason the cron
// fires hourly and asks per user instead of once at a fixed UTC time.
const FRI_15Z = new Date('2026-08-07T15:00:00Z')

const HERE = { lat: 50.0413, lng: 21.999 } // Rzeszów

const candidate = (over: Partial<DigestCandidate> = {}): DigestCandidate => ({
  id: 'u1', radius_km: 10, last_lat: HERE.lat, last_lng: HERE.lng, language: 'pl', ...over,
})

/** An event `km` east of HERE running 19:00–22:00 local (17:00–20:00 UTC). */
function ev(km: number, over: Partial<DigestEvent> = {}): DigestEvent {
  const lngPerKm = 1 / (111 * Math.cos(HERE.lat * Math.PI / 180))
  return {
    lat: HERE.lat, lng: HERE.lng + km * lngPerKm,
    start_time: '2026-08-07T17:00:00Z', end_time: '2026-08-07T20:00:00Z',
    ...over,
  }
}

const CTX = { now: FRI_15Z, dayEndUtc: new Date('2026-08-07T22:00:00Z') }

describe('timezoneFor', () => {
  it('puts Rzeszów in Warsaw time and Tenerife in Canary time', () => {
    expect(timezoneFor(50.0413, 21.999)).toBe('Europe/Warsaw')
    expect(timezoneFor(28.46, -16.25)).toBe('Atlantic/Canary')
  })

  it('falls back to Warsaw for anywhere it does not know', () => {
    expect(timezoneFor(0, 0)).toBe('Europe/Warsaw')
  })
})

describe('localClock', () => {
  it('reads the wall clock of the zone, not of the server', () => {
    expect(localClock(FRI_15Z, 'Europe/Warsaw')).toEqual({
      weekday: 'Fri', hour: 17, dayEndUtc: new Date('2026-08-07T22:00:00Z'),
    })
    expect(localClock(FRI_15Z, 'Atlantic/Canary')).toEqual({
      weekday: 'Fri', hour: 16, dayEndUtc: new Date('2026-08-07T23:00:00Z'),
    })
  })

  // A fixed UTC send hour would drift by one when the clocks change; the wall
  // clock does not.
  it('follows the zone through winter time', () => {
    expect(localClock(new Date('2026-01-09T16:00:00Z'), 'Europe/Warsaw')).toEqual({
      weekday: 'Fri', hour: 17, dayEndUtc: new Date('2026-01-09T23:00:00Z'),
    })
  })

  it('lets a late UTC evening already be the next local day', () => {
    expect(localClock(new Date('2026-08-06T23:30:00Z'), 'Europe/Warsaw').weekday).toBe('Fri')
  })
})

describe('isDigestSlot', () => {
  it('is Friday 17:00 local and nothing else', () => {
    expect(isDigestSlot(localClock(FRI_15Z, 'Europe/Warsaw'))).toBe(true)
    expect(isDigestSlot(localClock(FRI_15Z, 'Atlantic/Canary'))).toBe(false) // 16:00 there
    expect(isDigestSlot(localClock(new Date('2026-08-06T15:00:00Z'), 'Europe/Warsaw'))).toBe(false) // Thursday
  })
})

describe('digestFor', () => {
  it('counts what the radius reaches and measures the nearest', () => {
    const d = digestFor(candidate(), [ev(2), ev(8), ev(30)], CTX)
    expect(d?.count).toBe(2)
    expect(d?.nearestKm).toBeCloseTo(2, 1)
  })

  // Zero is silence, not a "quiet today" push. A notification about nothing is
  // worse than no notification.
  it('returns null when there is nothing, so nothing gets sent', () => {
    expect(digestFor(candidate(), [ev(30)], CTX)).toBeNull()
    expect(digestFor(candidate(), [], CTX)).toBeNull()
  })

  // The push promises a number the user will check against the map. Events that
  // will be over before they realistically get there must not inflate it.
  it('drops events ending within the next hour', () => {
    const ending = ev(2, { end_time: new Date(FRI_15Z.getTime() + DIGEST_LEAD_MS - 60_000).toISOString() })
    expect(digestFor(candidate(), [ending], CTX)).toBeNull()
  })

  it('drops events that only start tomorrow', () => {
    const tomorrow = ev(2, { start_time: '2026-08-08T10:00:00Z', end_time: '2026-08-08T12:00:00Z' })
    expect(digestFor(candidate(), [tomorrow], CTX)).toBeNull()
  })

  it('caps the radius at 50 and defaults it to 10', () => {
    expect(digestFor(candidate({ radius_km: 200 }), [ev(45)], CTX)?.count).toBe(1)
    expect(digestFor(candidate({ radius_km: 200 }), [ev(55)], CTX)).toBeNull()
    expect(digestFor(candidate({ radius_km: null }), [ev(8)], CTX)?.count).toBe(1)
    expect(digestFor(candidate({ radius_km: null }), [ev(12)], CTX)).toBeNull()
  })
})

describe('spanKm', () => {
  // Same rule as the startup zoom: the nearest thing and the same distance
  // again, so the first pin on screen is not the only pin on screen.
  it('doubles the nearest distance and stops at the map maximum', () => {
    expect(spanKm(4)).toBe(8)
    expect(spanKm(40)).toBe(50)
  })
})

describe('digestTitle', () => {
  it('names the day in the user language and zone', () => {
    expect(digestTitle('pl', FRI_15Z, 'Europe/Warsaw')).toBe('Piątek. Wychodzisz gdzieś?')
    expect(digestTitle('sl', FRI_15Z, 'Europe/Warsaw')).toBe('Petek. Greš ven?')
    expect(digestTitle('en', new Date('2026-08-06T15:00:00Z'), 'Europe/Warsaw')).toBe('Thursday. Going out?')
  })
})

describe('digestBody', () => {
  // "jest 7 wydarzenia" would kill the whole effect. Polish bends both the noun
  // and the verb; Slovenian has four forms. Intl.PluralRules picks the drawer,
  // the strings own the grammar.
  it('declines Polish correctly', () => {
    expect(digestBody('pl', 1)).toBe('Wokół Ciebie jest 1 wydarzenie.')
    expect(digestBody('pl', 3)).toBe('Wokół Ciebie są 3 wydarzenia.')
    expect(digestBody('pl', 7)).toBe('Wokół Ciebie jest 7 wydarzeń.')
    expect(digestBody('pl', 22)).toBe('Wokół Ciebie są 22 wydarzenia.')
  })

  it('declines Slovenian through all four forms', () => {
    expect(digestBody('sl', 1)).toBe('V tvoji bližini je 1 dogodek.')
    expect(digestBody('sl', 2)).toBe('V tvoji bližini sta 2 dogodka.')
    expect(digestBody('sl', 3)).toBe('V tvoji bližini so 3 dogodki.')
    expect(digestBody('sl', 5)).toBe('V tvoji bližini je 5 dogodkov.')
  })

  it('handles the simple languages', () => {
    expect(digestBody('en', 1)).toBe('There is 1 event around you.')
    expect(digestBody('en', 7)).toBe('There are 7 events around you.')
    expect(digestBody('es', 2)).toBe('Hay 2 eventos cerca de ti.')
    expect(digestBody('de', 2)).toBe('In deiner Nähe sind 2 Events.')
  })
})

describe('digestUrl', () => {
  it('builds the map link the client already parses', () => {
    expect(digestUrl(50.0413, 21.999, 8)).toBe(
      'https://meuwe.eu/?lat=50.04130&lng=21.99900&km=8&src=digest'
    )
  })
})
