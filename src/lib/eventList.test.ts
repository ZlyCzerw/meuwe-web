import { describe, it, expect } from 'vitest'
import { foldForSearch, listEvents, formatDistance } from './eventList'
import type { EventWithMeta } from './types'

function ev(id: string, over: Partial<EventWithMeta> = {}): EventWithMeta {
  return {
    id, title: id, description: null, lat: 50, lng: 22, place_name: null,
    category: 'music', start_time: '2026-09-26T10:00:00Z', end_time: '2026-09-26T12:00:00Z',
    creator_id: null, status: 'upcoming', created_at: '2026-09-01T00:00:00Z',
    photos: null, is_private: false, tags: [], distKm: 0, distStr: '',
    ...over,
  }
}

const me = { lat: 50, lng: 22 }

describe('foldForSearch', () => {
  it('lowercases and drops Polish diacritics, including ł', () => {
    expect(foldForSearch('Łódź Żółć')).toBe('lodz zolc')
  })
})

describe('listEvents', () => {
  it('sorts by distance from the given point, nearest first', () => {
    const far = ev('far', { lat: 50.2 })
    const near = ev('near', { lat: 50.01 })
    const mid = ev('mid', { lat: 50.1 })
    expect(listEvents([far, near, mid], { filters: [], query: '', from: me }).map(e => e.id))
      .toEqual(['near', 'mid', 'far'])
  })

  it('breaks distance ties by start time', () => {
    const late = ev('late', { start_time: '2026-09-26T18:00:00Z' })
    const early = ev('early', { start_time: '2026-09-26T08:00:00Z' })
    expect(listEvents([late, early], { filters: [], query: '', from: me }).map(e => e.id))
      .toEqual(['early', 'late'])
  })

  it('stamps each event with its distance from the point', () => {
    const [e] = listEvents([ev('a', { lat: 50.01, distKm: 99 })], { filters: [], query: '', from: me })
    expect(e.distKm).toBeCloseTo(1.11, 1)
  })

  it('without a point keeps the distance the query computed', () => {
    const a = ev('a', { distKm: 5 })
    const b = ev('b', { distKm: 2 })
    expect(listEvents([a, b], { filters: [], query: '', from: null }).map(e => e.id)).toEqual(['b', 'a'])
  })

  it('matches a filter by category or by tag, like the map does', () => {
    const byCat = ev('cat', { category: 'food' })
    const byTag = ev('tag', { category: 'music', tags: ['food'] })
    const other = ev('other', { category: 'sport' })
    expect(listEvents([byCat, byTag, other], { filters: ['food'], query: '', from: me }).map(e => e.id).sort())
      .toEqual(['cat', 'tag'])
  })

  it('searches title, place and tags regardless of case and diacritics', () => {
    const t = ev('t', { title: 'Festiwal Roślin' })
    const p = ev('p', { place_name: 'Rynek, Rzeszów' })
    const g = ev('g', { tags: ['ogród'] })
    const none = ev('none', { title: 'Koncert' })
    const all = [t, p, g, none]
    expect(listEvents(all, { filters: [], query: 'ROSLIN', from: me }).map(e => e.id)).toEqual(['t'])
    expect(listEvents(all, { filters: [], query: 'rzeszow', from: me }).map(e => e.id)).toEqual(['p'])
    expect(listEvents(all, { filters: [], query: ' ogrod ', from: me }).map(e => e.id)).toEqual(['g'])
  })

  it('requires every word of the query to match somewhere', () => {
    const a = ev('a', { title: 'Warsztaty fotografii', place_name: 'Rynek 26' })
    const b = ev('b', { title: 'Warsztaty filmowe', place_name: 'Paderewskiego' })
    expect(listEvents([a, b], { filters: [], query: 'warsztaty rynek', from: me }).map(e => e.id)).toEqual(['a'])
  })
})

describe('formatDistance', () => {
  it('shows metres under a kilometre and one decimal above', () => {
    expect(formatDistance(0.234, 'pl-PL')).toBe('230 m')
    expect(formatDistance(1.26, 'pl-PL')).toBe('1,3 km')
    expect(formatDistance(1.26, 'en-US')).toBe('1.3 km')
  })
  it('drops the decimal from ten kilometres up', () => {
    expect(formatDistance(12.6, 'pl-PL')).toBe('13 km')
  })
})
