import { describe, it, expect, beforeEach } from 'vitest'
import { countRender, timed, perfPinsParam } from './perfProbe'

describe('perfProbe', () => {
  beforeEach(() => { delete window.__perf; window.history.replaceState(null, '', '/') })

  it('counts renders per name', () => {
    countRender('A'); countRender('A'); countRender('B')
    expect(window.__perf!.renders).toEqual({ A: 2, B: 1 })
  })

  it('timed returns the value and records a duration', () => {
    expect(timed('x', () => 42)).toBe(42)
    expect(window.__perf!.timings.x).toHaveLength(1)
  })

  it('perfPinsParam reads ?perfPins, clamps, ignores junk', () => {
    expect(perfPinsParam()).toBe(0)
    window.history.replaceState(null, '', '/?perfPins=1500')
    expect(perfPinsParam()).toBe(1500)
    window.history.replaceState(null, '', '/?perfPins=99999')
    expect(perfPinsParam()).toBe(5000)
    window.history.replaceState(null, '', '/?perfPins=abc')
    expect(perfPinsParam()).toBe(0)
  })
})
