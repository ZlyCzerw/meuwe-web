import { describe, it, expect } from 'vitest'
import { deliverableFrom, type DeliverableProfile } from './recipients'

const p = (id: string, language: string | null = 'pl'): DeliverableProfile => ({ id, language })

describe('deliverableFrom', () => {
  // The profiles handed in are already the push_enabled ones — anyone missing a
  // row here either never turned notifications on or has no profile at all, and
  // in both cases there is nothing to deliver to.
  it('keeps only the users who asked for notifications', () => {
    const { ids } = deliverableFrom([p('a'), p('c')], [])
    expect(ids).toEqual(['a', 'c'])
  })

  it('drops the ones who muted this event', () => {
    const { ids } = deliverableFrom([p('a'), p('b'), p('c')], ['b'])
    expect(ids).toEqual(['a', 'c'])
  })

  it('says nobody rather than everybody when all of them muted it', () => {
    expect(deliverableFrom([p('a'), p('b')], ['a', 'b']).ids).toEqual([])
  })

  it('carries each recipient language, so nobody is notified in a foreign one', () => {
    const { langByUser } = deliverableFrom([p('a', 'de'), p('b', null), p('c', 'sl')], [])
    expect(langByUser.get('a')).toBe('de')
    // No language recorded, and one we have no notification text for, both fall
    // back to English rather than dropping the recipient.
    expect(langByUser.get('b')).toBe('en')
    expect(langByUser.get('c')).toBe('en')
  })

  it('does not carry a language for someone it dropped', () => {
    const { langByUser } = deliverableFrom([p('a'), p('b')], ['b'])
    expect(langByUser.has('b')).toBe(false)
  })

  it('survives an empty candidate list without inventing recipients', () => {
    const { ids, langByUser } = deliverableFrom([], [])
    expect(ids).toEqual([])
    expect(langByUser.size).toBe(0)
  })

  it('counts a user once even if the mute list repeats them', () => {
    expect(deliverableFrom([p('a'), p('b')], ['b', 'b', 'b']).ids).toEqual(['a'])
  })
})
