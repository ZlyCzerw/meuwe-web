import { describe, it, expect } from 'vitest'
import { mergeEvents } from './eventCache'
import type { EventWithMeta } from './types'
import type { FetchView } from './mapView'

const BOX: FetchView = { lat: 52, lng: 21, km: 4 }
// The box reaches ~0.036 deg in latitude and ~0.059 in longitude from (52, 21).
const ev = (id: string, lat: number, lng: number) => ({ id, lat, lng } as EventWithMeta)
const inside = (id: string) => ev(id, 52.01, 21.01)
const outside = (id: string) => ev(id, 52.5, 21)
const ids = (evs: EventWithMeta[]) => evs.map(e => e.id).sort()

describe('mergeEvents', () => {
  it('lets the answer speak for its own box', () => {
    // 'gone' ended or was deleted; the answer for the box it sits in is the
    // only thing that can say so.
    const cache = [inside('gone'), inside('still')]
    const merged = mergeEvents(cache, [inside('still')], BOX, 100)
    expect(ids(merged)).toEqual(['still'])
  })

  it('keeps what the answer says nothing about', () => {
    const cache = [outside('elsewhere')]
    const merged = mergeEvents(cache, [inside('here')], BOX, 100)
    expect(ids(merged)).toEqual(['elsewhere', 'here'])
  })

  it('leaves no ghost behind an event that moved out of the box', () => {
    const merged = mergeEvents([inside('moved')], [], BOX, 100)
    expect(merged).toEqual([])
  })

  it('shows an event that moved into the box once, at its new place', () => {
    // The cached copy is outside, so the box rule does not reach it; only
    // keying by id keeps it from appearing twice.
    const merged = mergeEvents([outside('moved')], [inside('moved')], BOX, 100)
    expect(merged).toHaveLength(1)
    expect(merged[0].lat).toBe(52.01)
  })

  it('empties the box it was asked about and nothing else', () => {
    const cache = [inside('a'), inside('b'), outside('far')]
    const merged = mergeEvents(cache, [], BOX, 100)
    expect(ids(merged)).toEqual(['far'])
  })

  it('evicts the furthest carry-over and never anything on screen', () => {
    const cache = [
      ev('near', 52.1, 21),
      ev('mid', 52.4, 21),
      ev('far', 53.5, 21),
    ]
    const merged = mergeEvents(cache, [inside('visible')], BOX, 2)
    expect(ids(merged)).toEqual(['mid', 'near', 'visible'])
  })

  it('counts only carry-over against the watermark', () => {
    // Ten events in the box plus one outside it, with room for one outside:
    // the box keeps all ten.
    const answer = Array.from({ length: 10 }, (_, i) => inside(`in${i}`))
    const merged = mergeEvents([outside('keep')], answer, BOX, 1)
    expect(merged).toHaveLength(11)
  })
})
