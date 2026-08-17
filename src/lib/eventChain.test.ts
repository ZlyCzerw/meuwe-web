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

describe('geoStrategy — later steps', () => {
  // Po pierwszym kroku sznurek przestaje pytać o kierunek świata: idzie tam,
  // gdzie najbliżej, choćby to było z powrotem na zachód od kotwicy.
  it('drops the half plane once a side has been walked', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const e1 = ev({ id: 'e1', lng: 22.0 + KM })
    // Bliżej e1 niż cokolwiek na wschodzie, ale na zachód od kotwicy — więc
    // pierwszy krok go nie tknął.
    const behind = ev({ id: 'behind', lng: 22.0 - 0.2 * KM })
    const e2 = ev({ id: 'e2', lng: 22.0 + 9 * KM })
    const pool = [a, e1, behind, e2]
    let c = step(startChain(a), pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('e1')
    c = step(c, pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('behind')
  })

  it('never returns to an event already on the path', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const b = ev({ id: 'b', lng: 22.0 + KM })
    const pool = [a, b]
    const c = step(startChain(a), pool, 'east', geoStrategy)!
    expect(step(c, pool, 'east', geoStrategy)).toBeNull()
  })

  // Wydarzenia w jednym lokalu leżą 0 km od siebie, więc wychodzą jako
  // pierwsze — swipe przewija cały lokal, zanim ruszy dalej. To nie jest
  // przypadek szczególny, tylko konsekwencja reguły odległości.
  it('reads through co-located events before moving on', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const same1 = ev({ id: 's1', lng: 22.0 + 1e-7 })
    const same2 = ev({ id: 's2', lng: 22.0 + 2e-7 })
    const away = ev({ id: 'away', lng: 22.0 + 3 * KM })
    const pool = [a, same1, same2, away]
    let c = step(startChain(a), pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('s1')
    c = step(c, pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('s2')
    c = step(c, pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('away')
  })

  it('ends the chain rather than jumping further than the ceiling', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    // ~86 km na wschód przy 50. równoleżniku — ponad MAX_JUMP_KM.
    const far = ev({ id: 'far', lng: 22.0 + 1.2 })
    expect(step(startChain(a), [a, far], 'east', geoStrategy)).toBeNull()
  })

  it('retraces the exact events it walked, in order', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const b = ev({ id: 'b', lng: 22.0 + KM })
    const c2 = ev({ id: 'c', lng: 22.0 + 2 * KM })
    const pool = [a, b, c2]
    let c = step(startChain(a), pool, 'east', geoStrategy)!
    c = step(c, pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('c')
    c = step(c, pool, 'west', geoStrategy)!
    expect(currentOf(c).id).toBe('b')
    c = step(c, pool, 'west', geoStrategy)!
    expect(currentOf(c).id).toBe('a')
  })

  // Otwarte wydarzenie mogło wypaść z filtrów, ale karta zostaje na ekranie —
  // sznurek ma dalej działać, choć kotwicy nie ma już w puli.
  it('still steps from an anchor that has left the pool', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const near = ev({ id: 'near', lng: 22.0 + KM })
    const c = step(startChain(a), [near], 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('near')
  })
})

import { listStrategy } from './eventChain'

describe('listStrategy', () => {
  const a = ev({ id: 'a' }), b = ev({ id: 'b' }), c3 = ev({ id: 'c' })
  const pool = [a, b, c3]

  it('moves to the next row', () => {
    const c = step(startChain(b), pool, 'east', listStrategy)!
    expect(currentOf(c).id).toBe('c')
  })

  it('moves to the previous row', () => {
    const c = step(startChain(b), pool, 'west', listStrategy)!
    expect(currentOf(c).id).toBe('a')
  })

  it('stops at both ends of the list', () => {
    expect(step(startChain(c3), pool, 'east', listStrategy)).toBeNull()
    expect(step(startChain(a), pool, 'west', listStrategy)).toBeNull()
  })

  // Lista może się odświeżyć pod otwartą kartą; wtedy lepiej zatrzymać sznurek
  // niż zaprowadzić go tam, gdzie już był.
  it('stops rather than revisiting', () => {
    const c = step(startChain(a), pool, 'east', listStrategy)!
    expect(step(c, [a, b, a], 'east', listStrategy)).toBeNull()
  })

  it('stops when the current event has left the list', () => {
    expect(step(startChain(ev({ id: 'gone' })), pool, 'east', listStrategy)).toBeNull()
  })
})
