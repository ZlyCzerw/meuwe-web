import { describe, it, expect } from 'vitest'
import {
  shouldRecordSignup, signupSourceFromUrl, signupProvider, buildSignupContext, gpsOnlyContext, SIGNUP_WINDOW_MS,
  rememberEntrySource, recallEntrySource, ENTRY_SOURCE_KEY,
} from './signupContext'

/** Atrapa storage w pamięci - żeby nie ciągnąć jsdom-owego sessionStorage do testu czystych funkcji. */
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage
}

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

describe('rememberEntrySource / recallEntrySource', () => {
  it('remembers invite from ?src=invite', () => {
    const storage = memoryStorage()
    rememberEntrySource('https://meuwe.eu/?src=invite', storage)
    expect(storage.getItem(ENTRY_SOURCE_KEY)).toBe('invite')
    expect(recallEntrySource(storage)).toBe('invite')
  })

  it('does not let an OAuth callback URL overwrite a remembered invite', () => {
    const storage = memoryStorage()
    rememberEntrySource('https://meuwe.eu/?src=invite', storage)
    rememberEntrySource('https://meuwe.eu/?code=abc', storage)
    expect(recallEntrySource(storage)).toBe('invite')
  })

  it('stores nothing for a direct URL', () => {
    const storage = memoryStorage()
    rememberEntrySource('https://meuwe.eu/', storage)
    expect(storage.getItem(ENTRY_SOURCE_KEY)).toBeNull()
    expect(recallEntrySource(storage)).toBeNull()
  })

  it('returns null for garbage', () => {
    const storage = memoryStorage()
    storage.setItem(ENTRY_SOURCE_KEY, 'nonsense')
    expect(recallEntrySource(storage)).toBeNull()
  })
})

describe('buildSignupContext prefers entrySource over startUrl', () => {
  it('uses entrySource when given, ignoring the (OAuth callback) startUrl', () => {
    expect(buildSignupContext({
      ipGeo: null, gps: null, platform: 'web', appVersion: null, provider: 'google',
      startUrl: 'https://meuwe.eu/?code=abc', entrySource: 'invite',
    }).source).toBe('invite')
  })
  it('falls back to startUrl when entrySource is null/undefined', () => {
    expect(buildSignupContext({
      ipGeo: null, gps: null, platform: 'web', appVersion: null, provider: 'google',
      startUrl: 'https://meuwe.eu/?src=digest', entrySource: null,
    }).source).toBe('digest')
    expect(buildSignupContext({
      ipGeo: null, gps: null, platform: 'web', appVersion: null, provider: 'google',
      startUrl: 'https://meuwe.eu/?src=digest',
    }).source).toBe('digest')
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
