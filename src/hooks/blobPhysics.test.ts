import { describe, it, expect } from 'vitest'
import {
  initBlob,
  spawnFromEdge,
  isOffScreen,
  checkCollision,
  stepBlobs,
  flingVelocity,
  mergedSize,
  MAX_BLOBS,
  MERGE_AT,
  BURST_AT,
  SHAKE_FROM,
  BURST_DELAY,
  ABSORB_MS,
  FLING_MAX,
  CRUISE_MAX,
  FLEE_RADIUS,
  BIG_COLOR,
  type BlobParticle,
  type BlobEnv,
} from './blobPhysics'

// Helper: minimal blob without randomness
function blob(overrides: Partial<BlobParticle> & { id: number }): BlobParticle {
  return {
    x: 200, y: 400, vx: 1, vy: 0,
    color: '#FF7A45', size: 60, blobIdx: 0,
    clusterId: null, clusterUntil: 0,
    state: 'free', mass: 1, big: false,
    absorbingInto: null, absorbStart: 0, absorbFrom: null,
    burstAt: null, shake: 0, squashUntil: 0, bumpUntil: 0,
    jitterX: 0, jitterY: 0, pose: 'normal',
    ...overrides,
  }
}

function bigBlob(overrides: Partial<BlobParticle> & { id: number }): BlobParticle {
  return blob({ big: true, mass: 4, size: 120, color: BIG_COLOR, vx: 0, vy: 0, ...overrides })
}

const ENV: BlobEnv = { w: 400, h: 800, pointer: null }

function step(blobs: BlobParticle[], now: number, env: BlobEnv = ENV) {
  return stepBlobs(blobs, now, env)
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

  it('starts free, unclustered, small with mass 1', () => {
    const b = initBlob(1, 400, 800)
    expect(b.clusterId).toBeNull()
    expect(b.state).toBe('free')
    expect(b.big).toBe(false)
    expect(b.mass).toBe(1)
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

  it('velocity points roughly toward centre', () => {
    for (let i = 0; i < 20; i++) {
      const b = spawnFromEdge(i, 400, 800)
      const dot = b.vx * (200 - b.x) + b.vy * (400 - b.y)
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

  it('returns false when blob is partially off-screen but within size margin', () => {
    expect(isOffScreen(blob({ id: 1, x: 380, y: 400, size: 50 }), 400, 800)).toBe(false)
  })
})

describe('checkCollision', () => {
  it('detects overlap when distance < sum of radii', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60 })
    const b = blob({ id: 2, x: 140, y: 100, size: 60 })
    expect(checkCollision(a, b)).toBe(true)
  })

  it('returns false when blobs are exactly touching', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60 })
    const b = blob({ id: 2, x: 160, y: 100, size: 60 })
    expect(checkCollision(a, b)).toBe(false)
  })
})

describe('flingVelocity', () => {
  it('returns zero for fewer than two samples', () => {
    expect(flingVelocity([{ x: 0, y: 0, t: 0 }], 10)).toEqual({ vx: 0, vy: 0 })
  })

  it('converts px/ms over the last samples to px/frame', () => {
    // 100 px in 100 ms = 1 px/ms ≈ 16.67 px/frame
    const v = flingVelocity([{ x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 100 }], 100)
    expect(v.vx).toBeCloseTo(16.67, 1)
    expect(v.vy).toBeCloseTo(0)
  })

  it('ignores samples older than the window', () => {
    const v = flingVelocity([
      { x: 0, y: 0, t: 0 },        // stale: finger paused here long ago
      { x: 300, y: 0, t: 900 },
      { x: 310, y: 0, t: 950 },
    ], 1000)
    // Only the last 50 ms count: 10 px / 50 ms = 0.2 px/ms ≈ 3.3 px/frame
    expect(v.vx).toBeCloseTo(3.33, 1)
  })

  it('caps the magnitude at FLING_MAX', () => {
    const v = flingVelocity([{ x: 0, y: 0, t: 0 }, { x: 5000, y: 0, t: 10 }], 10)
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(FLING_MAX)
  })

  it('returns zero when the finger rested before release', () => {
    const v = flingVelocity([{ x: 50, y: 50, t: 0 }, { x: 50, y: 50, t: 100 }], 600)
    expect(v).toEqual({ vx: 0, vy: 0 })
  })
})

describe('mergedSize', () => {
  it('keeps total area: four 60px blobs make one 120px blob', () => {
    expect(mergedSize([60, 60, 60, 60])).toBeCloseTo(120)
  })
})

