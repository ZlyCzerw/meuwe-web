import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  markSignedOut, takeSignedOutFlag, googleOAuthOptions, SIGNED_OUT_KEY,
} from './authPrompt'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('the signed-out flag', () => {
  it('is not set for someone who has never signed out', () => {
    expect(takeSignedOutFlag()).toBe(false)
  })

  it('is set by signing out', () => {
    markSignedOut()
    expect(takeSignedOutFlag()).toBe(true)
  })

  // Reading it is what spends it: the account picker belongs on the login that
  // follows a sign-out, not on every login from then on.
  it('is spent by the first read', () => {
    markSignedOut()
    takeSignedOutFlag()
    expect(takeSignedOutFlag()).toBe(false)
    expect(localStorage.getItem(SIGNED_OUT_KEY)).toBeNull()
  })

  it('survives a browser that refuses storage rather than taking the app down', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private mode') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private mode') })
    expect(() => markSignedOut()).not.toThrow()
    expect(takeSignedOutFlag()).toBe(false)
  })
})

describe('googleOAuthOptions', () => {
  it('asks which account to use after a sign-out', () => {
    expect(googleOAuthOptions('https://meuwe.eu/', true)).toEqual({
      redirectTo: 'https://meuwe.eu/',
      queryParams: { prompt: 'select_account' },
    })
  })

  // A first-time visitor, or someone whose session merely expired, has not asked
  // to switch anything — sending them through the picker is a tap for nothing.
  it('stays out of the way on an ordinary sign-in', () => {
    expect(googleOAuthOptions('https://meuwe.eu/', false)).toEqual({ redirectTo: 'https://meuwe.eu/' })
  })
})
