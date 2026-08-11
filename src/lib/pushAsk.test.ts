import { describe, it, expect } from 'vitest'
import {
  parsePushAskState, emptyPushAskState, canAskForPush, isPushAskDue, shouldOpenPushAsk,
  recordEventView, recordSessionStart, recordFollow, recordCreate,
  markAsked, markDeclined,
  PUSH_ASK_MAX, PUSH_ASK_COOLDOWN_MS, PUSH_ASK_MIN_EVENT_VIEWS,
} from './pushAsk'
import type { PushAskState } from './pushAsk'

const NOW = 1_700_000_000_000
const ask = (state: PushAskState, now = NOW) =>
  canAskForPush(state, { pushState: 'off', canOfferFallback: false }, now)

describe('parsePushAskState', () => {
  it('starts fresh with nothing stored', () => {
    expect(parsePushAskState(null, false, NOW)).toEqual(emptyPushAskState())
  })

  it('survives a corrupted entry', () => {
    expect(parsePushAskState('{oops', false, NOW)).toEqual(emptyPushAskState())
  })

  // Everyone who ever followed an event under the old code has this key. Reading
  // it as "never asked" would greet them with the prompt the moment they update.
  it('treats the old follow flag as one ask that was just declined', () => {
    const state = parsePushAskState(null, true, NOW)
    expect(state.askCount).toBe(1)
    expect(state.declinedAt).toBe(NOW)
    expect(ask(state)).toBe(false)
    expect(ask(state, NOW + PUSH_ASK_COOLDOWN_MS + 1)).toBe(false) // no trigger yet
  })

  it('ignores the old flag once real state exists', () => {
    const stored = JSON.stringify({ ...emptyPushAskState(), sessions: 2, askCount: 0 })
    const state = parsePushAskState(stored, true, NOW)
    expect(state.askCount).toBe(0)
    expect(state.sessions).toBe(2)
  })
})

describe('canAskForPush triggers', () => {
  it('says nothing to someone who has done nothing yet', () => {
    expect(ask(emptyPushAskState())).toBe(false)
  })

  it('asks on the first follow', () => {
    expect(ask(recordFollow(emptyPushAskState()))).toBe(true)
  })

  it('asks on the first event created', () => {
    expect(ask(recordCreate(emptyPushAskState()))).toBe(true)
  })

  it('asks after three different events have been opened', () => {
    let s = emptyPushAskState()
    s = recordEventView(s, 'a')
    s = recordEventView(s, 'b')
    expect(ask(s)).toBe(false)
    s = recordEventView(s, 'c')
    expect(ask(s)).toBe(true)
  })

  it('does not count the same event three times as interest', () => {
    let s = emptyPushAskState()
    s = recordEventView(s, 'a')
    s = recordEventView(s, 'a')
    s = recordEventView(s, 'a')
    expect(s.eventIds.length).toBe(1)
    expect(PUSH_ASK_MIN_EVENT_VIEWS).toBe(3)
    expect(ask(s)).toBe(false)
  })

  it('asks on the second session', () => {
    let s = recordSessionStart(emptyPushAskState())
    expect(ask(s)).toBe(false)
    s = recordSessionStart(s)
    expect(ask(s)).toBe(true)
  })
})

describe('canAskForPush frequency', () => {
  const triggered = () => recordFollow(emptyPushAskState())

  it('stops after three asks, ever', () => {
    let s = triggered()
    for (let i = 0; i < PUSH_ASK_MAX; i++) {
      expect(ask(s, NOW + i)).toBe(true)
      s = markDeclined(markAsked(s, NOW + i), NOW + i)
      s = { ...s, declinedAt: s.declinedAt! - PUSH_ASK_COOLDOWN_MS - 1 }
    }
    expect(s.askCount).toBe(PUSH_ASK_MAX)
    expect(ask(s, NOW + 10 * PUSH_ASK_COOLDOWN_MS)).toBe(false)
  })

  it('waits a fortnight after a refusal', () => {
    const declined = markDeclined(markAsked(triggered(), NOW), NOW)
    expect(ask(declined, NOW + PUSH_ASK_COOLDOWN_MS - 1)).toBe(false)
    expect(ask(declined, NOW + PUSH_ASK_COOLDOWN_MS)).toBe(true)
  })
})

// Asking the device what it can do costs a round trip, so the caller polls the
// cheap half first and only reaches for the device once this says yes.
describe('isPushAskDue', () => {
  it('is false until something has been done', () => {
    expect(isPushAskDue(emptyPushAskState(), NOW)).toBe(false)
  })

  it('is true once a trigger fired and the budget allows', () => {
    expect(isPushAskDue(recordFollow(emptyPushAskState()), NOW)).toBe(true)
  })

  it('is false inside the cooldown, so no device is queried', () => {
    const declined = markDeclined(markAsked(recordFollow(emptyPushAskState()), NOW), NOW)
    expect(isPushAskDue(declined, NOW + PUSH_ASK_COOLDOWN_MS - 1)).toBe(false)
    expect(isPushAskDue(declined, NOW + PUSH_ASK_COOLDOWN_MS)).toBe(true)
  })

  it('agrees with canAskForPush whenever the device is fine', () => {
    const s = recordFollow(emptyPushAskState())
    expect(isPushAskDue(s, NOW)).toBe(ask(s))
  })
})

