import { describe, it, expect } from 'vitest'
import { pinsOverlap, overlapChainInView } from './pinOverlap'

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

const VIEW = { x: 400, y: 800 }

describe('overlapChainInView', () => {
  it('a lone pin returns just itself', () => {
    expect(overlapChainInView([{ x: 0, y: 0 }], 0, VIEW)).toEqual([0])
  })

  it('a neighbour in view but clear of the box is not in the chain', () => {
    // 100 px is well inside the 400-wide frame, so this isolates "no overlap"
    // from "out of view".
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    expect(overlapChainInView(pts, 0, VIEW)).toEqual([0])
  })

  it('follows the chain transitively even when the ends do not overlap', () => {
    // A-B-C each 30 px apart: A and C are 60 px apart and do not overlap,
    // but C is still reachable through B.
    const pts = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }]
    expect(overlapChainInView(pts, 0, VIEW).sort()).toEqual([0, 1, 2])
  })

  it('drops chain members that fall outside the viewport', () => {
    // A tail of pins 30 px apart running off past the frame edge. The viewport
    // is 400 wide, so centred on A it reaches x = 200; the pin at 210 is out.
    const pts = [
      { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }, { x: 90, y: 0 },
      { x: 120, y: 0 }, { x: 150, y: 0 }, { x: 180, y: 0 }, { x: 210, y: 0 },
    ]
    const chain = overlapChainInView(pts, 0, VIEW)
    expect(chain).not.toContain(7)
    expect(chain.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('clips vertically too', () => {
    // A short frame: 200 tall, so centred on A it reaches y = 100. The pins are
    // 50 px apart, close enough to chain, so only the frame can stop the walk.
    const short = { x: 400, y: 200 }
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 0, y: 100 }, { x: 0, y: 150 }]
    const chain = overlapChainInView(pts, 0, short)
    expect(chain).not.toContain(3)
    expect(chain.sort((a, b) => a - b)).toEqual([0, 1, 2])
  })

  it('always includes the clicked pin even when it is off-centre in the data', () => {
    const pts = [{ x: 1000, y: 1000 }, { x: 0, y: 0 }, { x: 20, y: 0 }]
    expect(overlapChainInView(pts, 1, VIEW).sort()).toEqual([1, 2])
  })
})
