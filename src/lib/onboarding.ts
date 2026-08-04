// First run: location → interests → invite. The rule it exists to enforce: no
// system permission dialog appears before a sentence explaining why, and never
// two dialogs at once. Notifications are deliberately NOT part of it — they are
// asked for once the user has shown some interest (see lib/pushAsk.ts).
//
// The interests step is the one with a backend consequence: selectEventAudience
// (supabase/functions/_shared/audience.ts) drops anyone whose `interests` share
// nothing with a tagged event, so an account that never answered it is invisible
// to the geo fan-out.

export const ONBOARDING_KEY = 'meuwe_onboarding_v1'

/** A deep link put the user somewhere specific; let them look around first. */
export const DEEP_LINK_DELAY_MS = 60_000
/** Otherwise just let the map paint before covering it. */
export const DEFAULT_DELAY_MS = 3_000

export interface OnboardingState {
  /** Set once the location step has been answered, either way. */
  locationDone: boolean
  /** Set once the interests step has been answered, either way. */
  interestsDone: boolean
  /** Set once the invite sheet has been offered, so it is offered only once. */
  inviteDone: boolean
}

export const emptyOnboardingState = (): OnboardingState =>
  ({ locationDone: false, interestsDone: false, inviteDone: false })

export function parseOnboardingState(raw: string | null): OnboardingState {
  if (!raw) return emptyOnboardingState()
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      locationDone: parsed.locationDone === true,
      // Missing field (anything stored before this step existed) reads as false,
      // so an existing install is offered the step rather than skipping it.
      interestsDone: parsed.interestsDone === true,
      inviteDone: parsed.inviteDone === true,
    }
  } catch {
    return emptyOnboardingState()
  }
}

export function readOnboardingState(): OnboardingState {
  try { return parseOnboardingState(localStorage.getItem(ONBOARDING_KEY)) }
  catch { return emptyOnboardingState() }
}

export function writeOnboardingState(state: OnboardingState): void {
  try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state)) } catch { /* private mode */ }
}

/**
 * Floor for the radius the interests step writes. Twice the distance to the
 * nearest event is the rule, but in a dense city that distance can be 300 m,
 * and a 600 m radius notifies the new account about nothing at all.
 */
export const MIN_ONBOARDING_RADIUS_KM = 5
/** Matches MAX_RADIUS_KM in supabase/functions/_shared/audience.ts — past it the fan-out ignores the value anyway. */
export const MAX_ONBOARDING_RADIUS_KM = 50

/**
 * The radius to start a new account on: far enough to take in the nearest thing
 * happening, and then the same distance again.
 *
 * `nearestKm` is null when nothing was found within range or the user's position
 * is unknown. That is not a reason to pick a small number — with nothing nearby,
 * the wide end is the only setting that can ever deliver anything.
 */
export function radiusFromNearest(nearestKm: number | null): number {
  if (nearestKm === null) return MAX_ONBOARDING_RADIUS_KM
  const doubled = Math.round(nearestKm * 2)
  return Math.min(Math.max(doubled, MIN_ONBOARDING_RADIUS_KM), MAX_ONBOARDING_RADIUS_KM)
}

/**
 * How long to wait before explaining the location permission.
 *
 * `hasAnyPosition` is false when nothing in the MapScreen fallback chain has a
 * value (no cached position, no link coordinates) and the map is about to land
 * on its last-resort default. That is the one case where waiting helps nobody,
 * so the explanation comes straight away.
 */
export function locationPromptDelayMs(ctx: { fromDeepLink: boolean; hasAnyPosition: boolean }): number {
  if (ctx.fromDeepLink) return DEEP_LINK_DELAY_MS
  if (!ctx.hasAnyPosition) return 0
  return DEFAULT_DELAY_MS
}
