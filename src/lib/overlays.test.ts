import { describe, it, expect } from 'vitest'
import { isScreenClear, type OverlayFlags } from './overlays'

const clear: OverlayFlags = {
  screen: 'map',
  authModal: false,
  selEvent: false,
  myEventSelected: false,
  followedEventSelected: false,
  createOpen: false,
  profileOpen: false,
  accountOpen: false,
  myDataOpen: false,
  pickingLocation: false,
  promoOpen: false,
  locationModalOpen: false,
  interestsModalOpen: false,
  inviteModalOpen: false,
  pushAskOpen: false,
  attendanceAskOpen: false,
  userCardOpen: false,
  updateOpen: false,
}

describe('isScreenClear', () => {
  it('is clear on a bare map', () => {
    expect(isScreenClear(clear)).toBe(true)
  })

  it('is not clear anywhere but the map', () => {
    expect(isScreenClear({ ...clear, screen: 'profile' })).toBe(false)
  })

  // The point of the rule: an uninvited card waits for an empty screen. Every
  // layer counts, and this walks all of them so a new one cannot be added to the
  // type and quietly left out of the check.
  it('is not clear while any single layer is open', () => {
    const layers = Object.keys(clear).filter(k => k !== 'screen') as (keyof OverlayFlags)[]
    expect(layers.length).toBe(17)
    for (const layer of layers) {
      expect(isScreenClear({ ...clear, [layer]: true })).toBe(false)
    }
  })

  // The specific regression: the first-run cards were added to the chain without
  // being added here, so the app-install nudge fired underneath them — unseen,
  // but counted as shown, which also started its three-day cooldown.
  it('is not clear behind the first-run cards', () => {
    expect(isScreenClear({ ...clear, interestsModalOpen: true })).toBe(false)
    expect(isScreenClear({ ...clear, inviteModalOpen: true })).toBe(false)
    expect(isScreenClear({ ...clear, locationModalOpen: true })).toBe(false)
    expect(isScreenClear({ ...clear, pushAskOpen: true })).toBe(false)
  })
})