describe('stepBlobs: movement', () => {
  it('moves free blobs by their velocity each frame', () => {
    const b = blob({ id: 1, x: 100, y: 200, vx: 1.5, vy: -1 })
    const { blobs: [r] } = step([b], 0)
    expect(r.x).toBeCloseTo(101.5)
    expect(r.y).toBeCloseTo(199)
  })

  it('does not move a held blob', () => {
    const b = blob({ id: 1, x: 100, y: 200, vx: 5, vy: 5, state: 'held' })
    const { blobs: [r] } = step([b], 0)
    expect(r.x).toBe(100)
    expect(r.y).toBe(200)
  })

  it('damps a flung blob back toward cruising speed but never below it', () => {
    let list = [blob({ id: 1, x: 200, y: 400, vx: FLING_MAX, vy: 0 })]
    for (let i = 0; i < 300; i++) list = step(list, i * 16, { w: 100000, h: 100000, pointer: null }).blobs
    const speed = Math.hypot(list[0].vx, list[0].vy)
    expect(speed).toBeLessThanOrEqual(CRUISE_MAX + 0.01)
    expect(speed).toBeGreaterThan(1)
  })

  it('does not damp a blob already at cruising speed', () => {
    const b = blob({ id: 1, vx: 1.5, vy: 0 })
    const { blobs: [r] } = step([b], 0)
    expect(r.vx).toBeCloseTo(1.5)
  })
})

describe('stepBlobs: clusters', () => {
  it('clusters two free overlapping blobs and averages their velocity', () => {
    const a = blob({ id: 1, x: 100, y: 100, vx: 2, vy: 0 })
    const b = blob({ id: 2, x: 140, y: 100, vx: 0, vy: 2 })
    const { blobs: r } = step([a, b], 0)
    expect(r[0].clusterId).not.toBeNull()
    expect(r[0].clusterId).toBe(r[1].clusterId)
    expect(r[0].vx).toBeCloseTo(1)
    expect(r[0].vy).toBeCloseTo(1)
    expect(r[0].clusterUntil).toBeGreaterThanOrEqual(2000)
    expect(r[0].clusterUntil).toBeLessThanOrEqual(3000)
  })

  it('lets a free blob join an existing cluster', () => {
    const a = blob({ id: 1, x: 100, y: 100, clusterId: 1, clusterUntil: 9999 })
    const b = blob({ id: 2, x: 140, y: 100, clusterId: 1, clusterUntil: 9999 })
    const c = blob({ id: 3, x: 180, y: 100 })
    const { blobs: r } = step([a, b, c], 0)
    expect(r[2].clusterId).toBe(1)
    expect(r[0].clusterId).toBe(1)
  })

  it('expires a cluster when now >= clusterUntil', () => {
    const a = blob({ id: 1, x: 100, clusterId: 1, clusterUntil: 500 })
    const b = blob({ id: 2, x: 300, clusterId: 1, clusterUntil: 500 })
    const { blobs: r } = step([a, b], 1000)
    expect(r[0].clusterId).toBeNull()
    expect(r[1].clusterId).toBeNull()
  })

  it('merges a cluster of MERGE_AT into one big green blob at the centre of mass', () => {
    const members = Array.from({ length: MERGE_AT }, (_, i) =>
      blob({ id: i + 1, x: 100 + i * 40, y: 300, vx: 1, vy: 0, clusterId: 1, clusterUntil: 9999 }),
    )
    const { blobs: r, events } = step(members, 0)
    expect(r).toHaveLength(1)
    const big = r[0]
    expect(big.big).toBe(true)
    expect(big.mass).toBe(MERGE_AT)
    expect(big.color).toBe(BIG_COLOR)
    expect(big.size).toBeCloseTo(mergedSize(members.map(m => m.size)))
    // members moved by vx=1 before merging, so centre of mass is 161
    expect(big.x).toBeCloseTo(161)
    expect(big.y).toBeCloseTo(300)
    expect(events).toContainEqual(expect.objectContaining({ type: 'merge' }))
  })

  it('merges when a third blob joins a pair and a fourth joins in the same frame', () => {
    const a = blob({ id: 1, x: 100, y: 100, clusterId: 1, clusterUntil: 9999 })
    const b = blob({ id: 2, x: 140, y: 100, clusterId: 1, clusterUntil: 9999 })
    const c = blob({ id: 3, x: 180, y: 100 })
    const d = blob({ id: 4, x: 220, y: 100 })
    const { blobs: r } = step([a, b, c, d], 0)
    expect(r).toHaveLength(1)
    expect(r[0].big).toBe(true)
  })

  it('never clusters a held blob', () => {
    const a = blob({ id: 1, x: 100, y: 100, state: 'held' })
    const b = blob({ id: 2, x: 140, y: 100 })
    const { blobs: r } = step([a, b], 0)
    expect(r[0].clusterId).toBeNull()
    expect(r[1].clusterId).toBeNull()
  })
})

