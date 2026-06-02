import { describe, it, expect } from 'vitest'
import { applyIncomingMessage, type UnreadState } from './unread'

const ctx = (open: string | null = null) => ({
  me: 'me',
  followedIds: new Set(['f1', 'own1']),
  ownedIds: new Set(['own1']),
  openEventId: open,
})
const msg = (event_id: string, author_id: string | null) => ({ event_id, author_id })

describe('applyIncomingMessage', () => {
  it('adds a dot for someone else\'s message in a followed event', () => {
    const next = applyIncomingMessage({}, msg('f1', 'other'), ctx())
    expect(next).toEqual({ f1: { isOwner: false } })
  })
  it('marks isOwner true when the event is owned', () => {
    const next = applyIncomingMessage({}, msg('own1', 'other'), ctx())
    expect(next).toEqual({ own1: { isOwner: true } })
  })
  it('ignores my own message', () => {
    expect(applyIncomingMessage({}, msg('f1', 'me'), ctx())).toEqual({})
  })
  it('ignores events I do not follow', () => {
    expect(applyIncomingMessage({}, msg('x9', 'other'), ctx())).toEqual({})
  })
  it('ignores the currently open event', () => {
    expect(applyIncomingMessage({}, msg('f1', 'other'), ctx('f1'))).toEqual({})
  })
  it('is a no-op when already unread (returns same reference)', () => {
    const state: UnreadState = { f1: { isOwner: false } }
    expect(applyIncomingMessage(state, msg('f1', 'other'), ctx())).toBe(state)
  })
  it('ignores messages with no author', () => {
    expect(applyIncomingMessage({}, msg('f1', null), ctx())).toEqual({})
  })
})
