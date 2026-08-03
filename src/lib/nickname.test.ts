import { describe, it, expect } from 'vitest'
import { validateNickname, NICKNAME_MIN, NICKNAME_MAX } from './nickname'

describe('validateNickname', () => {
  it('accepts a normal name and trims it', () => {
    expect(validateNickname('  Wiktor  ')).toEqual({ ok: true, value: 'Wiktor' })
  })

  it('collapses inner whitespace and line breaks', () => {
    expect(validateNickname('Wiktor   z\nRzeszowa')).toEqual({ ok: true, value: 'Wiktor z Rzeszowa' })
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(validateNickname('')).toEqual({ ok: false, reason: 'empty' })
    expect(validateNickname('   \n ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a name shorter than the minimum', () => {
    expect(validateNickname('W')).toEqual({ ok: false, reason: 'tooShort' })
  })

  it('rejects a name longer than the maximum', () => {
    expect(validateNickname('x'.repeat(NICKNAME_MAX + 1))).toEqual({ ok: false, reason: 'tooLong' })
  })

  it('accepts exactly the boundary lengths', () => {
    expect(validateNickname('x'.repeat(NICKNAME_MIN)).ok).toBe(true)
    expect(validateNickname('x'.repeat(NICKNAME_MAX)).ok).toBe(true)
  })

  it('keeps diacritics and emoji intact', () => {
    expect(validateNickname('Zażółć gęślą')).toEqual({ ok: true, value: 'Zażółć gęślą' })
    expect(validateNickname('meuwe 🐦')).toEqual({ ok: true, value: 'meuwe 🐦' })
  })
})
