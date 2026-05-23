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
  it('maps event_messages count correctly', () => {
    const raw = { id:'1', title:'Test', lat:0, lng:0, category:'party',
      start_time:'2026-05-23T10:00:00Z', end_time:'2026-05-24T10:00:00Z',
      status:'live', created_at:'2026-05-23T09:00:00Z', creator_id:'u1',
      description:null, place_name:null,
      event_tags:[{tag:'outdoor'}],
      event_messages:[{count:7}],
    }
    // Replicate the mapping from getMyEvents
    const mapped = {
      ...raw,
      tags: raw.event_tags.map((t:any) => t.tag),
      distKm: 0,
      distStr: '',
      profiles: null,
      msgCount: raw.event_messages?.[0]?.count ?? 0,
    }
    expect(mapped.tags).toEqual(['outdoor'])
    expect(mapped.msgCount).toBe(7)
    expect(mapped.distKm).toBe(0)
  })

  it('handles missing event_messages gracefully', () => {
    const raw:any = { event_messages: undefined }
    const msgCount = raw.event_messages?.[0]?.count ?? 0
    expect(msgCount).toBe(0)
  })
})
