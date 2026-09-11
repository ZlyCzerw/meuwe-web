import { describe, it, expect } from 'vitest'
import {
  initBlob,
  spawnFromEdge,
  isOffScreen,
  checkCollision,
  stepBlobs,
  flingVelocity,
  mergedSize,
  attachedFrame,
  MAX_BLOBS,
  MERGE_AT,
  BURST_AT,
  SHAKE_FROM,
  BURST_DELAY,
  ABSORB_MS,
  STICK_END,
  MERGE_START,
  PRESS_IN,
  FLING_MAX,
  CRUISE_MAX,
  FLEE_RADIUS,
  BIG_COLOR,
  SMALL_COLORS,
  type BlobParticle,
  type BlobEnv,
} from './blobPhysics'

// Helper: minimal blob without randomness
function blob(overrides: Partial<BlobParticle> & { id: number }): BlobParticle {
  const size = overrides.size ?? 60
  return {
    x: 200, y: 400, vx: 1, vy: 0,
    color: '#FF7A45', size, blobIdx: 0,
    clusterId: null, clusterUntil: 0,
    state: 'free', mass: 1, big: false, coreSize: size,
    absorbingInto: null, absorbStart: 0, absorbFrom: null, absorbT: 0, wobble: 0,
    burstAt: null, shake: 0, jitterX: 0, jitterY: 0, squashUntil: 0, squash: 0,
    look: { x: 0, y: 0 },
    ...overrides,
  }
}

function bigBlob(overrides: Partial<BlobParticle> & { id: number }): BlobParticle {
  return blob({ big: true, mass: 4, size: 120, coreSize: 120, color: BIG_COLOR, vx: 0, vy: 0, ...overrides })
}

let ids = 1000
const ENV: BlobEnv = { w: 400, h: 800, pointer: null, allocId: () => ++ids }

function step(blobs: BlobParticle[], now: number, env: Partial<BlobEnv> = {}) {
  return stepBlobs(blobs, now, { ...ENV, ...env })
}

