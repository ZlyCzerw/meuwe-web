import type { PushUiState } from './pushState'

// When to ask for notification permission.
//
// It used to hang on a single event: the first follow, remembered forever in
// `meuwe_follow_notify_asked`. Someone who never pressed follow was never asked,
// and someone who said "not now" was never asked again — so the app kept no way
// of reaching most of the people using it.
//
// The shape is the same as appPromo.ts: interest first, a hard ceiling, and a
// long cooldown after a refusal. Four signals count as interest, any one of them
// is enough, and none of them is the bare act of opening the app.

export const PUSH_ASK_KEY = 'meuwe_push_ask'
/** The flag the old one-shot rule wrote. Read once, for the migration. */
export const LEGACY_FOLLOW_ASKED_KEY = 'meuwe_follow_notify_asked'

/** Three asks in total, ever. The third refusal is the last word. */
export const PUSH_ASK_MAX = 3
export const PUSH_ASK_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000
export const PUSH_ASK_MIN_EVENT_VIEWS = 3
export const PUSH_ASK_MIN_SESSIONS = 2
/** Only the count matters; the ids are kept to spot repeat views of one event. */
const MAX_TRACKED_IDS = 20

export interface PushAskState {
  askCount: number
  lastAskedAt: number | null
  declinedAt: number | null
  /** Distinct events opened. */
  eventIds: string[]
  sessions: number
  followed: boolean
  created: boolean
}

export const emptyPushAskState = (): PushAskState => ({
  askCount: 0, lastAskedAt: null, declinedAt: null,
  eventIds: [], sessions: 0, followed: false, created: false,
})

/**
 * `legacyAsked` is whether LEGACY_FOLLOW_ASKED_KEY exists. It only matters when
 * there is no state of our own: an install that already answered the old
 * question must not be asked again the moment it updates, so it starts one ask
 * in and inside the cooldown.
 */
export function parsePushAskState(raw: string | null, legacyAsked: boolean, now: number): PushAskState {
  if (!raw) {
    const empty = emptyPushAskState()
    return legacyAsked ? { ...empty, askCount: 1, lastAskedAt: now, declinedAt: now } : empty
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PushAskState>
    return {
      askCount: typeof parsed.askCount === 'number' ? parsed.askCount : 0,
      lastAskedAt: typeof parsed.lastAskedAt === 'number' ? parsed.lastAskedAt : null,
      declinedAt: typeof parsed.declinedAt === 'number' ? parsed.declinedAt : null,
      eventIds: Array.isArray(parsed.eventIds) ? parsed.eventIds.filter(x => typeof x === 'string') : [],
      sessions: typeof parsed.sessions === 'number' ? parsed.sessions : 0,
      followed: parsed.followed === true,
      created: parsed.created === true,
    }
  } catch {
    // Corrupted entry: start over rather than crash the app on boot.
    return emptyPushAskState()
  }
}

export function readPushAskState(now: number = Date.now()): PushAskState {
  try {
    return parsePushAskState(
      localStorage.getItem(PUSH_ASK_KEY),
      localStorage.getItem(LEGACY_FOLLOW_ASKED_KEY) !== null,
      now,
    )
  } catch { return emptyPushAskState() } // private mode
}

export function writePushAskState(state: PushAskState): void {
  try { localStorage.setItem(PUSH_ASK_KEY, JSON.stringify(state)) } catch { /* private mode */ }
}

/** Distinct events only: opening the same pin three times is not interest. */
export function recordEventView(state: PushAskState, eventId: string): PushAskState {
  if (state.eventIds.includes(eventId)) return state
  return { ...state, eventIds: [...state.eventIds, eventId].slice(-MAX_TRACKED_IDS) }
}

export function recordSessionStart(state: PushAskState): PushAskState {
  return { ...state, sessions: state.sessions + 1 }
}

export function recordFollow(state: PushAskState): PushAskState {
  return state.followed ? state : { ...state, followed: true }
}

export function recordCreate(state: PushAskState): PushAskState {
  return state.created ? state : { ...state, created: true }
}

export function markAsked(state: PushAskState, now: number): PushAskState {
  return { ...state, askCount: state.askCount + 1, lastAskedAt: now }
}

export function markDeclined(state: PushAskState, now: number): PushAskState {
  return { ...state, declinedAt: now }
}

/** Has this person done anything that makes a notification worth offering? */
export function isPushAskTriggered(state: PushAskState): boolean {
  return state.followed
    || state.created
    || state.eventIds.length >= PUSH_ASK_MIN_EVENT_VIEWS
    || state.sessions >= PUSH_ASK_MIN_SESSIONS
}

/**
 * The half of the decision that needs nothing but stored state: has a trigger
 * fired, is there budget left, is the cooldown over. Callers check this before
 * asking the device what it can do, because that costs a round trip and would
 * otherwise run on every poll.
 */
export function isPushAskDue(state: PushAskState, now: number): boolean {
  if (state.askCount >= PUSH_ASK_MAX) return false
  if (state.declinedAt !== null && now - state.declinedAt < PUSH_ASK_COOLDOWN_MS) return false
  return isPushAskTriggered(state)
}

/**
 * `canOfferFallback` is the caller saying it has something to show besides the
 * permission prompt — the calendar, in the follow card. Without it, a 'blocked'
 * or 'unsupported' device gets a card whose only button cannot do anything, so
 * we stay quiet instead. Callers add their own context checks (a clear screen,
 * a signed-in user); this part is only about interest and frequency.
 */
export function canAskForPush(
  state: PushAskState,
  ctx: { pushState: PushUiState; canOfferFallback: boolean },
  now: number,
): boolean {
  if (ctx.pushState === 'on') return false
  if ((ctx.pushState === 'blocked' || ctx.pushState === 'unsupported') && !ctx.canOfferFallback) return false
  return isPushAskDue(state, now)
}

/**
 * The whole decision a polling caller has to make, in one place a test can
 * reach.
 *
 * `canAskForPush` answers "is this device worth asking". This adds the two
 * questions that come first, because the poll runs seconds after launch, when
 * neither answer may have arrived yet:
 *
 *   intentKnown     — the profile has loaded. Without it resolvePushState sees
 *                     no intent and returns 'off' before it even looks at the
 *                     device, so a registered phone reads as never asked.
 *   deviceConfirmed — the device answered. No FCM token yet, or a lookup that
 *                     failed offline, looks exactly like "not registered".
 *
 * Neither is a reason to interrupt anyone, and neither is worth spending one of
 * the three asks this account will ever get: the poll comes round again in ten
 * seconds, and by then the answer is usually real.
 */
export function shouldOpenPushAsk(
  state: PushAskState,
  ctx: {
    intentKnown: boolean
    pushState: PushUiState
    deviceConfirmed: boolean
    canOfferFallback: boolean
  },
  now: number,
): boolean {
  if (!ctx.intentKnown) return false
  // 'off' is a statement about the account, not about this handset, so an
  // unreadable device does not stand in the way of asking.
  if (ctx.pushState !== 'off' && !ctx.deviceConfirmed) return false
  return canAskForPush(state, { pushState: ctx.pushState, canOfferFallback: ctx.canOfferFallback }, now)
}
