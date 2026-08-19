import { describe, it, expect } from 'vitest'
import { pinsOverlap } from './pinOverlap'

describe('pinsOverlap', () => {
  it('identical positions overlap', () => {
    expect(pinsOverlap({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(true)
  })

  it('43 px apart horizontally still overlaps, 44 px does not', () => {
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 43, y: 0 })).toBe(true)
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 44, y: 0 })).toBe(false)
  })

  it('55 px apart vertically still overlaps, 56 px does not', () => {
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 0, y: 55 })).toBe(true)
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 0, y: 56 })).toBe(false)
  })

  it('is symmetric and sign-independent', () => {
    expect(pinsOverlap({ x: 0, y: 0 }, { x: -43, y: -55 })).toBe(true)
    expect(pinsOverlap({ x: -43, y: -55 }, { x: 0, y: 0 })).toBe(true)
  })

  it('clear of each other on one axis is enough to not overlap', () => {
    expect(pinsOverlap({ x: 0, y: 0 }, { x: 10, y: 200 })).toBe(false)
  })
})
