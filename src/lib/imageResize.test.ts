import { describe, it, expect, vi, afterEach } from 'vitest'
import { fitWithin, downscaleImage, MAX_EDGE, TARGET_BYTES } from './imageResize'

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

function fileOfSize(bytes: number, name = 'photo.jpg', type = 'image/jpeg'): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('downscaleImage', () => {
  it('returns a small photo untouched, without decoding it', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    const file = fileOfSize(TARGET_BYTES - 1)
    expect(await downscaleImage(file)).toBe(file)
    expect(decode).not.toHaveBeenCalled()
  })

  it('returns a non-image untouched', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    const file = fileOfSize(TARGET_BYTES * 2, 'notes.pdf', 'application/pdf')
    expect(await downscaleImage(file)).toBe(file)
    expect(decode).not.toHaveBeenCalled()
  })

  it('returns the original when decoding throws, so the upload still happens', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')))
    const file = fileOfSize(TARGET_BYTES * 2)
    expect(await downscaleImage(file)).toBe(file)
  })

  it('returns the original when the browser has no createImageBitmap', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const file = fileOfSize(TARGET_BYTES * 2)
    expect(await downscaleImage(file)).toBe(file)
  })
})
