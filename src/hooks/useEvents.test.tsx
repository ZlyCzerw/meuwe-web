import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEvents } from './useEvents'
import type { EventWithMeta } from '../lib/types'
import type { FetchView } from '../lib/mapView'

// Only the data boundary is faked; the hook's loading/staleness judgement runs
// for real. Each getEvents call gets a manually resolvable promise so tests can
// land answers out of order, the way slow networks actually do.
const getEvents = vi.fn<() => Promise<EventWithMeta[] | null>>()

vi.mock('../lib/supabase', () => ({
  db: {
    getEvents: (...args: unknown[]) => getEvents(...(args as [])),
    subscribeEvents: () => ({}),
    unsub: () => {},
  },
}))

function pendingEvents() {
  let resolve!: (evs: EventWithMeta[] | null) => void
  const promise = new Promise<EventWithMeta[] | null>(r => { resolve = r })
  return { promise, resolve }
}

const ev = (id: string, lat: number, lng: number) => ({ id, lat, lng } as EventWithMeta)
// Two views far enough apart that neither one's events fall in the other's box.
const HERE: FetchView = { lat: 50.0, lng: 22.0, km: 4 }
const THERE: FetchView = { lat: 50.5, lng: 22.0, km: 4 }
const here = (id: string) => ev(id, 50.0, 22.0)
const there = (id: string) => ev(id, 50.5, 22.0)
const ids = (evs: EventWithMeta[]) => evs.map(e => e.id).sort()

beforeEach(() => {
  getEvents.mockReset()
})

describe('useEvents', () => {
  it('asks nothing until the map knows what it is showing', async () => {
    const answer = pendingEvents()
    getEvents.mockReturnValue(answer.promise)

    const { result, rerender } = renderHook(
      ({ view }: { view: FetchView | null }) => useEvents(view, 0, 0),
      { initialProps: { view: null as FetchView | null } },
    )
    expect(getEvents).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    expect(result.current.ready).toBe(false)

    rerender({ view: HERE })
    expect(getEvents).toHaveBeenCalledTimes(1)
    expect(getEvents).toHaveBeenCalledWith(HERE.lat, HERE.lng, HERE.km, 0, 0)

    await act(async () => { answer.resolve([here('near')]) })
    expect(result.current.loading).toBe(false)
    expect(result.current.ready).toBe(true)
  })

  it('reports loading again while a changed view is still being answered', async () => {
    const first = pendingEvents()
    const second = pendingEvents()
    getEvents.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = renderHook(
      ({ view }) => useEvents(view, 0, 0),
      { initialProps: { view: HERE } },
    )
    expect(result.current.loading).toBe(true)

    await act(async () => { first.resolve([]) })
    expect(result.current.loading).toBe(false)

    // The view widened: the narrow answer must not stand in for the wide one.
    rerender({ view: { ...HERE, km: 50 } })
    expect(result.current.loading).toBe(true)
    // The splash is a cold-start screen, not a pan screen — once this hook has
    // answered anything at all it stays ready.
    expect(result.current.ready).toBe(true)

    await act(async () => { second.resolve([there('far')]) })
    expect(result.current.loading).toBe(false)
    expect(ids(result.current.events)).toEqual(['far'])
  })

  it('drops an answer that arrives after the question changed', async () => {
    const narrow = pendingEvents()
    const wide = pendingEvents()
    getEvents.mockReturnValueOnce(narrow.promise).mockReturnValueOnce(wide.promise)

    const { result, rerender } = renderHook(
      ({ view }) => useEvents(view, 0, 0),
      { initialProps: { view: HERE } },
    )
    rerender({ view: { ...HERE, km: 50 } })

    await act(async () => { wide.resolve([there('far')]) })
    await waitFor(() => expect(ids(result.current.events)).toEqual(['far']))

    // The slow narrow answer lands last; it must not overwrite the wide one.
    await act(async () => { narrow.resolve([]) })
    expect(ids(result.current.events)).toEqual(['far'])
    expect(result.current.loading).toBe(false)
  })

  it('adds the new view to the one the map came from', async () => {
    const first = pendingEvents()
    const second = pendingEvents()
    getEvents.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = renderHook(
      ({ view }) => useEvents(view, 0, 0),
      { initialProps: { view: HERE } },
    )
    await act(async () => { first.resolve([here('near')]) })
    rerender({ view: THERE })
    // The pins from the view just left are still on the map while the next
    // answer is in the air — that is the whole point.
    expect(ids(result.current.events)).toEqual(['near'])

    await act(async () => { second.resolve([there('far')]) })
    expect(ids(result.current.events)).toEqual(['far', 'near'])
  })

  it('empties the map the moment the day changes, before any answer', async () => {
    const first = pendingEvents()
    getEvents.mockReturnValueOnce(first.promise).mockReturnValue(pendingEvents().promise)

    const { result, rerender } = renderHook(
      ({ day }) => useEvents(HERE, day, 0),
      { initialProps: { day: 0 } },
    )
    await act(async () => { first.resolve([here('today')]) })
    expect(ids(result.current.events)).toEqual(['today'])

    rerender({ day: 1 })
    expect(result.current.events).toEqual([])
    // Nothing has been asked about tomorrow yet, so nothing may be claimed
    // about it either.
    expect(result.current.loading).toBe(true)
  })

  it('keeps the pins when a query fails', async () => {
    const first = pendingEvents()
    const failed = pendingEvents()
    getEvents.mockReturnValueOnce(first.promise).mockReturnValueOnce(failed.promise)

    const { result, rerender } = renderHook(
      ({ key }) => useEvents(HERE, 0, 0, key),
      { initialProps: { key: 0 } },
    )
    await act(async () => { first.resolve([here('near')]) })

    rerender({ key: 1 })
    await act(async () => { failed.resolve(null) })
    // A request that failed said nothing about what is out there.
    expect(ids(result.current.events)).toEqual(['near'])
    // ...but it is no longer in flight, so the map must stop saying it is.
    expect(result.current.loading).toBe(false)
  })
})

describe('zakres dni', () => {
  it('rozszerzenie zakresu czyści piny i pyta o nową parę offsetów', async () => {
    const first = pendingEvents()
    getEvents.mockReturnValueOnce(first.promise)
    const { result, rerender } = renderHook(
      ({ end }) => useEvents(HERE, 0, end),
      { initialProps: { end: 0 } },
    )
    await act(async () => { first.resolve([here('a')]) })
    await waitFor(() => expect(result.current.events).toHaveLength(1))

    const second = pendingEvents()
    getEvents.mockReturnValueOnce(second.promise)
    rerender({ end: 3 })

    // Piny znikają w tym samym renderze, w którym zmienia się pytanie — bez
    // tego jedna klatka pokazywałaby wydarzenia spoza nowego zakresu.
    expect(result.current.events).toHaveLength(0)
    expect(result.current.loading).toBe(true)
    expect(getEvents).toHaveBeenLastCalledWith(HERE.lat, HERE.lng, HERE.km, 0, 3)

    await act(async () => { second.resolve([here('a'), here('b')]) })
    await waitFor(() => expect(result.current.events).toHaveLength(2))
    expect(result.current.loading).toBe(false)
  })
})
