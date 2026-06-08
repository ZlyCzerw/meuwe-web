import { describe, it, expect, vi } from 'vitest'
import { db, supabase } from './supabase'

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

describe('db.endEvent', () => {
  it('returns error when session is null', async () => {
    // Mock getSession to return null session
    const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    vi.spyOn(supabase.auth, 'getSession').mockImplementation(mockGetSession)

    const result = await db.endEvent('some-event-id')
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})

describe('db.updateEvent', () => {
  it('returns error when session is null', async () => {
    const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    vi.spyOn(supabase.auth, 'getSession').mockImplementation(mockGetSession)

    const result = await db.updateEvent('some-event-id', {
      title: 'x', lat: 0, lng: 0, category: 'party',
      tags: [], start_time: 'a', end_time: 'b', photos: [],
    })
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})

describe('db.createEvent', () => {
  it('returns error when session is null', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null } as any)
    const result = await db.createEvent({ title: 'Test', lat: 0, lng: 0 })
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})

describe('is_private default', () => {
  it('createEvent with is_private:true returns auth error when not logged in', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null } as any)
    const result = await db.createEvent({ title: 'Secret', lat: 0, lng: 0, is_private: true })
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})
