import { describe, it, expect } from 'vitest'
import {
  emptyPromoState, parsePromoState, recordEventView, isPromoTriggered,
  canShowPromo, markPromoShown,
  PROMO_MAX_SHOWS, PROMO_COOLDOWN_MS, PROMO_MIN_EVENTS, PROMO_MIN_SECONDS,
  type PromoState,
} from './appPromo'

const NOW = 1_800_000_000_000

const withEvents = (n: number): PromoState => ({
  ...emptyPromoState(),
  eventIds: Array.from({ length: n }, (_, i) => `e${i}`),
})

describe('parsePromoState', () => {
  it('starts empty when nothing is stored', () => {
    expect(parsePromoState(null)).toEqual(emptyPromoState())
  })

  it('survives a corrupted entry instead of throwing', () => {
    expect(parsePromoState('{not json')).toEqual(emptyPromoState())
  })

  it('ignores fields of the wrong shape', () => {
    expect(parsePromoState('{"eventIds":"nope","shownCount":"2"}')).toEqual(emptyPromoState())
  })
})

describe('recordEventView', () => {
  it('counts distinct events', () => {
    let s = emptyPromoState()
    s = recordEventView(s, 'a')
    s = recordEventView(s, 'b')
    expect(s.eventIds).toEqual(['a', 'b'])
  })

  it('does not count the same event twice', () => {
    let s = recordEventView(emptyPromoState(), 'a')
    s = recordEventView(s, 'a')
    expect(s.eventIds).toEqual(['a'])
  })
})

describe('isPromoTriggered', () => {
  it('is false on arrival', () => {
    expect(isPromoTriggered(emptyPromoState(), 0)).toBe(false)
  })

  it('needs three different events', () => {
    expect(isPromoTriggered(withEvents(PROMO_MIN_EVENTS - 1), 0)).toBe(false)
    expect(isPromoTriggered(withEvents(PROMO_MIN_EVENTS), 0)).toBe(true)
  })

  it('or a minute in the app', () => {
    expect(isPromoTriggered(emptyPromoState(), PROMO_MIN_SECONDS - 1)).toBe(false)
    expect(isPromoTriggered(emptyPromoState(), PROMO_MIN_SECONDS)).toBe(true)
  })
})

describe('canShowPromo', () => {
  it('stays quiet until the visitor shows interest', () => {
    expect(canShowPromo(emptyPromoState(), 10, NOW)).toBe(false)
  })

  it('waits three days after a dismissal', () => {
    const shown = markPromoShown(withEvents(3), NOW)
    expect(canShowPromo(shown, 999, NOW + PROMO_COOLDOWN_MS - 1)).toBe(false)
    expect(canShowPromo(shown, 999, NOW + PROMO_COOLDOWN_MS)).toBe(true)
  })

  it('gives up for good after the third showing', () => {
    let s = withEvents(3)
    for (let i = 0; i < PROMO_MAX_SHOWS; i++) {
      const t = NOW + i * PROMO_COOLDOWN_MS
      expect(canShowPromo(s, 999, t)).toBe(true)
      s = markPromoShown(s, t)
    }
    expect(s.shownCount).toBe(3)
    // A year later it still never comes back.
    expect(canShowPromo(s, 999, NOW + 365 * 24 * 3600_000)).toBe(false)
  })
})
