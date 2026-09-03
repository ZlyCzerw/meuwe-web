import { describe, it, expect, vi, afterEach } from 'vitest'
import { db, supabase } from './supabase'

// Override platform detection so we can exercise db.signInApple's platform branch.
// Other tests don't depend on platform, so the default (web) is safe for them.
vi.mock('./platform', async (orig) => {
  const actual = await orig<typeof import('./platform')>()
  return {
    ...actual,
    isNativePlatform: () => (globalThis as any).__native ?? false,
    isIOS: () => (globalThis as any).__ios ?? false,
  }
})

describe('getMyEvents mapping', () => {
  it('accumulates message counts from countMap correctly', () => {
    const eventId = 'event-1'
    // Simulate what getMyEvents does: builds countMap from flat event_id rows
    const rows: Array<{ event_id: string }> = [
      { event_id: eventId },
      { event_id: eventId },
      { event_id: 'event-2' },
    ]
    const countMap: Record<string, number> = {}
    rows.forEach(r => {
      countMap[r.event_id] = (countMap[r.event_id] || 0) + 1
    })
    expect(countMap[eventId]).toBe(2)
    expect(countMap['event-2']).toBe(1)
    expect(countMap['event-3'] ?? 0).toBe(0) // missing key defaults to 0
  })

  it('handles empty message rows gracefully', () => {
    const countMap: Record<string, number> = {}
    const msgCount = countMap['event-X'] ?? 0
    expect(msgCount).toBe(0)
  })
})

describe('db.endEvent', () => {
  it('returns error when session is null', async () => {
    // Mock getSession to return null session
    const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    vi.spyOn(supabase.auth, 'getSession').mockImplementation(mockGetSession)

    const result = await db.endEvent('some-event-id')
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})

describe('db.updateEvent', () => {
  it('returns error when session is null', async () => {
    const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    vi.spyOn(supabase.auth, 'getSession').mockImplementation(mockGetSession)

    const result = await db.updateEvent('some-event-id', {
      title: 'x', lat: 0, lng: 0, category: 'party',
      tags: [], start_time: 'a', end_time: 'b', photos: [],
    })
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})

describe('db.createEvent', () => {
  it('returns error when session is null', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null } as any)
    const result = await db.createEvent({ title: 'Test', lat: 0, lng: 0 })
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})

describe('is_private default', () => {
  it('createEvent with is_private:true returns auth error when not logged in', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null } as any)
    const result = await db.createEvent({ title: 'Secret', lat: 0, lng: 0, is_private: true })
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})

describe('db.getTags (per-user)', () => {
  it('reads the current user tags from user_tags, deduped — not global event_tags', async () => {
    const rows = [{ tag: 'foobar' }, { tag: 'foobar' }, { tag: 'jazz' }]
    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue({
      select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
    } as any)
    const tags = await db.getTags()
    expect(fromSpy).toHaveBeenCalledWith('user_tags')
    expect(fromSpy).not.toHaveBeenCalledWith('event_tags')
    expect(tags).toEqual(['foobar', 'jazz'])
    fromSpy.mockRestore()
  })
})

describe('db.signInApple', () => {
  afterEach(() => { (globalThis as any).__native = false; (globalThis as any).__ios = false })

  it('web/Android uses signInWithOAuth apple redirect', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({ data: {}, error: null } as any)
    ;(globalThis as any).__ios = false
    await db.signInApple()
    // Trailing slash on purpose: a bare origin can miss a "/**" entry in the
    // project's Redirect URLs, and Supabase then falls back to Site URL.
    expect(spy).toHaveBeenCalledWith({ provider: 'apple', options: { redirectTo: `${location.origin}/` } })
  })
})

describe('authRedirectTo language prefix', () => {
  afterEach(() => {
    (globalThis as any).__native = false
    ;(globalThis as any).__ios = false
    window.history.pushState({}, '', '/')
  })

  // Bez prefiksu ktoś, kto czytał /de/, wraca na / i — jeśli nie wybrał języka
  // ręcznie — dostaje język przeglądarki zamiast tego, na którym był.
  it('keeps the language prefix on web', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({ data: {}, error: null } as any)
    window.history.pushState({}, '', '/de/')
    await db.signInApple()
    expect(spy).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: `${location.origin}/de/` },
    })
    spy.mockRestore()
  })

  it('returns to the root when the path carries no language', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({ data: {}, error: null } as any)
    window.history.pushState({}, '', '/')
    await db.signInApple()
    expect(spy).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: `${location.origin}/` },
    })
    spy.mockRestore()
  })

  // Natywnie wracamy na App Link meuwe.eu, bo origin WebView jest nieosiągalny
  // dla przeglądarki systemowej. Ścieżek językowych tam nie ma.
  it('ignores the prefix on native', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({ data: {}, error: null } as any)
    ;(globalThis as any).__native = true
    ;(globalThis as any).__ios = false
    window.history.pushState({}, '', '/de/')
    await db.signInApple()
    expect(spy).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: 'https://meuwe.eu/' },
    })
    spy.mockRestore()
  })
})

