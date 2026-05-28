import { describe, it, expect } from 'vitest'
import {
  initBlob,
  spawnFromEdge,
  isOffScreen,
  checkCollision,
  resolveCollision,
  unpair,
  stepBlobs,
  type BlobParticle,
} from './blobPhysics'

// Helper: minimal blob without randomness
function blob(overrides: Partial<BlobParticle> & { id: number }): BlobParticle {
  return {
    x: 200, y: 400, vx: 1, vy: 0,
    color: '#FF7A45', size: 60, blobIdx: 0,
    pairedWith: null, pairedUntil: 0,
    ...overrides,
  }
}

describe('initBlob', () => {
  it('places blob within viewport inset by its own size', () => {
    const b = initBlob(1, 400, 800)
    expect(b.x).toBeGreaterThanOrEqual(b.size)
    expect(b.x).toBeLessThanOrEqual(400 - b.size)
    expect(b.y).toBeGreaterThanOrEqual(b.size)
    expect(b.y).toBeLessThanOrEqual(800 - b.size)
  })

  it('assigns speed between 1.2 and 2 px/frame', () => {
    const b = initBlob(1, 400, 800)
    const speed = Math.sqrt(b.vx ** 2 + b.vy ** 2)
    expect(speed).toBeGreaterThanOrEqual(1.19)
    expect(speed).toBeLessThanOrEqual(2.01)
  })

  it('starts unpaired', () => {
    const b = initBlob(1, 400, 800)
    expect(b.pairedWith).toBeNull()
    expect(b.pairedUntil).toBe(0)
  })

  it('assigns a size between 44 and 72', () => {
    const b = initBlob(1, 400, 800)
    expect(b.size).toBeGreaterThanOrEqual(44)
    expect(b.size).toBeLessThanOrEqual(72)
  })
})

describe('spawnFromEdge', () => {
  it('places blob outside viewport bounds', () => {
    for (let i = 0; i < 20; i++) {
      const b = spawnFromEdge(i, 400, 800)
      const insideX = b.x >= 0 && b.x <= 400
      const insideY = b.y >= 0 && b.y <= 800
      expect(insideX && insideY).toBe(false)
    }
  })

  it('velocity points roughly toward centre (dot product with to-centre vector > 0)', () => {
    for (let i = 0; i < 20; i++) {
      const b = spawnFromEdge(i, 400, 800)
      const toCx = 200 - b.x
      const toCy = 400 - b.y
      const dot = b.vx * toCx + b.vy * toCy
      expect(dot).toBeGreaterThan(0)
    }
  })
})

describe('isOffScreen', () => {
  it('returns false for a blob fully inside viewport', () => {
    expect(isOffScreen(blob({ id: 1, x: 200, y: 400, size: 50 }), 400, 800)).toBe(false)
  })

  it('returns true when centre is more than size past right edge', () => {
    expect(isOffScreen(blob({ id: 1, x: 510, y: 400, size: 50 }), 400, 800)).toBe(true)
  })

  it('returns true when centre is more than size past top edge', () => {
    expect(isOffScreen(blob({ id: 1, x: 200, y: -60, size: 50 }), 400, 800)).toBe(true)
  })

  it('returns false when blob is partially off-screen but centre is still within size margin', () => {
    // Centre at x=380 with size=50: 380 > 400-50=350 but 380 < 400+50=450 → still alive
    expect(isOffScreen(blob({ id: 1, x: 380, y: 400, size: 50 }), 400, 800)).toBe(false)
  })
})

describe('checkCollision', () => {
  it('detects overlap when distance < sum of radii', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60 })
    const b = blob({ id: 2, x: 140, y: 100, size: 60 }) // distance=40 < (60+60)/2=60
    expect(checkCollision(a, b)).toBe(true)
  })

  it('returns false when blobs are far apart', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60 })
    const b = blob({ id: 2, x: 300, y: 300, size: 60 })
    expect(checkCollision(a, b)).toBe(false)
  })

  it('returns false when blobs are exactly touching (not overlapping)', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60 })
    const b = blob({ id: 2, x: 160, y: 100, size: 60 }) // distance=60 = (60+60)/2
    expect(checkCollision(a, b)).toBe(false)
  })
})

