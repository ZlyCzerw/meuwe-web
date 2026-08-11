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

/**
 * The two steps that really are about this device, and are therefore allowed to
 * live in its localStorage. The interests step is not one of them: see
 * shouldAskInterests.
 */
export interface OnboardingState {
  /** Set once the location step has been answered, either way. */
  locationDone: boolean
  /** Set once the invite sheet has been offered, so it is offered only once. */
  inviteDone: boolean
}

export const emptyOnboardingState = (): OnboardingState =>
  ({ locationDone: false, inviteDone: false })

export function parseOnboardingState(raw: string | null): OnboardingState {
  if (!raw) return emptyOnboardingState()
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      locationDone: parsed.locationDone === true,
      inviteDone: parsed.inviteDone === true,
    }
  } catch {
    return emptyOnboardingState()
  }
}

/**
 * Whether to put the interests step in front of this person.
 *
 * The answer belongs to the ACCOUNT, so it is read from the account:
 * profiles.interests_onboarded_at, stamped the moment the card is answered.
 * It used to be a flag in localStorage, which meant a new phone, a new browser,
 * a reinstall — or Safari evicting the entry after seven quiet days — read as
 * "never asked" and showed the card again to someone who had already filled it
 * in. The same flag, being device-wide rather than account-wide, also silenced
 * the step for a SECOND account signing in on that device, leaving it with no
 * interests at all: selectEventAudience then drops it from every fan-out, so
 * that half never showed up as a complaint.
 *
 * The stamp is a column of its own rather than `interests.length === 0` because
 * emptying the list in the profile panel is an answer too. Someone who removes
 * every tag has said what they want; the card must not come back and argue.
 *
 * `askedThisSession` is held in memory only, so a save that failed is asked
 * about again at the next launch rather than being lost for good.
 */
export function shouldAskInterests(ctx: {
  /** null while it is still loading — the one state that is not an answer. */
  profile: { interests_onboarded_at: string | null } | null
  askedThisSession: boolean
}): boolean {
  if (ctx.profile === null) return false
  if (ctx.askedThisSession) return false
  return ctx.profile.interests_onboarded_at === null
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
