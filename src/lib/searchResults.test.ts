// src/lib/searchResults.test.ts
import { describe, it, expect } from 'vitest'
import { mergeSearchResults, sortEventHits, sanitizeSearchQuery, type EventHit } from './searchResults'
import type { PlaceResult } from './placeSearch'

function place(name: string): PlaceResult {
  return { id: `p-${name}`, primary: name, secondary: '', lat: 0, lng: 0 }
}
function hit(id: string, lat = 0, lng = 0): EventHit {
  return { id, title: `E ${id}`, category: 'party', place_name: null, start_time: '2026-09-10T18:00:00Z', lat, lng }
}

describe('mergeSearchResults', () => {
  it('lists places first, then events, three of each', () => {
    const out = mergeSearchResults(
      [place('a'), place('b'), place('c'), place('d'), place('e')],
      [hit('1'), hit('2'), hit('3'), hit('4'), hit('5')],
    )
    expect(out.map(r => r.kind)).toEqual(['place', 'place', 'place', 'event', 'event', 'event'])
    expect(out.filter(r => r.kind === 'place').map(r => r.place.primary)).toEqual(['a', 'b', 'c'])
    expect(out.filter(r => r.kind === 'event').map(r => r.event.id)).toEqual(['1', '2', '3'])
  })
  it('lets places grow to five when there are no events', () => {
    const out = mergeSearchResults([place('a'), place('b'), place('c'), place('d'), place('e'), place('f')], [])
    expect(out).toHaveLength(5)
    expect(out.every(r => r.kind === 'place')).toBe(true)
  })
  it('lets events grow to five when there are no places', () => {
    const out = mergeSearchResults([], [hit('1'), hit('2'), hit('3'), hit('4'), hit('5'), hit('6')])
    expect(out).toHaveLength(5)
    expect(out.every(r => r.kind === 'event')).toBe(true)
  })
  it('does not pad one group with the other group\'s leftover slots', () => {
    const out = mergeSearchResults([place('a')], [hit('1'), hit('2'), hit('3'), hit('4')])
    expect(out.map(r => r.kind)).toEqual(['place', 'event', 'event', 'event'])
  })
})

describe('sortEventHits', () => {
  it('sorts by distance from `near`', () => {
    const near = { lat: 50, lng: 22 }
    const out = sortEventHits([hit('far', 52, 22), hit('close', 50.1, 22), hit('mid', 51, 22)], near)
    expect(out.map(h => h.id)).toEqual(['close', 'mid', 'far'])
  })
  it('keeps the incoming order without `near`', () => {
    const out = sortEventHits([hit('far', 52, 22), hit('close', 50.1, 22)], null)
    expect(out.map(h => h.id)).toEqual(['far', 'close'])
  })
})

describe('sanitizeSearchQuery', () => {
  it('strips pattern and filter-syntax characters and trims', () => {
    expect(sanitizeSearchQuery('  fest%_iw(al),x  ')).toBe('festiwalx')
  })
  it('leaves letters with diacritics alone', () => {
    expect(sanitizeSearchQuery('Zażółć gęślą')).toBe('Zażółć gęślą')
  })
})