describe('resolveCollision', () => {
  it('assigns the averaged velocity to both blobs', () => {
    const a = blob({ id: 1, vx: 2, vy: 0 })
    const b = blob({ id: 2, vx: 0, vy: 2 })
    const [ra, rb] = resolveCollision(a, b, 1000)
    expect(ra.vx).toBeCloseTo(1)
    expect(ra.vy).toBeCloseTo(1)
    expect(rb.vx).toBeCloseTo(1)
    expect(rb.vy).toBeCloseTo(1)
  })

  it('sets pairedWith cross-references', () => {
    const a = blob({ id: 1 })
    const b = blob({ id: 2 })
    const [ra, rb] = resolveCollision(a, b, 1000)
    expect(ra.pairedWith).toBe(2)
    expect(rb.pairedWith).toBe(1)
  })

  it('sets pairedUntil 2–3 seconds from now', () => {
    const a = blob({ id: 1 })
    const b = blob({ id: 2 })
    const now = 5000
    const [ra] = resolveCollision(a, b, now)
    expect(ra.pairedUntil).toBeGreaterThanOrEqual(now + 2000)
    expect(ra.pairedUntil).toBeLessThanOrEqual(now + 3000)
  })
})

describe('unpair', () => {
  it('clears pairedWith and pairedUntil', () => {
    const b = blob({ id: 1, pairedWith: 2, pairedUntil: 9999 })
    const result = unpair(b)
    expect(result.pairedWith).toBeNull()
    expect(result.pairedUntil).toBe(0)
  })

  it('adds a small delta to velocity (speed changes by at most 0.4 in each axis)', () => {
    const b = blob({ id: 1, vx: 1, vy: 1, pairedWith: 2, pairedUntil: 9999 })
    const result = unpair(b)
    expect(Math.abs(result.vx - 1)).toBeLessThanOrEqual(0.4)
    expect(Math.abs(result.vy - 1)).toBeLessThanOrEqual(0.4)
  })
})

describe('stepBlobs', () => {
  it('moves blobs by their velocity each frame', () => {
    const b = blob({ id: 1, x: 100, y: 200, vx: 1.5, vy: -1 })
    const [result] = stepBlobs([b], 0)
    expect(result.x).toBeCloseTo(101.5)
    expect(result.y).toBeCloseTo(199)
  })

  it('expires pairing when now >= pairedUntil', () => {
    const a = blob({ id: 1, pairedWith: 2, pairedUntil: 500, x: 100 })
    const b = blob({ id: 2, pairedWith: 1, pairedUntil: 500, x: 200 })
    const result = stepBlobs([a, b], 1000)
    expect(result[0].pairedWith).toBeNull()
    expect(result[1].pairedWith).toBeNull()
  })

  it('does not expire pairing when now < pairedUntil', () => {
    const a = blob({ id: 1, pairedWith: 2, pairedUntil: 5000, x: 100 })
    const b = blob({ id: 2, pairedWith: 1, pairedUntil: 5000, x: 200 })
    const result = stepBlobs([a, b], 1000)
    expect(result[0].pairedWith).toBe(2)
    expect(result[1].pairedWith).toBe(1)
  })

  it('resolves collision between two unpaired overlapping blobs', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60, vx: 2, vy: 0 })
    const b = blob({ id: 2, x: 140, y: 100, size: 60, vx: 0, vy: 0 }) // distance=40 < 60
    const result = stepBlobs([a, b], 0)
    expect(result[0].pairedWith).toBe(2)
    expect(result[1].pairedWith).toBe(1)
  })

  it('does not resolve collision if either blob is already paired', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60, pairedWith: 3, pairedUntil: 9999 })
    const b = blob({ id: 2, x: 140, y: 100, size: 60 })
    const result = stepBlobs([a, b], 0)
    expect(result[0].pairedWith).toBe(3) // unchanged
    expect(result[1].pairedWith).toBeNull() // unchanged
  })
})
