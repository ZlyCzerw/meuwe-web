// First-run flow for the native app. The rule it exists to enforce: no system
// permission dialog appears before a sentence explaining why, and never two
// dialogs at once. Notifications are deliberately NOT part of it — they are
// asked for at the first follow, where the reason is obvious (see EventSheet).

export const ONBOARDING_KEY = 'meuwe_onboarding_v1'

/** A deep link put the user somewhere specific; let them look around first. */
export const DEEP_LINK_DELAY_MS = 60_000
/** Otherwise just let the map paint before covering it. */
export const DEFAULT_DELAY_MS = 3_000

export interface OnboardingState {
  /** Set once the location step has been answered, either way. */
  locationDone: boolean
  /** Set once the invite sheet has been offered, so it is offered only once. */
  inviteDone: boolean
}

export const emptyOnboardingState = (): OnboardingState => ({ locationDone: false, inviteDone: false })

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

export function readOnboardingState(): OnboardingState {
  try { return parseOnboardingState(localStorage.getItem(ONBOARDING_KEY)) }
  catch { return emptyOnboardingState() }
}

export function writeOnboardingState(state: OnboardingState): void {
  try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state)) } catch { /* private mode */ }
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