describe('stepBlobs: big blob', () => {
  it('bounces off the left wall and stays inside', () => {
    const g = bigBlob({ id: 1, x: 50, y: 400, vx: -2, vy: 0, size: 120 })
    const { blobs: [r] } = step([g], 0)
    expect(r.vx).toBe(2)
    expect(r.x).toBeGreaterThanOrEqual(60)
    expect(r.squashUntil).toBeGreaterThan(0)
    expect(r.pose).toBe('squash')
  })

  it('bounces off the bottom wall', () => {
    const g = bigBlob({ id: 1, x: 200, y: 750, vx: 0, vy: 2, size: 120 })
    const { blobs: [r] } = step([g], 0)
    expect(r.vy).toBe(-2)
    expect(r.y).toBeLessThanOrEqual(740)
  })

  it('does not flee from the pointer', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, vx: 0, vy: 0 })
    const { blobs: [r] } = step([g], 0, { w: 400, h: 800, pointer: { x: 210, y: 400 } })
    expect(r.vx).toBe(0)
    expect(r.vy).toBe(0)
  })

  it('starts absorbing a small blob that touches it and takes its momentum by mass', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, vx: 0, vy: 0, mass: 4, size: 120 })
    const s = blob({ id: 2, x: 280, y: 400, vx: -10, vy: 0, size: 60 })
    const { blobs: r, events } = step([g, s], 1000)
    const big = r.find(b => b.id === 1)!
    const small = r.find(b => b.id === 2)!
    expect(small.state).toBe('absorbing')
    expect(small.absorbingInto).toBe(1)
    expect(small.absorbStart).toBe(1000)
    // The flung blob is damped before contact (-10 → -9.6), then (4·0 + 1·(-9.6)) / 5
    expect(big.vx).toBeCloseTo(small.vx / 5)
    expect(big.vx).toBeCloseTo(-1.92)
    expect(events).toContainEqual(expect.objectContaining({ type: 'absorb' }))
  })

  it('a heavier big blob is deflected less by the same hit', () => {
    const light = bigBlob({ id: 1, x: 200, y: 400, mass: 4, size: 120 })
    const heavy = bigBlob({ id: 1, x: 200, y: 400, mass: 10, size: 190 })
    const hit = () => blob({ id: 2, x: 280, y: 400, vx: -10, vy: 0, size: 60 })
    const l = step([light, hit()], 0).blobs.find(b => b.id === 1)!
    const h = step([heavy, hit()], 0).blobs.find(b => b.id === 1)!
    expect(Math.abs(h.vx)).toBeLessThan(Math.abs(l.vx))
  })

  it('pulls an absorbing blob into the big one and shrinks it over ABSORB_MS', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, size: 120 })
    const s = blob({
      id: 2, x: 280, y: 400, size: 60, state: 'absorbing', absorbingInto: 1,
      absorbStart: 0, absorbFrom: { x: 280, y: 400, size: 60 },
    })
    const { blobs: r } = step([g, s], ABSORB_MS / 2)
    const small = r.find(b => b.id === 2)!
    expect(small.x).toBeCloseTo(240)
    expect(small.size).toBeCloseTo(30)
  })

  it('removes the absorbed blob and grows the big one when ABSORB_MS elapses', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, size: 120, mass: 4 })
    const s = blob({
      id: 2, x: 280, y: 400, size: 60, state: 'absorbing', absorbingInto: 1,
      absorbStart: 0, absorbFrom: { x: 280, y: 400, size: 60 },
    })
    const { blobs: r } = step([g, s], ABSORB_MS)
    expect(r).toHaveLength(1)
    expect(r[0].mass).toBe(5)
    expect(r[0].size).toBeCloseTo(mergedSize([120, 60]))
    expect(r[0].bumpUntil).toBeGreaterThan(ABSORB_MS)
    expect(r[0].pose).toBe('bump')
  })

  it('jitters position only while shaking', () => {
    const calm = step([bigBlob({ id: 1, mass: 5 })], 0).blobs[0]
    expect(calm.jitterX).toBe(0)
    const shaky = Array.from({ length: 10 }, () => step([bigBlob({ id: 1, mass: BURST_AT - 1 })], 0).blobs[0])
    expect(shaky.some(b => b.jitterX !== 0 || b.jitterY !== 0)).toBe(true)
    for (const b of shaky) expect(Math.abs(b.jitterX)).toBeLessThanOrEqual(b.shake)
  })

  it('does not absorb a held blob', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, size: 120 })
    const s = blob({ id: 2, x: 250, y: 400, size: 60, state: 'held' })
    const { blobs: r } = step([g, s], 0)
    expect(r.find(b => b.id === 2)!.state).toBe('held')
  })

  it('shakes more as mass approaches BURST_AT', () => {
    const calm = step([bigBlob({ id: 1, mass: SHAKE_FROM - 1 })], 0).blobs[0]
    const nervous = step([bigBlob({ id: 1, mass: SHAKE_FROM })], 0).blobs[0]
    const frantic = step([bigBlob({ id: 1, mass: BURST_AT - 1 })], 0).blobs[0]
    expect(calm.shake).toBe(0)
    expect(nervous.shake).toBeGreaterThan(0)
    expect(frantic.shake).toBeGreaterThan(nervous.shake)
  })

  it('arms the burst timer when mass reaches BURST_AT', () => {
    const { blobs: [r] } = step([bigBlob({ id: 1, mass: BURST_AT })], 5000)
    expect(r.burstAt).toBe(5000 + BURST_DELAY)
  })

  it('bursts into BURST_AT small blobs flying outward once the timer fires', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, mass: BURST_AT, size: 200, burstAt: 5000 })
    const { blobs: r, events } = step([g], 5000)
    expect(r).toHaveLength(BURST_AT)
    expect(events).toContainEqual(expect.objectContaining({ type: 'burst', x: 200, y: 400 }))
    for (const d of r) {
      expect(d.state).toBe('burst')
      expect(d.big).toBe(false)
      expect(d.color).not.toBe(BIG_COLOR)
      // moving away from the burst origin
      const dot = d.vx * (d.x - 200) + d.vy * (d.y - 400)
      expect(dot).toBeGreaterThanOrEqual(0)
      expect(Math.hypot(d.vx, d.vy)).toBeGreaterThan(CRUISE_MAX * 2)
    }
  })

  it('burst debris is not damped and does not cluster', () => {
    const a = blob({ id: 1, x: 100, y: 100, vx: 8, vy: 0, state: 'burst' })
    const b = blob({ id: 2, x: 140, y: 100, vx: 8, vy: 0, state: 'burst' })
    const { blobs: r } = step([a, b], 0)
    expect(r[0].vx).toBe(8)
    expect(r[0].clusterId).toBeNull()
  })
})

