import { describe, it, expect } from 'vitest'
import {
  shouldRecordSignup, signupSourceFromUrl, signupProvider, buildSignupContext, gpsOnlyContext, SIGNUP_WINDOW_MS,
} from './signupContext'

const NOW = Date.parse('2026-09-02T12:00:00Z')

describe('shouldRecordSignup', () => {
  it('records an account created two hours ago', () => {
    expect(shouldRecordSignup({ profileCreatedAt: '2026-09-02T10:00:00Z', alreadyRecorded: false, now: NOW })).toBe(true)
  })
  it('leaves an account from three days ago alone - it predates the feature', () => {
    expect(shouldRecordSignup({ profileCreatedAt: '2026-08-30T12:00:00Z', alreadyRecorded: false, now: NOW })).toBe(false)
  })
  it('never records twice', () => {
    expect(shouldRecordSignup({ profileCreatedAt: '2026-09-02T11:59:00Z', alreadyRecorded: true, now: NOW })).toBe(false)
  })
  it('treats the window edge as outside', () => {
    expect(shouldRecordSignup({ profileCreatedAt: new Date(NOW - SIGNUP_WINDOW_MS).toISOString(), alreadyRecorded: false, now: NOW })).toBe(false)
  })
  it('refuses an unparseable date rather than guessing', () => {
    expect(shouldRecordSignup({ profileCreatedAt: '', alreadyRecorded: false, now: NOW })).toBe(false)
  })
})

describe('signupSourceFromUrl', () => {
  it('reads the four sources and defaults to direct', () => {
    expect(signupSourceFromUrl('https://meuwe.eu/?event=abc')).toBe('event_link')
    expect(signupSourceFromUrl('https://meuwe.eu/?lat=1&lng=2&src=digest')).toBe('digest')
    expect(signupSourceFromUrl('https://meuwe.eu/?src=invite')).toBe('invite')
    expect(signupSourceFromUrl('https://meuwe.eu/')).toBe('direct')
    expect(signupSourceFromUrl('capacitor://localhost/')).toBe('direct')
    expect(signupSourceFromUrl('not a url')).toBe('direct')
  })
  it('an event link wins over src', () => {
    expect(signupSourceFromUrl('https://meuwe.eu/?event=abc&src=digest')).toBe('event_link')
  })
})

describe('signupProvider', () => {
  it('accepts only google and apple', () => {
    expect(signupProvider('google')).toBe('google')
    expect(signupProvider('apple')).toBe('apple')
    expect(signupProvider('email')).toBeNull()
    expect(signupProvider(undefined)).toBeNull()
  })
})

describe('buildSignupContext', () => {
  it('assembles every field and nulls what is missing', () => {
    expect(buildSignupContext({
      ipGeo: { lat: 28.4, lng: -16.5, country: 'ES' }, gps: null,
      platform: 'ios', appVersion: '1.1.7', provider: 'apple', startUrl: 'https://meuwe.eu/?src=invite',
    })).toEqual({
      ipLat: 28.4, ipLng: -16.5, country: 'ES', gpsLat: null, gpsLng: null,
      platform: 'ios', appVersion: '1.1.7', provider: 'apple', source: 'invite',
    })
    expect(buildSignupContext({ ipGeo: null, gps: { lat: 50, lng: 22 }, platform: 'web', appVersion: null, provider: 'google', startUrl: 'https://meuwe.eu/' }))
      .toMatchObject({ ipLat: null, country: null, gpsLat: 50, gpsLng: 22, platform: 'web', appVersion: null, source: 'direct' })
  })
  it('stores an empty country as null', () => {
    expect(buildSignupContext({ ipGeo: { lat: 1, lng: 2, country: '' }, gps: null, platform: 'web', appVersion: null, provider: 'google', startUrl: 'https://meuwe.eu/' }).country).toBeNull()
  })
})

describe('gpsOnlyContext', () => {
  it('carries the fix and nothing else, so coalesce keeps the first write', () => {
    expect(gpsOnlyContext({ lat: 50, lng: 22 })).toEqual({
      ipLat: null, ipLng: null, country: null, gpsLat: 50, gpsLng: 22,
      platform: null, appVersion: null, provider: null, source: null,
    })
  })
})
