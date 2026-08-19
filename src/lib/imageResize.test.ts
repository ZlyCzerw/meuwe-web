import { describe, it, expect } from 'vitest'
import { fitWithin, MAX_EDGE } from './imageResize'

describe('fitWithin', () => {
  it('leaves an image already inside the box alone', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('leaves an image exactly at the limit alone', () => {
    expect(fitWithin(MAX_EDGE, 900)).toEqual({ width: MAX_EDGE, height: 900 })
  })

  it('scales a landscape photo by its long edge', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
  })

  it('scales a portrait photo by its long edge', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('never rounds a dimension down to zero', () => {
    expect(fitWithin(20000, 5)).toEqual({ width: 1600, height: 1 })
  })
})
