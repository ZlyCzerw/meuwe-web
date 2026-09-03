import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  CONSENT_STORAGE_KEY,
  readConsent,
  saveConsent,
  openCookieSettings,
  onCookieSettings,
} from './consent'

const g = globalThis as { gtag?: (...args: unknown[]) => void }

beforeEach(() => localStorage.clear())
afterEach(() => { delete g.gtag })

describe('readConsent', () => {
  it('is null before the visitor has decided', () => {
    expect(readConsent()).toBeNull()
  })

  it('ignores garbage left under the key', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'yes')
    expect(readConsent()).toBeNull()
    localStorage.setItem(CONSENT_STORAGE_KEY, '{"analytics":"maybe"}')
    expect(readConsent()).toBeNull()
  })

  it('returns what saveConsent stored', () => {
    saveConsent({ analytics: true })
    expect(readConsent()).toEqual({ analytics: true })
    saveConsent({ analytics: false })
    expect(readConsent()).toEqual({ analytics: false })
  })
})

describe('saveConsent', () => {
  it('tells Google Analytics the new state when gtag is on the page', () => {
    const gtag = vi.fn()
    g.gtag = gtag
    saveConsent({ analytics: true })
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'granted' })
    saveConsent({ analytics: false })
    expect(gtag).toHaveBeenLastCalledWith('consent', 'update', { analytics_storage: 'denied' })
  })

  it('still records the choice when gtag never loaded', () => {
    expect(() => saveConsent({ analytics: false })).not.toThrow()
    expect(readConsent()).toEqual({ analytics: false })
  })
})

describe('cookie settings signal', () => {
  it('reaches every subscriber until they unsubscribe', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = onCookieSettings(a)
    onCookieSettings(b)
    openCookieSettings()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    offA()
    openCookieSettings()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
  })
})
