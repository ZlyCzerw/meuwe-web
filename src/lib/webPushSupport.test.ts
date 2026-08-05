import { describe, it, expect, afterEach, vi } from 'vitest'
import { webPushSupported } from './webPushSupport'

const original = {
  serviceWorker: 'serviceWorker' in navigator,
  PushManager: 'PushManager' in window,
  Notification: 'Notification' in window,
}

afterEach(() => vi.unstubAllGlobals())

/** jsdom has none of these by default, so the test supplies them. */
function browserWithPush() {
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() })
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
}

describe('webPushSupported', () => {
  it('is false in a browser without the push APIs', () => {
    expect(webPushSupported({ ...original, hasVapidKey: true, serviceWorker: false })).toBe(false)
    expect(webPushSupported({ ...original, hasVapidKey: true, PushManager: false })).toBe(false)
    expect(webPushSupported({ ...original, hasVapidKey: true, Notification: false })).toBe(false)
  })

  // The reason this exists. A browser can hold every API and still be unable to
  // subscribe, because subscribing needs our public key. Asking the APIs alone —
  // which is what getDevicePushState used to do — reports a device that is ready
  // when it is not, and the app then offers a button that silently does nothing.
  it('is false without a VAPID key, however capable the browser', () => {
    browserWithPush()
    expect(webPushSupported({
      serviceWorker: true, PushManager: true, Notification: true, hasVapidKey: false,
    })).toBe(false)
  })

  it('is true only when the browser can subscribe and we have a key to subscribe with', () => {
    expect(webPushSupported({
      serviceWorker: true, PushManager: true, Notification: true, hasVapidKey: true,
    })).toBe(true)
  })
})
