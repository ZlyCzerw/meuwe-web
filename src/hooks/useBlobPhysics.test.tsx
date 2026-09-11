import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBlobPhysics } from './useBlobPhysics'
import { MAX_BLOBS, BIG_COLOR } from './blobPhysics'

vi.mock('../lib/blobSounds', () => ({
  playBlee: vi.fn(),
  playWii: vi.fn(),
  playPop: vi.fn(),
}))
import { playBlee, playWii } from '../lib/blobSounds'

// rAF pod kontrolą testu: każda klatka to jawne wywołanie.
let frame: FrameRequestCallback | null = null

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10_000)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frame = cb; return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.mocked(playBlee).mockClear()
  vi.mocked(playWii).mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function tick(ms = 16) {
  act(() => {
    vi.advanceTimersByTime(ms)
    frame?.(0)
  })
}

describe('useBlobPhysics', () => {
  it('starts with a full pool and moves it every frame', () => {
    const { result } = renderHook(() => useBlobPhysics())
    expect(result.current.blobs).toHaveLength(MAX_BLOBS)
    const before = result.current.blobs.map(b => b.x)
    tick()
    const after = result.current.blobs.map(b => b.x)
    expect(after).not.toEqual(before)
  })

  it('grab pins the blob under the finger, plays "blee" and stops it drifting', () => {
    const { result } = renderHook(() => useBlobPhysics())
    const id = result.current.blobs[0].id
    let ok = false
    act(() => { ok = result.current.grab(id, 100, 150) })
    expect(ok).toBe(true)
    expect(playBlee).toHaveBeenCalledTimes(1)
    tick(); tick()
    const held = result.current.blobs.find(b => b.id === id)!
    expect(held.state).toBe('held')
    expect(held.x).toBe(100)
    expect(held.y).toBe(150)
  })

  it('refuses a second grab while one blob is held', () => {
    const { result } = renderHook(() => useBlobPhysics())
    const [a, b] = result.current.blobs
    act(() => { result.current.grab(a.id, 100, 100) })
    let ok = true
    act(() => { ok = result.current.grab(b.id, 200, 200) })
    expect(ok).toBe(false)
  })

  it('drag follows the finger', () => {
    const { result } = renderHook(() => useBlobPhysics())
    const id = result.current.blobs[0].id
    act(() => { result.current.grab(id, 100, 100) })
    act(() => { result.current.drag(140, 90) })
    const b = result.current.blobs.find(x => x.id === id)!
    expect([b.x, b.y]).toEqual([140, 90])
  })

  it('a fast release flings the blob with "łiii"', () => {
    const { result } = renderHook(() => useBlobPhysics())
    const id = result.current.blobs[0].id
    act(() => { result.current.grab(id, 100, 100) })
    for (let i = 1; i <= 4; i++) {
      act(() => { vi.advanceTimersByTime(16); result.current.drag(100 + i * 40, 100) })
    }
    act(() => { result.current.release() })
    const b = result.current.blobs.find(x => x.id === id)!
    expect(b.state).toBe('free')
    expect(b.vx).toBeGreaterThan(10)
    expect(playWii).toHaveBeenCalledTimes(1)
  })

  it('a still release just lets go, silently', () => {
    const { result } = renderHook(() => useBlobPhysics())
    const id = result.current.blobs[0].id
    act(() => { result.current.grab(id, 100, 100) })
    act(() => { vi.advanceTimersByTime(500) })
    act(() => { result.current.release() })
    const b = result.current.blobs.find(x => x.id === id)!
    expect(b.state).toBe('free')
    expect(Math.hypot(b.vx, b.vy)).toBe(0)
    expect(playWii).not.toHaveBeenCalled()
  })

  describe('big blob', () => {
    // Zamień pierwszego bloba w dużego o masie 4 przez chwyt-i-podmianę: hook nie
    // wystawia settera, więc dosuwamy go stanem z fizyki — czwórka w klastrze.
    function withBig() {
      const hook = renderHook(() => useBlobPhysics())
      const ids = hook.result.current.blobs.slice(0, 4).map(b => b.id)
      // Ułóż czwórkę w rządek, dokładnie stycznie, przez chwyt i upuszczenie.
      ids.forEach((id, i) => {
        act(() => { hook.result.current.grab(id, 100 + i * 40, 300) })
        act(() => { hook.result.current.release() })
        tick()
      })
      // Zlanie trwa ABSORB_MS; przewiń.
      for (let i = 0; i < 100; i++) tick()
      const big = hook.result.current.blobs.find(b => b.big)!
      return { hook, big }
    }

    it('melts a touching four into one green blob', () => {
      const { big, hook } = withBig()
      expect(big).toBeDefined()
      expect(big.color).toBe(BIG_COLOR)
      expect(hook.result.current.blobs.filter(b => b.big)).toHaveLength(1)
    })

    it('grab keeps the touch offset, looks at the finger and speaks lower', () => {
      const { big, hook } = withBig()
      const fx = big.x + 30, fy = big.y
      let ok = false
      act(() => { ok = hook.result.current.grab(big.id, fx, fy) })
      expect(ok).toBe(true)
      const held = hook.result.current.blobs.find(b => b.id === big.id)!
      expect(held.state).toBe('held')
      expect(held.x).toBeCloseTo(big.x)
      expect(held.look.x).toBeCloseTo(1)
      expect(held.look.y).toBeCloseTo(0)
      const pitch = vi.mocked(playBlee).mock.calls.at(-1)![0]
      expect(pitch).toBeLessThan(1)
      act(() => { hook.result.current.drag(fx + 50, fy + 20) })
      const dragged = hook.result.current.blobs.find(b => b.id === big.id)!
      expect(dragged.x).toBeCloseTo(big.x + 50)
      expect(dragged.y).toBeCloseTo(big.y + 20)
    })

    it('a flung big blob is slower than a small one flung the same way', () => {
      const { big, hook } = withBig()
      const small = hook.result.current.blobs.find(b => !b.big && b.state === 'free')!
      const fling = (id: number) => {
        act(() => { hook.result.current.grab(id, 100, 100) })
        for (let i = 1; i <= 4; i++) act(() => { vi.advanceTimersByTime(16); hook.result.current.drag(100 + i * 40, 100) })
        act(() => { hook.result.current.release() })
        return hook.result.current.blobs.find(b => b.id === id)!.vx
      }
      const vSmall = fling(small.id)
      const vBig = fling(big.id)
      expect(vBig).toBeGreaterThan(0)
      expect(vBig).toBeLessThan(vSmall)
      expect(hook.result.current.blobs.find(b => b.id === big.id)!.look).toEqual({ x: 0, y: 0 })
    })
  })

  it('refills the pool from the edge after a blob is thrown off screen', () => {
    const { result } = renderHook(() => useBlobPhysics())
    const id = result.current.blobs[0].id
    act(() => { result.current.grab(id, 100, 100) })
    act(() => { result.current.drag(-5000, 100) })
    act(() => { result.current.release() })
    tick()
    expect(result.current.blobs).toHaveLength(MAX_BLOBS - 1)
    expect(result.current.blobs.some(b => b.id === id)).toBe(false)
    tick(2100)
    expect(result.current.blobs).toHaveLength(MAX_BLOBS)
  })

  it('does not over-spawn while a respawn is already pending', () => {
    const { result } = renderHook(() => useBlobPhysics())
    const id = result.current.blobs[0].id
    act(() => { result.current.grab(id, 100, 100) })
    act(() => { result.current.drag(-5000, 100) })
    act(() => { result.current.release() })
    for (let i = 0; i < 10; i++) tick(50)
    tick(2100)
    expect(result.current.blobs).toHaveLength(MAX_BLOBS)
  })
})
