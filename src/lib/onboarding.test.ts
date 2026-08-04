import { describe, it, expect } from 'vitest'
import {
  parseOnboardingState, emptyOnboardingState, locationPromptDelayMs,
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
