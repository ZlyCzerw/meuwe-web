import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEventChain } from './useEventChain'
import { geoStrategy } from '../lib/eventChain'
import type { EventWithMeta } from '../lib/types'

let idc = 0
function ev(over: Partial<EventWithMeta> = {}): EventWithMeta {
  return {
    id: `e${idc++}`, lat: 50.0, lng: 22.0,
    start_time: '2026-08-17T10:00:00.000Z',
    end_time: '2026-08-17T12:00:00.000Z',
    is_private: false, ...over,
  } as EventWithMeta
}

const a = ev({ id: 'a', lng: 22.0 })
const b = ev({ id: 'b', lng: 22.014 })
const c = ev({ id: 'c', lng: 22.028 })
const POOL = [a, b, c]

describe('useEventChain', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useEventChain(POOL, geoStrategy, 'k'))
    expect(result.current.current).toBeNull()
    expect(result.current.canGo('east')).toBe(false)
  })

  // Wynik zbieramy do pola obiektu, a nie do `let`: TypeScript zawęża zmienną
  // do typu wartości początkowej i nie widzi przypisania z wnętrza act().
  it('walks and reports where it landed', () => {
    const { result } = renderHook(() => useEventChain(POOL, geoStrategy, 'k'))
    act(() => { result.current.start(a) })
    expect(result.current.current?.id).toBe('a')
    const got: { at: EventWithMeta | null } = { at: null }
    act(() => { got.at = result.current.go('east') })
    expect(got.at?.id).toBe('b')
    expect(result.current.current?.id).toBe('b')
  })

  it('returns null and stays put at the end of the chain', () => {
    const { result } = renderHook(() => useEventChain([a], geoStrategy, 'k'))
    act(() => { result.current.start(a) })
    const got: { at: EventWithMeta | null } = { at: a }
    act(() => { got.at = result.current.go('east') })
    expect(got.at).toBeNull()
    expect(result.current.current?.id).toBe('a')
  })

  it('forgets everything when the card closes', () => {
    const { result } = renderHook(() => useEventChain(POOL, geoStrategy, 'k'))
    act(() => { result.current.start(a) })
    act(() => { result.current.close() })
    expect(result.current.current).toBeNull()
  })

  it('swaps the current event in place without disturbing the path', () => {
    const { result } = renderHook(() => useEventChain(POOL, geoStrategy, 'k'))
    act(() => { result.current.start(a) })
    act(() => { result.current.go('east') })
    act(() => { result.current.replace({ ...b, title: 'Zmieniony' } as EventWithMeta) })
    expect(result.current.current?.title).toBe('Zmieniony')
    // Ścieżka stoi: powrót nadal trafia w kotwicę.
    act(() => { result.current.go('west') })
    expect(result.current.current?.id).toBe('a')
  })

  // Zmiana filtrów albo dnia wymienia pulę pod sznurkiem. Karta zostaje na
  // ekranie, ale historia odwiedzonych traci sens.
  it('collapses to the open event when the pool is replaced', () => {
    const { result, rerender } = renderHook(
      ({ key }) => useEventChain(POOL, geoStrategy, key),
      { initialProps: { key: 'filters:|day:1' } },
    )
    act(() => { result.current.start(a) })
    act(() => { result.current.go('east') })
    expect(result.current.current?.id).toBe('b')

    rerender({ key: 'filters:party|day:1' })
    expect(result.current.current?.id).toBe('b')   // karta nie mruga
    // b jest nową kotwicą, więc zachód znowu znaczy kierunek świata: a leży
    // na zachód od b i jest jedynym kandydatem.
    act(() => { result.current.go('west') })
    expect(result.current.current?.id).toBe('a')
  })

  it('leaves a closed chain closed when the pool changes', () => {
    const { result, rerender } = renderHook(
      ({ key }) => useEventChain(POOL, geoStrategy, key),
      { initialProps: { key: 'k1' } },
    )
    rerender({ key: 'k2' })
    expect(result.current.current).toBeNull()
  })
})
