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

import { geoStrategy, MAX_JUMP_KM } from './eventChain'

/** ~1 km na tej szerokości; wystarczy, by punkty były rozróżnialne. */
const KM = 0.014

describe('geoStrategy — the first step on a side', () => {
  it('goes east to the nearest event with a greater longitude', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const nearWest = ev({ id: 'w', lng: 22.0 - KM })
    const farEast = ev({ id: 'far', lng: 22.0 + 4 * KM })
    const nearEast = ev({ id: 'near', lng: 22.0 + 2 * KM })
    const c = step(startChain(a), [a, nearWest, farEast, nearEast], 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('near')
  })

  it('goes west to the nearest event with a smaller longitude', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const nearEast = ev({ id: 'e', lng: 22.0 + KM })
    const nearWest = ev({ id: 'near', lng: 22.0 - 2 * KM })
    const farWest = ev({ id: 'far', lng: 22.0 - 5 * KM })
    const c = step(startChain(a), [a, nearEast, nearWest, farWest], 'west', geoStrategy)!
    expect(currentOf(c).id).toBe('near')
  })

  it('reports the end of the chain when the half plane is empty', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const onlyWest = ev({ id: 'w', lng: 22.0 - KM })
    expect(step(startChain(a), [a, onlyWest], 'east', geoStrategy)).toBeNull()
  })

  // Kotwica siedzi na wschodnim końcu ścieżki dopiero rozciągniętej na zachód,
  // więc pierwszy krok na wschód nadal ma znaczenie kierunkowe.
  it('still applies the half plane to the untouched side', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const w = ev({ id: 'w', lng: 22.0 - KM })
    const e = ev({ id: 'e', lng: 22.0 + KM })
    let c = step(startChain(a), [a, w, e], 'west', geoStrategy)!
    expect(currentOf(c).id).toBe('w')
    c = step(c, [a, w, e], 'east', geoStrategy)!     // wraca do kotwicy
    expect(currentOf(c).id).toBe('a')
    c = step(c, [a, w, e], 'east', geoStrategy)!     // pierwszy krok na wschód
    expect(currentOf(c).id).toBe('e')
  })

  it('exposes the jump ceiling as a constant', () => {
    expect(MAX_JUMP_KM).toBe(50)
  })
})
