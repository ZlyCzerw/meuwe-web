import { describe, it, expect } from 'vitest'
import { startChain, step, currentOf, type Chain, type ChainStrategy } from './eventChain'
import type { EventWithMeta } from './types'

let idc = 0
function ev(over: Partial<EventWithMeta> = {}): EventWithMeta {
  return {
    id: `e${idc++}`,
    lat: 50.0, lng: 22.0,
    start_time: '2026-08-17T10:00:00.000Z',
    end_time: '2026-08-17T12:00:00.000Z',
    is_private: false,
    ...over,
  } as EventWithMeta
}

/** Strategia-atrapa: zawsze podaje kolejne wydarzenie z podanej kolejki. */
function queueStrategy(east: EventWithMeta[], west: EventWithMeta[]): ChainStrategy {
  const q = { east: [...east], west: [...west] }
  return { extend: (_c, _pool, dir) => q[dir].shift() ?? null }
}

describe('step', () => {
  it('starts with the anchor alone', () => {
    const a = ev({ id: 'a' })
    const c = startChain(a)
    expect(c.path.map(e => e.id)).toEqual(['a'])
    expect(c.cursor).toBe(0)
    expect(c.anchorIdx).toBe(0)
    expect(currentOf(c).id).toBe('a')
  })

  it('appends eastward and moves the cursor with it', () => {
    const s = queueStrategy([ev({ id: 'b' }), ev({ id: 'c' })], [])
    let c: Chain = startChain(ev({ id: 'a' }))
    c = step(c, [], 'east', s)!
    c = step(c, [], 'east', s)!
    expect(c.path.map(e => e.id)).toEqual(['a', 'b', 'c'])
    expect(currentOf(c).id).toBe('c')
    expect(c.anchorIdx).toBe(0)
  })

  it('walks back over ground already covered without asking the strategy', () => {
    const s = queueStrategy([ev({ id: 'b' })], [])
    let c: Chain = startChain(ev({ id: 'a' }))
    c = step(c, [], 'east', s)!
    c = step(c, [], 'west', s)!
    expect(currentOf(c).id).toBe('a')
    expect(c.path.map(e => e.id)).toEqual(['a', 'b'])
    // Powrót na wschód wraca do b, nie dokleja nowego — kolejka jest pusta,
    // a mimo to krok się udaje.
    c = step(c, [], 'east', s)!
    expect(currentOf(c).id).toBe('b')
  })

  it('prepends westward and carries the anchor index with it', () => {
    const s = queueStrategy([], [ev({ id: 'z' })])
    let c: Chain = startChain(ev({ id: 'a' }))
    c = step(c, [], 'west', s)!
    expect(c.path.map(e => e.id)).toEqual(['z', 'a'])
    expect(c.cursor).toBe(0)
    expect(c.anchorIdx).toBe(1)
  })

  it('returns null when the strategy has nothing left', () => {
    const s = queueStrategy([], [])
    const c = startChain(ev({ id: 'a' }))
    expect(step(c, [], 'east', s)).toBeNull()
    expect(step(c, [], 'west', s)).toBeNull()
  })
})