describe('stepBlobs: pointer flee (desktop hover)', () => {
  it('pushes a nearby free small blob away from the pointer', () => {
    const b = blob({ id: 1, x: 200, y: 400, vx: 0, vy: 0 })
    const { blobs: [r] } = step([b], 0, { w: 400, h: 800, pointer: { x: 230, y: 400 } })
    expect(r.vx).toBeLessThan(0)
    expect(r.vy).toBeCloseTo(0)
  })

  it('ignores a pointer outside FLEE_RADIUS', () => {
    const b = blob({ id: 1, x: 200, y: 400, vx: 0, vy: 0 })
    const { blobs: [r] } = step([b], 0, { w: 400, h: 800, pointer: { x: 200 + FLEE_RADIUS + 5, y: 400 } })
    expect(r.vx).toBe(0)
  })

  it('never flees faster than the flee cap', () => {
    let list = [blob({ id: 1, x: 200, y: 400, vx: 0, vy: 0 })]
    const env = { w: 100000, h: 100000, pointer: { x: 210, y: 400 } }
    for (let i = 0; i < 60; i++) {
      list = step(list, i * 16, { ...env, pointer: { x: list[0].x + 10, y: 400 } }).blobs
    }
    expect(Math.hypot(list[0].vx, list[0].vy)).toBeLessThanOrEqual(CRUISE_MAX * 2 + 0.01)
  })
})

describe('MAX_BLOBS', () => {
  it('is 8', () => {
    expect(MAX_BLOBS).toBe(8)
  })
})
