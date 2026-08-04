import { describe, it, expect } from 'vitest'
import {
  parseOnboardingState, emptyOnboardingState, locationPromptDelayMs,
  radiusFromNearest, MIN_ONBOARDING_RADIUS_KM, MAX_ONBOARDING_RADIUS_KM,
  DEEP_LINK_DELAY_MS, DEFAULT_DELAY_MS,
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
    expect(parseOnboardingState('{"interestsDone":"yes"}').interestsDone).toBe(false)
    expect(parseOnboardingState('{"interestsDone":true}').interestsDone).toBe(true)
  })

  // Everyone who installed before the interests step has an entry without the
  // field. Reading it as "not done yet" is what makes them see the new step
  // instead of silently skipping it.
  it('offers the interests step to someone stored before it existed', () => {
    const old = '{"locationDone":true,"inviteDone":true}'
    expect(parseOnboardingState(old).interestsDone).toBe(false)
    expect(parseOnboardingState(old).locationDone).toBe(true)
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
