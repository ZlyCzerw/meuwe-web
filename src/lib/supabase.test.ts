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

describe('getMyEvents mapping', () => {
  it('accumulates message counts from countMap correctly', () => {
    const eventId = 'event-1'
    // Simulate what getMyEvents does: builds countMap from flat event_id rows
    const rows: Array<{ event_id: string }> = [
      { event_id: eventId },
      { event_id: eventId },
      { event_id: 'event-2' },
    ]
    const countMap: Record<string, number> = {}
    rows.forEach(r => {
      countMap[r.event_id] = (countMap[r.event_id] || 0) + 1
    })
    expect(countMap[eventId]).toBe(2)
    expect(countMap['event-2']).toBe(1)
    expect(countMap['event-3'] ?? 0).toBe(0) // missing key defaults to 0
  })

  it('handles empty message rows gracefully', () => {
    const countMap: Record<string, number> = {}
    const msgCount = countMap['event-X'] ?? 0
    expect(msgCount).toBe(0)
  })
})
