// "Get the app" nudge for the mobile web. Interest first, never on arrival:
// it waits until someone has looked at a few events or stayed a while, and it
// gives up quickly if they are not interested.

export const PROMO_KEY = 'meuwe_app_promo'
/** Three showings in total, ever. The third dismissal is the last. */
export const PROMO_MAX_SHOWS = 3
export const PROMO_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000
export const PROMO_MIN_EVENTS = 3
export const PROMO_MIN_SECONDS = 60
/** Only the count matters; the ids are kept to spot repeat views of one event. */
const MAX_TRACKED_IDS = 20

export interface PromoState {
  eventIds: string[]
  shownCount: number
  lastShownAt: number | null
}

export const emptyPromoState = (): PromoState => ({ eventIds: [], shownCount: 0, lastShownAt: null })

export function parsePromoState(raw: string | null): PromoState {
  if (!raw) return emptyPromoState()
  try {
    const parsed = JSON.parse(raw) as Partial<PromoState>
    return {
      eventIds: Array.isArray(parsed.eventIds) ? parsed.eventIds.filter(x => typeof x === 'string') : [],
      shownCount: typeof parsed.shownCount === 'number' ? parsed.shownCount : 0,
      lastShownAt: typeof parsed.lastShownAt === 'number' ? parsed.lastShownAt : null,
    }
  } catch {
    // Corrupted entry: start over rather than crash the app on boot.
    return emptyPromoState()
  }
}

export function readPromoState(): PromoState {
  try { return parsePromoState(localStorage.getItem(PROMO_KEY)) }
  catch { return emptyPromoState() } // private mode
}

export function writePromoState(state: PromoState): void {
  try { localStorage.setItem(PROMO_KEY, JSON.stringify(state)) } catch { /* private mode */ }
}

/** Distinct events only: opening the same pin three times is not interest. */
export function recordEventView(state: PromoState, eventId: string): PromoState {
  if (state.eventIds.includes(eventId)) return state
  return { ...state, eventIds: [...state.eventIds, eventId].slice(-MAX_TRACKED_IDS) }
}

export function isPromoTriggered(state: PromoState, secondsInApp: number): boolean {
  return state.eventIds.length >= PROMO_MIN_EVENTS || secondsInApp >= PROMO_MIN_SECONDS
}

/**
 * Whether the nudge may appear right now. Callers add their own context checks
 * (native, desktop, no store listing, another layer open) — this part is only
 * about interest and frequency.
 */
export function canShowPromo(state: PromoState, secondsInApp: number, now: number): boolean {
  if (state.shownCount >= PROMO_MAX_SHOWS) return false
  if (state.lastShownAt !== null && now - state.lastShownAt < PROMO_COOLDOWN_MS) return false
  return isPromoTriggered(state, secondsInApp)
}

export function markPromoShown(state: PromoState, now: number): PromoState {
  return { ...state, shownCount: state.shownCount + 1, lastShownAt: now }
}
