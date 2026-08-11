import { describe, it, expect } from 'vitest'
import {
  parseOnboardingState, emptyOnboardingState, locationPromptDelayMs,
  radiusFromNearest, MIN_ONBOARDING_RADIUS_KM, MAX_ONBOARDING_RADIUS_KM,
  DEEP_LINK_DELAY_MS, DEFAULT_DELAY_MS, shouldAskInterests,
} from './onboarding'

describe('parseOnboardingState', () => {
  it('starts fresh with nothing stored', () => {
    expect(parseOnboardingState(null)).toEqual(emptyOnboardingState())
  })

  it('survives a corrupted entry', () => {
    expect(parseOnboardingState('{oops')).toEqual(emptyOnboardingState())
  })

  it('only accepts real booleans, so a stray value cannot skip a step', () => {
    expect(parseOnboardingState('{"locationDone":"yes"}').locationDone).toBe(false)
    expect(parseOnboardingState('{"locationDone":true}').locationDone).toBe(true)
    expect(parseOnboardingState('{"inviteDone":"yes"}').inviteDone).toBe(false)
    expect(parseOnboardingState('{"inviteDone":true}').inviteDone).toBe(true)
  })

  // What this state is for: the two steps that really are about this device.
  // The interests step used to be stored here too — see shouldAskInterests for
  // why it cannot be. An entry written back then still parses.
  it('ignores the interests flag left behind by older installs', () => {
    const old = '{"locationDone":true,"interestsDone":true,"inviteDone":true}'
    expect(parseOnboardingState(old)).toEqual({ locationDone: true, inviteDone: true })
  })
})

describe('shouldAskInterests', () => {
  const asked = (over: Partial<Parameters<typeof shouldAskInterests>[0]> = {}) =>
    shouldAskInterests({ profile: { interests_onboarded_at: null }, askedThisSession: false, ...over })

  it('asks an account that has never answered', () => {
    expect(asked()).toBe(true)
  })

  // The bug this function exists for. The answer used to live in localStorage,
  // so a new phone, a new browser, a reinstall — or Safari evicting the entry
  // after seven quiet days — all read as "never asked" and put the card back in
  // front of someone who had already filled it in.
  it('never asks again on a second device, whatever this one has stored', () => {
    expect(asked({ profile: { interests_onboarded_at: '2026-03-01T10:00:00Z' } })).toBe(false)
  })

  // Clearing your tags in the profile panel is an answer, not the absence of
  // one. The stamp records that the question was put, so emptying the list must
  // not bring the card back — this is why the stamp is a column of its own and
  // not `interests.length === 0`.
  it('leaves alone someone who answered and later removed every tag', () => {
    expect(asked({ profile: { interests_onboarded_at: '2026-03-01T10:00:00Z' } })).toBe(false)
  })

  // The profile arrives over the network a moment after the session does. Until
  // it lands there is no way to tell an account that answered from one that did
  // not, and guessing means guessing in front of the user.
  it('waits rather than guessing while the profile is still loading', () => {
    expect(asked({ profile: null })).toBe(false)
  })

  // The card is already up, or its save failed a second ago. Either way the
  // poll must not open a second one — but nothing is written to the device, so
  // a failed save is asked about again on the next launch.
  it('does not reopen within the same session', () => {
    expect(asked({ askedThisSession: true })).toBe(false)
  })
})

describe('radiusFromNearest', () => {
  it('reaches twice as far as the nearest thing happening', () => {
    expect(radiusFromNearest(8)).toBe(16)
    expect(radiusFromNearest(12.5)).toBe(25)
  })

  // In a city the nearest event can be 300 m away. Twice that is a radius of
  // 600 m, which would notify the new account about almost nothing — the exact
  // silence this whole step exists to end.
  it('does not shrink to a radius that would notify nobody', () => {
    expect(radiusFromNearest(0.3)).toBe(MIN_ONBOARDING_RADIUS_KM)
    expect(radiusFromNearest(0)).toBe(MIN_ONBOARDING_RADIUS_KM)
  })

  it('stops at the widest radius the fan-out honours', () => {
    expect(radiusFromNearest(40)).toBe(MAX_ONBOARDING_RADIUS_KM)
    expect(MAX_ONBOARDING_RADIUS_KM).toBe(50)
  })

  // Nothing nearby, or no idea where the user is: ask as widely as we can
  // rather than as narrowly.
  it('opens up all the way when there is nothing to measure against', () => {
    expect(radiusFromNearest(null)).toBe(MAX_ONBOARDING_RADIUS_KM)
  })

  it('always returns a whole number of kilometres', () => {
    expect(radiusFromNearest(7.3)).toBe(15)
    expect(Number.isInteger(radiusFromNearest(3.7))).toBe(true)
  })
})

describe('locationPromptDelayMs', () => {
  it('holds back a full minute when a link sent the user to a specific place', () => {
    expect(locationPromptDelayMs({ fromDeepLink: true, hasAnyPosition: true })).toBe(DEEP_LINK_DELAY_MS)
    // Even with no position: the link already decided where to look.
    expect(locationPromptDelayMs({ fromDeepLink: true, hasAnyPosition: false })).toBe(DEEP_LINK_DELAY_MS)
  })

  it('asks immediately when the map has nothing to centre on', () => {
    expect(locationPromptDelayMs({ fromDeepLink: false, hasAnyPosition: false })).toBe(0)
  })

  it('otherwise lets the map paint first', () => {
    expect(locationPromptDelayMs({ fromDeepLink: false, hasAnyPosition: true })).toBe(DEFAULT_DELAY_MS)
  })
})
