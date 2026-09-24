import { describe, it, expect } from 'vitest'
import { pinsToMount, planMount } from './pinCulling'

const B = { south: 50, west: 20, north: 51, east: 21 }

describe('pinsToMount', () => {
  it('keeps points inside the bounds, edges included, drops the rest', () => {
    const got = pinsToMount({
      in: { lat: 50.5, lng: 20.5 },
      edge: { lat: 51, lng: 20 },
      north: { lat: 51.01, lng: 20.5 },
      east: { lat: 50.5, lng: 21.2 },
    }, B)
    expect([...got].sort()).toEqual(['edge', 'in'])
  })

  it('empty input -> empty set', () => {
    expect(pinsToMount({}, B).size).toBe(0)
  })
})

describe('planMount', () => {
  const pins = { a: { mounted: true }, b: { mounted: false }, c: { mounted: true } }

  it('adds wanted-but-unmounted, removes mounted-but-unwanted', () => {
    expect(planMount(pins, new Set(['a', 'b']), false)).toEqual({ add: ['b'], remove: ['c'] })
  })

  it('addOnly never removes (used while the map is moving)', () => {
    expect(planMount(pins, new Set(['b']), true)).toEqual({ add: ['b'], remove: [] })
  })

  it('nothing to do when mounted matches wanted', () => {
    expect(planMount(pins, new Set(['a', 'c']), false)).toEqual({ add: [], remove: [] })
  })
})
