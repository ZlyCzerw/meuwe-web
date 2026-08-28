import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  compareVersions, decideUpdate, dismissalKey, readDismissedVersion,
  writeDismissedVersion, parseMinSupported, fetchMinSupported, UPDATE_KEY,
  storefrontCountry, appleAppId,
} from './appUpdate'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('compareVersions', () => {
  it('orders versions by segment, not by string', () => {
    // "1.1.10" < "1.1.9" alphabetically, which is exactly the bug this avoids.
    expect(compareVersions('1.1.10', '1.1.9')).toBe(1)
    expect(compareVersions('1.1.6', '1.1.6')).toBe(0)
    expect(compareVersions('1.1.6', '1.2.0')).toBe(-1)
  })

  it('treats a missing segment as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1.2', '1.2.1')).toBe(-1)
  })

  it('ignores a pre-release suffix rather than choking on it', () => {
    expect(compareVersions('1.1.7-rc1', '1.1.7')).toBe(0)
  })
})

const facts = (over: Partial<Parameters<typeof decideUpdate>[0]> = {}) => ({
  installed: '1.1.6', updateAvailable: false, availableLabel: null,
  minSupported: null, dismissed: null, ...over,
})

describe('decideUpdate', () => {
  it('says nothing when the store has nothing newer', () => {
    expect(decideUpdate(facts({ updateAvailable: false }))).toBe('none')
  })

  it('nudges when the store has a build this device can install', () => {
    expect(decideUpdate(facts({ updateAvailable: true, availableLabel: '1.1.7' }))).toBe('optional')
  })

  it('stays quiet about a build the user already waved away', () => {
    const state = facts({ updateAvailable: true, availableLabel: '1.1.7', dismissed: '1.1.7' })
    expect(decideUpdate(state)).toBe('none')
  })

  // Waving away 1.1.7 buys silence about 1.1.7, not about everything after it.
  it('speaks up again for the build after the dismissed one', () => {
    const state = facts({ updateAvailable: true, availableLabel: '1.1.8', dismissed: '1.1.7' })
    expect(decideUpdate(state)).toBe('optional')
  })

  // Android names no version, only a code — and on some devices not even that.
  it('remembers a dismissal even when the store labels nothing', () => {
    const state = facts({ updateAvailable: true, availableLabel: null })
    expect(dismissalKey(state)).toBe('from:1.1.6')
    expect(decideUpdate({ ...state, dismissed: 'from:1.1.6' })).toBe('none')
  })

  it('speaks up again once that phone has moved on', () => {
    const state = facts({ installed: '1.1.7', updateAvailable: true, availableLabel: null, dismissed: 'from:1.1.6' })
    expect(decideUpdate(state)).toBe('optional')
  })

  it('blocks a version the backend no longer supports', () => {
    const state = facts({ updateAvailable: true, availableLabel: '1.1.7', minSupported: '1.1.7' })
    expect(decideUpdate(state)).toBe('blocking')
  })

  it('blocks even a build the user tried to dismiss', () => {
    const state = facts({
      updateAvailable: true, availableLabel: '1.1.7', minSupported: '1.1.7', dismissed: '1.1.7',
    })
    expect(decideUpdate(state)).toBe('blocking')
  })

  // A blocking screen whose only button leads nowhere is a dead end: without a
  // reachable newer build we leave the app usable and let it fail honestly.
  it('does not block when the store has nothing to offer', () => {
    expect(decideUpdate(facts({ updateAvailable: false, minSupported: '1.1.7' }))).toBe('none')
  })

  it('keeps quiet when it does not know what is installed', () => {
    expect(decideUpdate(facts({ installed: null, updateAvailable: true }))).toBe('none')
  })

  it('keeps quiet on junk instead of guessing', () => {
    expect(decideUpdate(facts({ installed: 'wersja druga', updateAvailable: true }))).toBe('none')
  })

  it('ignores a support floor it cannot read', () => {
    const state = facts({ updateAvailable: true, availableLabel: '1.1.7', minSupported: 'najnowsza' })
    expect(decideUpdate(state)).toBe('optional')
  })
})

describe('the dismissed version', () => {
  it('is absent until something is dismissed', () => {
    expect(readDismissedVersion()).toBeNull()
  })

  it('survives a round trip', () => {
    writeDismissedVersion('1.1.7')
    expect(readDismissedVersion()).toBe('1.1.7')
    expect(localStorage.getItem(UPDATE_KEY)).toBe('1.1.7')
  })

  it('survives a browser that refuses storage rather than taking the app down', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private mode') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private mode') })
    expect(() => writeDismissedVersion('1.1.7')).not.toThrow()
    expect(readDismissedVersion()).toBeNull()
  })
})

describe('parseMinSupported', () => {
  const doc = { ios: { minSupported: '1.1.0' }, android: { minSupported: '1.0.5' } }

  it('reads the entry for the platform asked about', () => {
    expect(parseMinSupported(doc, 'ios')).toBe('1.1.0')
    expect(parseMinSupported(doc, 'android')).toBe('1.0.5')
  })

  // Everything here arrives over the network, so nothing about its shape is a
  // given — and a bad answer must never be louder than no answer.
  it('gives up on anything that is not a version', () => {
    expect(parseMinSupported(null, 'ios')).toBeNull()
    expect(parseMinSupported({}, 'ios')).toBeNull()
    expect(parseMinSupported({ ios: {} }, 'ios')).toBeNull()
    expect(parseMinSupported({ ios: { minSupported: 'najnowsza' } }, 'ios')).toBeNull()
    expect(parseMinSupported('nonsense', 'ios')).toBeNull()
  })
})

describe('fetchMinSupported', () => {
  it('returns the version published for the platform', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ android: { minSupported: '1.1.0' } }),
    }))
    await expect(fetchMinSupported('android')).resolves.toBe('1.1.0')
  })

  it('returns nothing when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(fetchMinSupported('ios')).resolves.toBeNull()
  })

  it('returns nothing when the file is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    await expect(fetchMinSupported('ios')).resolves.toBeNull()
  })

  it('returns nothing when the file is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => { throw new Error('unexpected token') },
    }))
    await expect(fetchMinSupported('ios')).resolves.toBeNull()
  })
})

describe('storefrontCountry', () => {
  it('takes the region out of a language tag', () => {
    expect(storefrontCountry('pl-PL')).toBe('PL')
    expect(storefrontCountry('es-es')).toBe('ES')
  })

  it('has no answer for a tag that carries no region', () => {
    expect(storefrontCountry('en')).toBeNull()
    expect(storefrontCountry(undefined)).toBeNull()
    expect(storefrontCountry('zh-Hans-CN')).toBeNull()
  })
})

describe('appleAppId', () => {
  it('reads the id out of the store link', () => {
    expect(appleAppId('https://apps.apple.com/app/id6790770081')).toBe('6790770081')
  })

  // appConfig ships an empty string while a listing does not exist.
  it('has no answer without a link', () => {
    expect(appleAppId('')).toBeNull()
  })
})
