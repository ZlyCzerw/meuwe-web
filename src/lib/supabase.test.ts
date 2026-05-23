import { describe, it, expect } from 'vitest'
import { isOnDay } from './supabase'

describe('isOnDay', () => {
  const base = new Date('2026-05-23T12:00:00')
  it('same calendar day → true', () => {
    expect(isOnDay('2026-05-23T20:00:00', base, 0)).toBe(true)
  })
  it('next day with offset 1 → true', () => {
    expect(isOnDay('2026-05-24T08:00:00', base, 1)).toBe(true)
  })
  it('different day → false', () => {
    expect(isOnDay('2026-05-25T08:00:00', base, 1)).toBe(false)
  })
})
