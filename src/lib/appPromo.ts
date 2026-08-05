// "Get the app" nudge for the mobile web. Interest first, never on arrival:
// it waits until someone has looked at a few events or stayed a while, then
// keeps its distance — every later showing has to be earned with six more
// events, and three refusals in a row buy three days of silence.

export const PROMO_KEY = 'meuwe_app_promo'
/** Three events opened, or a minute in the app, earns the first showing. */
export const PROMO_MIN_EVENTS = 3
export const PROMO_MIN_SECONDS = 60
/** Every showing after the first: six more events since the last one. */
export const PROMO_REPEAT_EVENTS = 6
/** Three refusals in a row and it stops asking for PROMO_COOLDOWN_MS. */
export const PROMO_MAX_DISMISSALS = 3
export const PROMO_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000
/** Ids are kept only to spot repeat views; the tally is viewCount. */
const MAX_TRACKED_IDS = 20

export interface PromoState {
  /** The most recent ids, for deduplication. Capped — never count these. */
  eventIds: string[]
  /** Distinct events opened, ever. Grows past the id cap. */
  viewCount: number
  shownCount: number
  lastShownAt: number | null
  /** viewCount at the last showing — the mark the next six are counted from. */
  viewsAtLastShow: number
  /** Refusals in the current cycle; reset once a cooldown has run its course. */
  dismissCount: number
  lastDismissedAt: number | null
}

export const emptyPromoState = (): PromoState => ({
  eventIds: [], viewCount: 0, shownCount: 0, lastShownAt: null,
  viewsAtLastShow: 0, dismissCount: 0, lastDismissedAt: null,
})

const num = (v: unknown, fallback: number): number => typeof v === 'number' ? v : fallback

export function parsePromoState(raw: string | null): PromoState {
  if (!raw) return emptyPromoState()
  try {
    const parsed = JSON.parse(raw) as Partial<PromoState>
    const eventIds = Array.isArray(parsed.eventIds) ? parsed.eventIds.filter(x => typeof x === 'string') : []
    const shownCount = num(parsed.shownCount, 0)
    const lastShownAt = typeof parsed.lastShownAt === 'number' ? parsed.lastShownAt : null
    return {
      eventIds,
      // Written before the tally existed: the ids are all we know, and below the
      // cap they are exactly right.
      viewCount: num(parsed.viewCount, eventIds.length),
      shownCount,
      lastShownAt,
      viewsAtLastShow: num(parsed.viewsAtLastShow, 0),
      // Same vintage: back then every showing ended in a dismissal and three of
      // them meant "never again". They now mean one spent cycle, so the visitor
      // comes back into range once the cooldown is over rather than never.
      dismissCount: num(parsed.dismissCount, shownCount),
      lastDismissedAt: typeof parsed.lastDismissedAt === 'number' ? parsed.lastDismissedAt : lastShownAt,
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
  return {
    ...state,
    eventIds: [...state.eventIds, eventId].slice(-MAX_TRACKED_IDS),
    viewCount: state.viewCount + 1,
  }
}

/**
 * The first showing is earned by interest of either kind — three events, or a
 * minute spent here. Later ones only by events: time keeps passing on its own,
 * so a clock-based repeat would mean a sheet every minute for anyone who reads
 * slowly.
 */
export function isPromoTriggered(state: PromoState, secondsInApp: number): boolean {
  if (state.shownCount === 0) {
    return state.viewCount >= PROMO_MIN_EVENTS || secondsInApp >= PROMO_MIN_SECONDS
  }
  return state.viewCount >= state.viewsAtLastShow + PROMO_REPEAT_EVENTS
}

/** True while the three-day silence after a third refusal is still running. */
function inCooldown(state: PromoState, now: number): boolean {
  if (state.dismissCount < PROMO_MAX_DISMISSALS || state.lastDismissedAt === null) return false
  return now - state.lastDismissedAt < PROMO_COOLDOWN_MS
}

/**
 * Whether the nudge may appear right now. Callers add their own context checks
 * (native, desktop, no store listing, another layer open) — this part is only
 * about interest and frequency.
 */
export function canShowPromo(state: PromoState, secondsInApp: number, now: number): boolean {
  if (inCooldown(state, now)) return false
  return isPromoTriggered(state, secondsInApp)
}

export function markPromoShown(state: PromoState, now: number): PromoState {
  return {
    ...state,
    shownCount: state.shownCount + 1,
    lastShownAt: now,
    viewsAtLastShow: state.viewCount,
  }
}

/**
 * Counted when the sheet is closed rather than when it opens, so a showing the
 * visitor never got to see cannot spend the budget.
 */
export function markPromoDismissed(state: PromoState, now: number): PromoState {
  // A refusal arriving after the silence has run out opens a new cycle: three
  // more chances, not one and then quiet for good.
  const cycleSpent = state.dismissCount >= PROMO_MAX_DISMISSALS
    && state.lastDismissedAt !== null
    && now - state.lastDismissedAt >= PROMO_COOLDOWN_MS
  return {
    ...state,
    dismissCount: cycleSpent ? 1 : state.dismissCount + 1,
    lastDismissedAt: now,
  }
}
