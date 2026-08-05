import { describe, it, expect } from 'vitest'
import {
  emptyPromoState, parsePromoState, recordEventView, isPromoTriggered,
  canShowPromo, markPromoShown, markPromoDismissed,
  PROMO_MAX_DISMISSALS, PROMO_COOLDOWN_MS, PROMO_MIN_EVENTS, PROMO_MIN_SECONDS,
  PROMO_REPEAT_EVENTS,
  type PromoState,
} from './appPromo'

const NOW = 1_800_000_000_000

/** A visitor who has opened `n` different events and nothing else. */
const withViews = (n: number): PromoState => ({ ...emptyPromoState(), viewCount: n })

/** Shown once at `at`, with `n` events opened by then. */
const shownAfter = (n: number, at = NOW): PromoState => markPromoShown(withViews(n), at)

describe('parsePromoState', () => {
  it('starts empty when nothing is stored', () => {
    expect(parsePromoState(null)).toEqual(emptyPromoState())
  })

  it('survives a corrupted entry instead of throwing', () => {
    expect(parsePromoState('{not json')).toEqual(emptyPromoState())
  })

  it('ignores fields of the wrong shape', () => {
    expect(parsePromoState('{"eventIds":"nope","viewCount":"2"}')).toEqual(emptyPromoState())
  })

  // Entries written before the repeat rule existed have no viewCount, but they
  // do have the ids. Reading the count off them keeps the visitor's progress.
  it('takes the view count from the stored ids when the field is missing', () => {
    expect(parsePromoState('{"eventIds":["a","b"]}').viewCount).toBe(2)
  })

  // The old state counted showings and stopped after three, forever. Those three
  // showings were all dismissals, so they become one full cycle — the cooldown
  // runs from the last one and then the visitor is asked again.
  it('reads an old three-showing entry as a spent cycle, not as a dead end', () => {
    const old = parsePromoState('{"eventIds":["a"],"shownCount":3,"lastShownAt":' + NOW + '}')
    expect(old.dismissCount).toBe(3)
    expect(old.lastDismissedAt).toBe(NOW)
    expect(canShowPromo(old, 999, NOW + PROMO_COOLDOWN_MS - 1)).toBe(false)
    expect(canShowPromo({ ...old, viewCount: 99 }, 999, NOW + PROMO_COOLDOWN_MS)).toBe(true)
  })
})

describe('recordEventView', () => {
  it('counts distinct events', () => {
    let s = emptyPromoState()
    s = recordEventView(s, 'a')
    s = recordEventView(s, 'b')
    expect(s.viewCount).toBe(2)
  })

  it('does not count the same event twice', () => {
    let s = recordEventView(emptyPromoState(), 'a')
    s = recordEventView(s, 'a')
    expect(s.viewCount).toBe(1)
  })

  // Only the last few ids are kept, so the tally cannot live in their length:
  // past the cap it would stop growing and the "every six" rule would go quiet.
  it('keeps counting past the number of ids it remembers', () => {
    let s = emptyPromoState()
    for (let i = 0; i < 60; i++) s = recordEventView(s, `e${i}`)
    expect(s.viewCount).toBe(60)
    expect(s.eventIds.length).toBeLessThan(60)
  })
})

describe('isPromoTriggered', () => {
  it('is false on arrival', () => {
    expect(isPromoTriggered(emptyPromoState(), 0)).toBe(false)
  })

  it('needs three different events', () => {
    expect(isPromoTriggered(withViews(PROMO_MIN_EVENTS - 1), 0)).toBe(false)
    expect(isPromoTriggered(withViews(PROMO_MIN_EVENTS), 0)).toBe(true)
  })

  it('or a minute in the app', () => {
    expect(isPromoTriggered(emptyPromoState(), PROMO_MIN_SECONDS - 1)).toBe(false)
    expect(isPromoTriggered(emptyPromoState(), PROMO_MIN_SECONDS)).toBe(true)
  })

  it('asks again after six more events', () => {
    const s = shownAfter(3)
    expect(isPromoTriggered({ ...s, viewCount: 3 + PROMO_REPEAT_EVENTS - 1 }, 0)).toBe(false)
    expect(isPromoTriggered({ ...s, viewCount: 3 + PROMO_REPEAT_EVENTS }, 0)).toBe(true)
  })

  // The minute is the way in for someone who browses without opening anything.
  // Once they have seen the sheet, time alone must not bring it back — every
  // later showing is earned with six more events.
  it('does not let time alone bring it back', () => {
    expect(isPromoTriggered(shownAfter(3), 60 * 60)).toBe(false)
  })

  it('counts the six from the last showing, not from the start', () => {
    const second = markPromoShown({ ...shownAfter(3), viewCount: 9 }, NOW + 1000)
    expect(isPromoTriggered({ ...second, viewCount: 14 }, 0)).toBe(false)
    expect(isPromoTriggered({ ...second, viewCount: 15 }, 0)).toBe(true)
  })
})

describe('canShowPromo', () => {
  it('stays quiet until the visitor shows interest', () => {
    expect(canShowPromo(emptyPromoState(), 10, NOW)).toBe(false)
  })

  it('shows on the third event without waiting for anything else', () => {
    expect(canShowPromo(withViews(PROMO_MIN_EVENTS), 0, NOW)).toBe(true)
  })

  // One or two dismissals mean "not now", not "stop asking": the next six
  // events earn another try, straight away.
  it('asks again after one dismissal', () => {
    const s = markPromoDismissed(shownAfter(3), NOW)
    expect(canShowPromo({ ...s, viewCount: 9 }, 0, NOW + 1000)).toBe(true)
  })

  it('goes quiet for three days after the third dismissal', () => {
    let s: PromoState = withViews(3)
    for (let i = 0; i < PROMO_MAX_DISMISSALS; i++) {
      s = markPromoShown(s, NOW)
      s = markPromoDismissed(s, NOW)
      s = { ...s, viewCount: s.viewCount + PROMO_REPEAT_EVENTS }
    }
    expect(s.dismissCount).toBe(PROMO_MAX_DISMISSALS)
    expect(canShowPromo(s, 999, NOW + PROMO_COOLDOWN_MS - 1)).toBe(false)
    expect(canShowPromo(s, 999, NOW + PROMO_COOLDOWN_MS)).toBe(true)
  })

  // Three days later the count starts over, so the next cycle is another three
  // dismissals rather than one dismissal and silence.
  it('starts a fresh cycle once the cooldown is over', () => {
    const spent: PromoState = {
      ...withViews(20), dismissCount: PROMO_MAX_DISMISSALS, lastDismissedAt: NOW,
      shownCount: 3, viewsAtLastShow: 20,
    }
    const later = NOW + PROMO_COOLDOWN_MS
    const dismissed = markPromoDismissed(markPromoShown(spent, later), later)
    expect(dismissed.dismissCount).toBe(1)
    expect(canShowPromo({ ...dismissed, viewCount: 26 }, 0, later + 1000)).toBe(true)
  })
})