describe('canAskForPush and what the device can do', () => {
  const triggered = () => recordFollow(emptyPushAskState())

  it('never asks someone who already receives notifications', () => {
    expect(canAskForPush(triggered(), { pushState: 'on', canOfferFallback: false }, NOW)).toBe(false)
    expect(canAskForPush(triggered(), { pushState: 'on', canOfferFallback: true }, NOW)).toBe(false)
  })

  // 'blocked' and 'unsupported' cannot be repaired by any button we could show,
  // so a card with nothing but the permission ask is a dead end. It is still
  // worth opening where there is something else to offer (the calendar).
  it('stays quiet when the only thing on offer is a prompt that cannot be raised', () => {
    for (const pushState of ['blocked', 'unsupported'] as const) {
      expect(canAskForPush(triggered(), { pushState, canOfferFallback: false }, NOW)).toBe(false)
      expect(canAskForPush(triggered(), { pushState, canOfferFallback: true }, NOW)).toBe(true)
    }
  })

  it('asks when the permission was never answered', () => {
    for (const pushState of ['off', 'needsPermission', 'needsRegistration'] as const) {
      expect(canAskForPush(triggered(), { pushState, canOfferFallback: false }, NOW)).toBe(true)
    }
  })
})

// The triggers exist to answer "does this person want notifications at all".
// An account holding push_enabled has already answered that; a device in
// 'needsPermission' or 'needsRegistration' is a different question — the one
// thing standing between a yes and delivery. Someone signing in on a new phone
// should not have to browse three events to be let past it.
describe('a device that cannot deliver what the account already asked for', () => {
  const fresh = () => recordSessionStart(emptyPushAskState()) // first launch, no trigger

  it('does not wait for a trigger', () => {
    expect(isPushAskDue(fresh(), NOW)).toBe(false)
    expect(isPushAskDue(fresh(), NOW, { repairNeeded: true })).toBe(true)
    for (const pushState of ['needsPermission', 'needsRegistration'] as const) {
      expect(canAskForPush(fresh(), { pushState, canOfferFallback: false }, NOW)).toBe(true)
      expect(shouldOpenPushAsk(fresh(), {
        intentKnown: true, pushState, deviceConfirmed: true, canOfferFallback: false,
      }, NOW)).toBe(true)
    }
  })

  // Skipping the trigger must not turn into nagging: the budget and the
  // cooldown are the whole reason this never becomes three prompts a day.
  it('still spends the same three asks, and still waits out a refusal', () => {
    let state = fresh()
    for (let i = 0; i < PUSH_ASK_MAX; i++) state = markAsked(state, NOW)
    expect(isPushAskDue(state, NOW, { repairNeeded: true })).toBe(false)

    const declined = markDeclined(markAsked(fresh(), NOW), NOW)
    expect(isPushAskDue(declined, NOW + PUSH_ASK_COOLDOWN_MS - 1, { repairNeeded: true })).toBe(false)
    expect(isPushAskDue(declined, NOW + PUSH_ASK_COOLDOWN_MS, { repairNeeded: true })).toBe(true)
  })

  // 'blocked' needs repairing too, but not by anything this card can do — only
  // the system settings screen can. It stays on the old rules.
  it('does not extend the waiver to a device no button can fix', () => {
    expect(canAskForPush(fresh(), { pushState: 'blocked', canOfferFallback: true }, NOW)).toBe(false)
    expect(canAskForPush(fresh(), { pushState: 'unsupported', canOfferFallback: true }, NOW)).toBe(false)
  })

  // An unread device reads exactly like an unregistered one at a cold start,
  // and the waiver must not turn that ambiguity into a prompt.
  it('holds off until the device reading is confirmed', () => {
    expect(shouldOpenPushAsk(fresh(), {
      intentKnown: true, pushState: 'needsRegistration', deviceConfirmed: false, canOfferFallback: false,
    }, NOW)).toBe(false)
  })
})

describe('shouldOpenPushAsk', () => {
  const triggered = () => recordFollow(emptyPushAskState())
  const ctx = (over: Partial<Parameters<typeof shouldOpenPushAsk>[1]>) => ({
    intentKnown: true, pushState: 'off' as const, deviceConfirmed: true, canOfferFallback: false, ...over,
  })

  // The profile arrives over the network, and until it does, resolvePushState
  // sees no intent and returns 'off' before it even looks at the device — so a
  // fully registered phone reads as someone who was never asked.
  it('stays quiet while the profile has not loaded', () => {
    expect(shouldOpenPushAsk(triggered(), ctx({ intentKnown: false }), NOW)).toBe(false)
  })

  // A cold start where FCM has not produced a token yet is indistinguishable
  // from a device that was never registered. The poll comes round again in ten
  // seconds, and by then the answer is usually real.
  it('stays quiet while the device reading is unconfirmed', () => {
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'needsRegistration', deviceConfirmed: false }), NOW)).toBe(false)
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'needsPermission', deviceConfirmed: false }), NOW)).toBe(false)
  })

  // 'off' is a statement about the account, not about this handset.
  it('still asks someone who never opted in, even if the device could not be checked', () => {
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'off', deviceConfirmed: false }), NOW)).toBe(true)
  })

  it('asks on a confirmed reading, exactly as canAskForPush would', () => {
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'off' }), NOW)).toBe(true)
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'on' }), NOW)).toBe(false)
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'needsPermission' }), NOW)).toBe(true)
  })
})
