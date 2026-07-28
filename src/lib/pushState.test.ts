import { describe, it, expect } from 'vitest'
import {
  resolvePushState,
  isDelivering,
  needsRepair,
  isRepairableInApp,
  type DevicePushState,
  type PushPermission,
} from './pushState'

const dev = (permission: PushPermission, registered = false): DevicePushState =>
  ({ permission, registered })

describe('resolvePushState', () => {
  it('reports unsupported regardless of intent', () => {
    expect(resolvePushState(true, dev('unsupported'))).toBe('unsupported')
    expect(resolvePushState(false, dev('unsupported'))).toBe('unsupported')
  })

  it('is off whenever the user does not want notifications', () => {
    expect(resolvePushState(false, dev('granted', true))).toBe('off')
    expect(resolvePushState(false, dev('denied'))).toBe('off')
    expect(resolvePushState(false, dev('prompt'))).toBe('off')
  })

  it('is on only when intent and a registered device agree', () => {
    expect(resolvePushState(true, dev('granted', true))).toBe('on')
  })

  it('flags a granted device that has no token or subscription', () => {
    expect(resolvePushState(true, dev('granted', false))).toBe('needsRegistration')
  })

  it('flags the web-then-native case: intent kept, device never asked', () => {
    // profile.push_enabled was set in the browser; the freshly installed native
    // app has never been granted permission and holds no FCM token.
    expect(resolvePushState(true, dev('prompt', false))).toBe('needsPermission')
  })

  it('flags a system-level block', () => {
    expect(resolvePushState(true, dev('denied', false))).toBe('blocked')
    // A stale subscription does not save it — the system still drops the push.
    expect(resolvePushState(true, dev('denied', true))).toBe('blocked')
  })
})

describe('the acceptance criterion', () => {
  const permissions: PushPermission[] = ['granted', 'denied', 'prompt', 'unsupported']

  it('never claims delivery without it, and never stays silent about a gap', () => {
    for (const permission of permissions) {
      for (const registered of [true, false]) {
        for (const intent of [true, false]) {
          const state = resolvePushState(intent, dev(permission, registered))
          const claimsDelivery = isDelivering(state)
          const reallyDelivers = permission === 'granted' && registered
          // The UI may only claim "on" when the device truly delivers.
          if (claimsDelivery) expect(reallyDelivers).toBe(true)
          // And whenever the user asked for it but the device cannot deliver,
          // the state must be one that renders a repair message.
          if (intent && permission !== 'unsupported' && !reallyDelivers) {
            expect(needsRepair(state)).toBe(true)
          }
        }
      }
    }
  })
})

describe('isRepairableInApp', () => {
  it('offers an in-app fix for a missing permission or registration', () => {
    expect(isRepairableInApp('needsPermission')).toBe(true)
    expect(isRepairableInApp('needsRegistration')).toBe(true)
  })

  it('does not pretend a blocked permission can be fixed in-app', () => {
    expect(isRepairableInApp('blocked')).toBe(false)
    expect(isRepairableInApp('off')).toBe(false)
    expect(isRepairableInApp('on')).toBe(false)
    expect(isRepairableInApp('unsupported')).toBe(false)
  })
})
