import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEvents } from './useEvents'
import type { EventWithMeta } from '../lib/types'

// Only the data boundary is faked; the hook's loading/staleness judgement runs
// for real. Each getEvents call gets a manually resolvable promise so tests can
// land answers out of order, the way slow networks actually do.
const getEvents = vi.fn<() => Promise<EventWithMeta[]>>()

vi.mock('../lib/supabase', () => ({
  db: {
    getEvents: (...args: unknown[]) => getEvents(...(args as [])),
    subscribeEvents: () => ({}),
    unsub: () => {},
  },
}))

function pendingEvents() {
  let resolve!: (evs: EventWithMeta[]) => void
  const promise = new Promise<EventWithMeta[]>(r => { resolve = r })
  return { promise, resolve }
}

const ev = (id: string) => ({ id } as EventWithMeta)
const POS = { lat: 50.0, lng: 22.0 }

beforeEach(() => {
  getEvents.mockReset()
})

describe('useEvents', () => {
  it('asks nothing until the map knows how far it is showing', async () => {
    const answer = pendingEvents()
    getEvents.mockReturnValue(answer.promise)

    const { result, rerender } = renderHook(
      ({ km }: { km: number | null }) => useEvents(POS, 0, 0, km),
      { initialProps: { km: null as number | null } },
    )
    expect(getEvents).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)

    rerender({ km: 50 })
    expect(getEvents).toHaveBeenCalledTimes(1)
    expect(getEvents).toHaveBeenCalledWith(POS.lat, POS.lng, 50, 0)

    await act(async () => { answer.resolve([ev('near')]) })
    expect(result.current.loading).toBe(false)
  })

  it('reports loading again while a changed radius is still being answered', async () => {
    const first = pendingEvents()
    const second = pendingEvents()
    getEvents.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = renderHook(
      ({ km }) => useEvents(POS, 0, 0, km),
      { initialProps: { km: 15 } },
    )
    expect(result.current.loading).toBe(true)

    await act(async () => { first.resolve([]) })
    expect(result.current.loading).toBe(false)

    // The view widened: the 15 km answer must not stand in for the 50 km one.
    rerender({ km: 50 })
    expect(result.current.loading).toBe(true)

    await act(async () => { second.resolve([ev('far')]) })
    expect(result.current.loading).toBe(false)
    expect(result.current.events.map(e => e.id)).toEqual(['far'])
  })

  it('drops an answer that arrives after the question changed', async () => {
    const narrow = pendingEvents()
    const wide = pendingEvents()
    getEvents.mockReturnValueOnce(narrow.promise).mockReturnValueOnce(wide.promise)

    const { result, rerender } = renderHook(
      ({ km }) => useEvents(POS, 0, 0, km),
      { initialProps: { km: 15 } },
    )
    rerender({ km: 50 })

    await act(async () => { wide.resolve([ev('far')]) })
    await waitFor(() => expect(result.current.events.map(e => e.id)).toEqual(['far']))

    // The slow 15 km answer lands last; it must not overwrite the 50 km one.
    await act(async () => { narrow.resolve([]) })
    expect(result.current.events.map(e => e.id)).toEqual(['far'])
    expect(result.current.loading).toBe(false)
  })
})
