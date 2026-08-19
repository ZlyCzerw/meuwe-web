import { describe, it, expect, vi, afterEach } from 'vitest'
import { fitWithin, downscaleImage, MAX_EDGE, TARGET_BYTES } from './imageResize'

// Prawdziwego `HTMLCanvasElement.toBlob` ani `createImageBitmap` jsdom nie ma,
// ale to zwykłe mockowanie zależności (nie biblioteka), więc podstawiamy
// atrapę canvasu spod `document.createElement` i atrapę bitmapy spod
// `createImageBitmap`, żeby przetestować ścieżkę kodowania naprawdę.
function fakeBlob(size: number, type = 'image/jpeg'): Blob {
  return new Blob([new Uint8Array(size)], { type })
}

function fakeBitmap(width: number, height: number) {
  return { width, height, close: vi.fn() }
}

/** Atrapa canvasu zwracająca po kolei bloby o podanych rozmiarach z `toBlob`. */
function mockCanvas(toBlobSizes: Array<number | null>) {
  let call = 0
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    })),
    toBlob: vi.fn((cb: (b: Blob | null) => void) => {
      const size = toBlobSizes[call]
      call += 1
      cb(size === null || size === undefined ? null : fakeBlob(size))
    }),
  }
  // W tych testach `document.createElement` woła tylko `downscaleImage`
  // (zawsze po `'canvas'`), więc atrapa nie musi przepuszczać innych tagów.
  vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)
  return canvas
}

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
  vi.restoreAllMocks()
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

  it('leaves a photo exactly at the threshold untouched', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    const file = fileOfSize(TARGET_BYTES)
    expect(await downscaleImage(file)).toBe(file)
    expect(decode).not.toHaveBeenCalled()
  })
})

describe('downscaleImage canvas path', () => {
  it('stops the quality ladder at the first step under the target', async () => {
    const bitmap = fakeBitmap(4000, 3000)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const canvas = mockCanvas([TARGET_BYTES - 1000, TARGET_BYTES - 500, TARGET_BYTES - 200])

    const file = fileOfSize(TARGET_BYTES * 2)
    const result = await downscaleImage(file)

    expect(canvas.toBlob).toHaveBeenCalledTimes(1)
    expect(result.size).toBe(TARGET_BYTES - 1000)
    expect(bitmap.close).toHaveBeenCalled()
  })

  it('walks the whole ladder and keeps the smallest result when none reaches the target', async () => {
    const bitmap = fakeBitmap(4000, 3000)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const canvas = mockCanvas([500_000, 400_000, 350_000])

    const file = fileOfSize(700_000)
    const result = await downscaleImage(file)

    expect(canvas.toBlob).toHaveBeenCalledTimes(3)
    expect(result.size).toBe(350_000)
    expect(result).not.toBe(file)
  })

  it('returns the original when every ladder step is at or above the file size', async () => {
    const bitmap = fakeBitmap(4000, 3000)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    mockCanvas([450_000, 420_000, 405_000])

    const file = fileOfSize(400_000)
    const result = await downscaleImage(file)

    expect(result).toBe(file)
  })

  it('names and types the resized file for upload', async () => {
    const bitmap = fakeBitmap(4000, 3000)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    mockCanvas([TARGET_BYTES - 1000])

    const file = fileOfSize(TARGET_BYTES * 2, 'party.png', 'image/png')
    const result = await downscaleImage(file)

    expect(result.name).toBe('party.jpg')
    expect(result.type).toBe('image/jpeg')
  })

  it('draws onto a canvas sized by fitWithin, not the original bitmap size', async () => {
    const bitmap = fakeBitmap(4000, 3000)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const canvas = mockCanvas([TARGET_BYTES - 1000])

    const file = fileOfSize(TARGET_BYTES * 2)
    await downscaleImage(file)

    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(1200)
  })
})