const dist = (a: BlobParticle, b: BlobParticle) => Math.hypot(a.x - b.x, a.y - b.y)
const totalArea = (list: BlobParticle[]) => list.reduce((acc, b) => acc + b.size ** 2, 0)

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

  it('never wears the big blob green', () => {
    for (let i = 0; i < 40; i++) {
      const b = initBlob(i, 400, 800)
      expect(b.color).not.toBe(BIG_COLOR)
      expect(SMALL_COLORS).toContain(b.color)
    }
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
    const v = flingVelocity([{ x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 100 }], 100)
    expect(v.vx).toBeCloseTo(16.67, 1)
    expect(v.vy).toBeCloseTo(0)
  })

  it('ignores samples older than the window', () => {
    const v = flingVelocity([
      { x: 0, y: 0, t: 0 },
      { x: 300, y: 0, t: 900 },
      { x: 310, y: 0, t: 950 },
    ], 1000)
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

describe('attachedFrame', () => {
  const big = { x: 200, y: 400, size: 120 }
  const rim = { size: 60, mode: 'rim' as const, dx: 1, dy: 0 }

  it('at contact sits exactly tangent on the rim', () => {
    const f = attachedFrame(rim, big, 0)
    expect(f.x).toBeCloseTo(290)
    expect(f.size).toBe(60)
    expect(f.wobble).toBe(0)
  })

  it('presses in by PRESS_IN of its radius by the end of the stick phase', () => {
    const f = attachedFrame(rim, big, STICK_END)
    expect(f.x).toBeCloseTo(200 + 60 + 30 * (1 - PRESS_IN))
  })

  it('wobbles during the wobble phase without moving or shrinking', () => {
    const f = attachedFrame(rim, big, (STICK_END + MERGE_START) / 2)
    expect(f.wobble).toBeGreaterThan(0)
    expect(f.size).toBe(60)
    expect(f.x).toBeCloseTo(200 + 60 + 30 * (1 - PRESS_IN))
  })

  it('flows to the centre and shrinks to nothing during the merge phase', () => {
    const mid = attachedFrame(rim, big, (MERGE_START + 1) / 2)
    expect(mid.x).toBeLessThan(290)
    expect(mid.x).toBeGreaterThan(200)
    expect(mid.size).toBeLessThan(60)
    const end = attachedFrame(rim, big, 1)
    expect(end.x).toBeCloseTo(200)
    expect(end.size).toBeCloseTo(0)
  })

  it('offset mode keeps the blob where it touched, regardless of the big size', () => {
    const off = { size: 60, mode: 'offset' as const, dx: -45, dy: 10 }
    const f = attachedFrame(off, { x: 200, y: 400, size: 0 }, 0.5)
    expect(f.x).toBeCloseTo(155)
    expect(f.y).toBeCloseTo(410)
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
    for (let i = 0; i < 300; i++) list = step(list, i * 16, { w: 100000, h: 100000 }).blobs
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

describe('stepBlobs: clusters touch exactly', () => {
  it('snaps two colliding blobs to tangent contact and averages their velocity', () => {
    const a = blob({ id: 1, x: 100, y: 100, vx: 2, vy: 0, size: 60 })
    const b = blob({ id: 2, x: 140, y: 100, vx: 0, vy: 2, size: 50 })
    const { blobs: r } = step([a, b], 0)
    expect(dist(r[0], r[1])).toBeCloseTo(55, 5)
    expect(r[0].clusterId).not.toBeNull()
    expect(r[0].clusterId).toBe(r[1].clusterId)
    expect(r[0].vx).toBeCloseTo(1)
    expect(r[0].vy).toBeCloseTo(1)
    expect(r[0].clusterUntil).toBeGreaterThanOrEqual(2000)
    expect(r[0].clusterUntil).toBeLessThanOrEqual(3000)
  })

  it('keeps the contact exact for a hundred frames, even with the pointer nearby', () => {
    let list = [
      blob({ id: 1, x: 100, y: 100, vx: 2, vy: 0 }),
      blob({ id: 2, x: 140, y: 100, vx: 0, vy: 2 }),
    ]
    for (let i = 0; i < 100; i++) {
      list = step(list, i * 16, { w: 100000, h: 100000, pointer: { x: list[0].x - 40, y: list[0].y } }).blobs
      expect(dist(list[0], list[1])).toBeCloseTo(60, 5)
    }
  })

  it('snaps a joiner onto the member it hit and keeps every existing contact', () => {
    const a = blob({ id: 1, x: 100, y: 100, clusterId: 1, clusterUntil: 9999, vx: 0, vy: 0 })
    const b = blob({ id: 2, x: 160, y: 100, clusterId: 1, clusterUntil: 9999, vx: 0, vy: 0 })
    const c = blob({ id: 3, x: 205, y: 100, vx: 0, vy: 0 })
    const { blobs: r } = step([a, b, c], 0)
    expect(r[2].clusterId).toBe(1)
    expect(dist(r[1], r[2])).toBeCloseTo(60, 5)
    expect(dist(r[0], r[1])).toBeCloseTo(60, 5)
  })

  it('expires a cluster when now >= clusterUntil', () => {
    const a = blob({ id: 1, x: 100, clusterId: 1, clusterUntil: 500 })
    const b = blob({ id: 2, x: 300, clusterId: 1, clusterUntil: 500 })
    const { blobs: r } = step([a, b], 1000)
    expect(r[0].clusterId).toBeNull()
    expect(r[1].clusterId).toBeNull()
  })

  it('never clusters a held blob', () => {
    const a = blob({ id: 1, x: 100, y: 100, state: 'held' })
    const b = blob({ id: 2, x: 140, y: 100 })
    const { blobs: r } = step([a, b], 0)
    expect(r[0].clusterId).toBeNull()
    expect(r[1].clusterId).toBeNull()
  })
})

describe('stepBlobs: four blobs melt into a green one where they stand', () => {
  const chain = () => Array.from({ length: MERGE_AT }, (_, i) =>
    blob({ id: i + 1, x: 100 + i * 60, y: 300, vx: 1, vy: 0, clusterId: 1, clusterUntil: 9999 }),
  )

  it('seeds a size-0 green blob at the area-weighted centre and keeps the members in place', () => {
    const { blobs: r, events } = step(chain(), 0)
    expect(r).toHaveLength(MERGE_AT + 1)
    const big = r.find(b => b.big)!
    expect(big.color).toBe(BIG_COLOR)
    expect(big.size).toBe(0)
    expect(big.mass).toBe(MERGE_AT)
    expect(big.x).toBeCloseTo(191)   // members moved by vx=1: 101,161,221,281
    expect(big.y).toBeCloseTo(300)
    const members = r.filter(b => !b.big)
    for (const [i, m] of members.entries()) {
      expect(m.state).toBe('merging')
      expect(m.absorbingInto).toBe(big.id)
      expect(m.absorbFrom?.mode).toBe('offset')
      expect(m.x).toBeCloseTo(101 + i * 60)
      expect(m.clusterId).toBeNull()
    }
    expect(events).toContainEqual(expect.objectContaining({ type: 'merge' }))
  })

  it('members ride with the green seed and keep their mutual contact until MERGE_START', () => {
    let list = step(chain(), 0).blobs
    list = list.map(b => b.big ? { ...b, vx: 0, vy: 3 } : b)
    const t = ABSORB_MS * ((STICK_END + MERGE_START) / 2)
    list = step(list, t).blobs
    const big = list.find(b => b.big)!
    const members = list.filter(b => !b.big)
    for (const m of members) expect(m.y).toBeCloseTo(big.y)
    expect(dist(members[0], members[1])).toBeCloseTo(60, 5)
    expect(members[0].wobble).toBeGreaterThan(0)
    expect(big.wobble).toBeGreaterThan(0)
  })

  it('conserves total area while members flow into the centre', () => {
    const list0 = step(chain(), 0).blobs
    const before = totalArea(list0)
    const list1 = step(list0, ABSORB_MS * 0.85).blobs
    expect(totalArea(list1)).toBeCloseTo(before, 3)
    const big = list1.find(b => b.big)!
    expect(big.size).toBeGreaterThan(0)
    for (const m of list1.filter(b => !b.big)) {
      expect(m.size).toBeLessThan(60)
      expect(Math.abs(m.x - big.x)).toBeLessThan(Math.abs(m.absorbFrom!.dx))
    }
  })

  it('ends as a single green blob of the merged size and mass MERGE_AT', () => {
    const list0 = step(chain(), 0).blobs
    const list1 = step(list0, ABSORB_MS).blobs
    expect(list1).toHaveLength(1)
    expect(list1[0].big).toBe(true)
    expect(list1[0].size).toBeCloseTo(120)
    expect(list1[0].coreSize).toBeCloseTo(120)
    expect(list1[0].mass).toBe(MERGE_AT)
    expect(list1[0].wobble).toBe(0)
  })

  it('merges when a third blob joins a pair and a fourth joins in the same frame', () => {
    const a = blob({ id: 1, x: 100, y: 100, clusterId: 1, clusterUntil: 9999 })
    const b = blob({ id: 2, x: 140, y: 100, clusterId: 1, clusterUntil: 9999 })
    const c = blob({ id: 3, x: 180, y: 100 })
    const d = blob({ id: 4, x: 220, y: 100 })
    const { blobs: r } = step([a, b, c, d], 0)
    expect(r.filter(x => x.big)).toHaveLength(1)
    expect(r.filter(x => x.state === 'merging')).toHaveLength(4)
  })
})

describe('stepBlobs: big blob', () => {
  it('bounces off the left wall and stays inside', () => {
    const g = bigBlob({ id: 1, x: 50, y: 400, vx: -2, vy: 0 })
    const { blobs: [r] } = step([g], 0)
    expect(r.vx).toBe(2)
    expect(r.x).toBeGreaterThanOrEqual(60)
    expect(r.squashUntil).toBeGreaterThan(0)
    const { blobs: [r2] } = step([r], 40)
    expect(r2.squash).toBeGreaterThan(0)
  })

  it('bounces off the bottom wall', () => {
    const g = bigBlob({ id: 1, x: 200, y: 750, vx: 0, vy: 2 })
    const { blobs: [r] } = step([g], 0)
    expect(r.vy).toBe(-2)
    expect(r.y).toBeLessThanOrEqual(740)
  })

  it('does not flee from the pointer', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400 })
    const { blobs: [r] } = step([g], 0, { pointer: { x: 210, y: 400 } })
    expect(r.vx).toBe(0)
    expect(r.vy).toBe(0)
  })

  it('snaps a touching small blob onto its rim, counts its mass and takes its momentum', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400 })
    const s = blob({ id: 2, x: 280, y: 400, vx: -10, vy: 0, size: 60 })
    const { blobs: r, events } = step([g, s], 1000)
    const big = r.find(b => b.id === 1)!
    const small = r.find(b => b.id === 2)!
    expect(small.state).toBe('absorbing')
    expect(small.absorbingInto).toBe(1)
    expect(small.absorbStart).toBe(1000)
    expect(small.absorbFrom?.mode).toBe('rim')
    expect(dist(big, small)).toBeCloseTo(90, 5)
    expect(big.mass).toBe(5)
    // The flung blob is damped before contact (-10 → -9.6), then (4·0 + 1·(-9.6)) / 5
    expect(big.vx).toBeCloseTo(small.vx / 5)
    expect(big.vx).toBeCloseTo(-1.92)
    expect(events).toContainEqual(expect.objectContaining({ type: 'absorb' }))
  })

  it('a heavier big blob is deflected less by the same hit', () => {
    const light = bigBlob({ id: 1, x: 200, y: 400, mass: 4 })
    const heavy = bigBlob({ id: 1, x: 200, y: 400, mass: 10, size: 190, coreSize: 190 })
    const hit = () => blob({ id: 2, x: 280, y: 400, vx: -10, vy: 0, size: 60 })
    const l = step([light, hit()], 0).blobs.find(b => b.id === 1)!
    const h = step([heavy, hit()], 0).blobs.find(b => b.id === 1)!
    expect(Math.abs(h.vx)).toBeLessThan(Math.abs(l.vx))
  })

  it('carries the stuck blob along its rim while it drifts', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, vx: 2, vy: 0 })
    const s = blob({
      id: 2, x: 290, y: 400, size: 60, state: 'absorbing', absorbingInto: 1,
      absorbStart: 0, absorbFrom: { size: 60, mode: 'rim', dx: 0, dy: -1 },
    })
    const { blobs: r } = step([g, s], ABSORB_MS * 0.4)
    const big = r.find(b => b.id === 1)!
    const small = r.find(b => b.id === 2)!
    expect(small.x).toBeCloseTo(big.x)
    expect(small.y).toBeCloseTo(big.y - 60 - 30 * (1 - PRESS_IN))
    expect(small.wobble).toBeGreaterThan(0)
    expect(big.wobble).toBeGreaterThan(0)
  })

  it('grows by exactly the area the sinking blob gives up, frame by frame', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, mass: 5 })
    const s = blob({
      id: 2, x: 290, y: 400, size: 60, state: 'absorbing', absorbingInto: 1,
      absorbStart: 0, absorbFrom: { size: 60, mode: 'rim', dx: 1, dy: 0 },
    })
    const { blobs: r } = step([g, s], ABSORB_MS * 0.9)
    expect(totalArea(r)).toBeCloseTo(120 ** 2 + 60 ** 2, 3)
    const big = r.find(b => b.id === 1)!
    expect(big.size).toBeGreaterThan(120)
    expect(big.coreSize).toBe(120)
  })

  it('removes the absorbed blob and folds its area into the core when ABSORB_MS elapses', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, mass: 5 })
    const s = blob({
      id: 2, x: 290, y: 400, size: 60, state: 'absorbing', absorbingInto: 1,
      absorbStart: 0, absorbFrom: { size: 60, mode: 'rim', dx: 1, dy: 0 },
    })
    const { blobs: r } = step([g, s], ABSORB_MS)
    expect(r).toHaveLength(1)
    expect(r[0].mass).toBe(5)
    expect(r[0].coreSize).toBeCloseTo(mergedSize([120, 60]))
    expect(r[0].size).toBeCloseTo(mergedSize([120, 60]))
  })

  it('frees a stuck blob whose big blob vanished', () => {
    const s = blob({
      id: 2, x: 290, y: 400, size: 60, state: 'absorbing', absorbingInto: 99,
      absorbStart: 0, absorbFrom: { size: 60, mode: 'rim', dx: 1, dy: 0 },
    })
    const { blobs: [r] } = step([s], 100)
    expect(r.state).toBe('free')
    expect(r.absorbingInto).toBeNull()
  })

  it('a held big blob still swallows a free small one, but stays put', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, state: 'held', vx: 0, vy: 0 })
    const s = blob({ id: 2, x: 280, y: 400, vx: -3, vy: 0, size: 60 })
    const { blobs: r } = step([g, s], 0)
    const big = r.find(b => b.id === 1)!
    const small = r.find(b => b.id === 2)!
    expect(small.state).toBe('absorbing')
    expect(big.state).toBe('held')
    expect(big.x).toBe(200)
    expect(big.mass).toBe(5)
  })

  it('two held blobs never interact', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, state: 'held' })
    const s = blob({ id: 2, x: 250, y: 400, size: 60, state: 'held' })
    const { blobs: r } = step([g, s], 0)
    expect(r.find(b => b.id === 2)!.state).toBe('held')
  })

  it('does not absorb a held blob', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400 })
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

  it('jitters position only while shaking', () => {
    const calm = step([bigBlob({ id: 1, mass: 5 })], 0).blobs[0]
    expect(calm.jitterX).toBe(0)
    const shaky = Array.from({ length: 10 }, () => step([bigBlob({ id: 1, mass: BURST_AT - 1 })], 0).blobs[0])
    expect(shaky.some(b => b.jitterX !== 0 || b.jitterY !== 0)).toBe(true)
    for (const b of shaky) expect(Math.abs(b.jitterX)).toBeLessThanOrEqual(b.shake)
  })

  it('arms the burst timer when mass reaches BURST_AT and nothing is still sinking in', () => {
    const { blobs: [r] } = step([bigBlob({ id: 1, mass: BURST_AT })], 5000)
    expect(r.burstAt).toBe(5000 + BURST_DELAY)
  })

  it('waits for the last blob to sink in before arming the burst', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, mass: BURST_AT })
    const s = blob({
      id: 2, x: 290, y: 400, size: 60, state: 'absorbing', absorbingInto: 1,
      absorbStart: 0, absorbFrom: { size: 60, mode: 'rim', dx: 1, dy: 0 },
    })
    const { blobs: r } = step([g, s], 100)
    expect(r.find(b => b.id === 1)!.burstAt).toBeNull()
  })

  it('bursts into BURST_AT small blobs flying outward once the timer fires', () => {
    const g = bigBlob({ id: 1, x: 200, y: 400, mass: BURST_AT, size: 200, coreSize: 200, burstAt: 5000 })
    const { blobs: r, events } = step([g], 5000)
    expect(r).toHaveLength(BURST_AT)
    expect(events).toContainEqual(expect.objectContaining({ type: 'burst', x: 200, y: 400 }))
    for (const d of r) {
      expect(d.state).toBe('burst')
      expect(d.big).toBe(false)
      expect(d.color).not.toBe(BIG_COLOR)
      const dot = d.vx * (d.x - 200) + d.vy * (d.y - 400)
      expect(dot).toBeGreaterThanOrEqual(0)
      expect(Math.hypot(d.vx, d.vy)).toBeGreaterThan(CRUISE_MAX * 2)
    }
    expect(new Set(r.map(d => d.id)).size).toBe(BURST_AT)
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
    const { blobs: [r] } = step([b], 0, { pointer: { x: 230, y: 400 } })
    expect(r.vx).toBeLessThan(0)
    expect(r.vy).toBeCloseTo(0)
  })

  it('ignores a pointer outside FLEE_RADIUS', () => {
    const b = blob({ id: 1, x: 200, y: 400, vx: 0, vy: 0 })
    const { blobs: [r] } = step([b], 0, { pointer: { x: 200 + FLEE_RADIUS + 5, y: 400 } })
    expect(r.vx).toBe(0)
  })

  it('never flees faster than the flee cap', () => {
    let list = [blob({ id: 1, x: 200, y: 400, vx: 0, vy: 0 })]
    for (let i = 0; i < 60; i++) {
      list = step(list, i * 16, { w: 100000, h: 100000, pointer: { x: list[0].x + 10, y: 400 } }).blobs
    }
    expect(Math.hypot(list[0].vx, list[0].vy)).toBeLessThanOrEqual(CRUISE_MAX * 2 + 0.01)
  })
})

describe('MAX_BLOBS', () => {
  it('is 8', () => {
    expect(MAX_BLOBS).toBe(8)
  })
})
