import { describe, it, expect, vi } from 'vitest'
import { pinSvg, pinImageUrl, allPinVariants } from './pinImages'
import { ALL_CATEGORIES, BLOBS, TAG_META } from '../lib/tokens'

describe('pinSvg', () => {
  it('public: shadow copy drawn 3 px lower at 0x22 alpha, then the coloured blob, no filter', () => {
    const svg = pinSvg({ kind: 'public', category: 'music', blob: 1 })
    expect(svg).toContain('viewBox="-3 -3 106 120.455"')
    expect(svg).toContain(`d="${BLOBS[1]}" fill="#2D2B2A"`)
    expect(svg).toContain('opacity="0.1333" transform="translate(0 7.227)"')
    expect(svg).toContain(`d="${BLOBS[1]}" fill="${TAG_META.music.color}"`)
    expect(svg).not.toContain('filter')
  })

  it('glyph is placed as an 18 px box centred on the blob, in ink', () => {
    const svg = pinSvg({ kind: 'public', category: 'party', blob: 0 })
    expect(svg).toContain('<g color="#2D2B2A"><svg x="28.318" y="28.318" width="43.364" height="43.364"')
  })

  it('every category glyph gets placed (no 1em box left over)', () => {
    for (const category of ALL_CATEGORIES) {
      expect(pinSvg({ kind: 'public', category, blob: 0 })).not.toContain('width="1em"')
    }
  })

  it('blob index wraps like BLOBS[idx % length]', () => {
    expect(pinSvg({ kind: 'public', category: 'art', blob: 4 })).toBe(pinSvg({ kind: 'public', category: 'art', blob: 1 }))
  })

  it('private: white blob, darker 0x44 shadow, face glyph 30x25', () => {
    const svg = pinSvg({ kind: 'private' })
    expect(svg).toContain(`d="${BLOBS[0]}" fill="#fff"`)
    expect(svg).toContain('opacity="0.2667"')
    expect(svg).toContain('<svg x="13.864" y="19.886" width="72.273" height="60.227"')
  })

  it('badge: shadow circle 2 px lower, white circle on top, 28x30', () => {
    const svg = pinSvg({ kind: 'badge' })
    expect(svg).toContain('width="28" height="30" viewBox="0 0 100 107.143"')
    expect(svg).toContain('opacity="0.1333" transform="translate(0 7.143)"')
    expect(svg).toContain('fill="#fff"/>')
  })
})

describe('pinImageUrl', () => {
  it('returns the same URL for the same variant (built once)', () => {
    const a = pinImageUrl({ kind: 'public', category: 'food', blob: 2 })
    expect(pinImageUrl({ kind: 'public', category: 'food', blob: 5 })).toBe(a)
    expect(pinImageUrl({ kind: 'public', category: 'food', blob: 0 })).not.toBe(a)
  })

  it('falls back to a data: URL where createObjectURL is missing', async () => {
    vi.resetModules()
    const orig = URL.createObjectURL
    ;(URL as { createObjectURL?: unknown }).createObjectURL = undefined
    try {
      const mod = await import('./pinImages')
      expect(mod.pinImageUrl({ kind: 'badge' })).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    } finally {
      URL.createObjectURL = orig
    }
  })

  it('uses a blob: URL when the browser can make one', async () => {
    vi.resetModules()
    const create = vi.fn(() => 'blob:test/1')
    const orig = URL.createObjectURL
    URL.createObjectURL = create
    try {
      const mod = await import('./pinImages')
      expect(mod.pinImageUrl({ kind: 'private' })).toBe('blob:test/1')
      mod.pinImageUrl({ kind: 'private' })
      expect(create).toHaveBeenCalledTimes(1)
    } finally {
      URL.createObjectURL = orig
    }
  })
})

describe('allPinVariants', () => {
  it('covers every category x blob, plus private and badge', () => {
    const vs = allPinVariants()
    expect(vs).toHaveLength(ALL_CATEGORIES.length * BLOBS.length + 2)
    expect(new Set(vs.map(v => pinImageUrl(v))).size).toBe(vs.length)
  })
})