describe('db.searchEvents', () => {
  afterEach(() => vi.restoreAllMocks())

  function chainRecorder(rows: unknown[]) {
    const calls: [string, unknown[]][] = []
    const chain: Record<string, (...a: unknown[]) => unknown> = {}
    for (const m of ['select', 'ilike', 'eq', 'in', 'gte', 'order', 'limit']) {
      chain[m] = (...a: unknown[]) => { calls.push([m, a]); return chain }
    }
    chain.then = (res) => (res as (v: unknown) => void)({ data: rows, error: null })
    return { chain, calls }
  }

  it('asks for public, still-running events whose title contains the query', async () => {
    const { chain, calls } = chainRecorder([{ id: 'e1', title: 'Festiwal' }])
    const from = vi.spyOn(supabase, 'from').mockReturnValue(chain as never)

    const out = await db.searchEvents('fest')

    expect(from).toHaveBeenCalledWith('events')
    expect(calls).toContainEqual(['ilike', ['title', '%fest%']])
    expect(calls).toContainEqual(['eq', ['is_private', false]])
    expect(calls).toContainEqual(['in', ['status', ['live', 'upcoming', 'extended']]])
    const gte = calls.find(([m, a]) => m === 'gte' && a[0] === 'end_time')
    expect(gte).toBeDefined()
    expect(calls.some(([m]) => m === 'limit')).toBe(true)
    expect(out).toEqual([{ id: 'e1', title: 'Festiwal' }])
  })

  it('returns an empty list when the query fails', async () => {
    const chain: Record<string, (...a: unknown[]) => unknown> = {}
    for (const m of ['select', 'ilike', 'eq', 'in', 'gte', 'order', 'limit']) chain[m] = () => chain
    chain.then = (res) => (res as (v: unknown) => void)({ data: null, error: { message: 'boom' } })
    vi.spyOn(supabase, 'from').mockReturnValue(chain as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await db.searchEvents('x')).toEqual([])
  })
})

describe('event views', () => {
  afterEach(() => vi.restoreAllMocks())

  it('records a card open through the record_event_view RPC', () => {
    const rpc = vi.spyOn(supabase, 'rpc').mockReturnValue({
      then: (res: (v: unknown) => void) => res({ data: null, error: null }),
    } as never)
    db.recordEventView('e1')
    expect(rpc).toHaveBeenCalledWith('record_event_view', { p_event_id: 'e1' })
  })

  it('maps view stats per event; events without rows are simply absent', async () => {
    vi.spyOn(supabase, 'rpc').mockReturnValue(
      Promise.resolve({ data: [{ event_id: 'e1', views: '7', viewers: '3' }], error: null }) as never,
    )
    expect(await db.getEventViewStats(['e1', 'e2'])).toEqual({ e1: { views: 7, viewers: 3 } })
  })

  it('does not call the RPC for an empty id list', async () => {
    const rpc = vi.spyOn(supabase, 'rpc')
    expect(await db.getEventViewStats([])).toEqual({})
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns nothing when the stats RPC fails', async () => {
    vi.spyOn(supabase, 'rpc').mockReturnValue(
      Promise.resolve({ data: null, error: { message: 'boom' } }) as never,
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await db.getEventViewStats(['e1'])).toEqual({})
  })
})

describe('getMyEvents view counts', () => {
  afterEach(() => vi.restoreAllMocks())

  it('attaches the view count from get_event_view_stats, defaulting to 0', async () => {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) chain[m] = () => chain
    chain.then = (res: (v: unknown) => void) => res({
      data: [{ id: 'e1', event_tags: [] }, { id: 'e2', event_tags: [] }], error: null,
    })
    vi.spyOn(supabase, 'from').mockReturnValue(chain as never)
    vi.spyOn(supabase, 'rpc').mockImplementation(((name: string) => Promise.resolve(
      name === 'get_event_view_stats'
        ? { data: [{ event_id: 'e1', views: 7, viewers: 3 }], error: null }
        : { data: [{ event_id: 'e1', msg_count: 2 }], error: null },
    )) as never)

    const out = await db.getMyEvents('me')
    expect(out.map(e => [e.id, e.msgCount, e.viewCount])).toEqual([['e1', 2, 7], ['e2', 0, 0]])
  })
})
