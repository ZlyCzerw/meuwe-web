import { C } from '../lib/tokens'

export const BLOB_COLORS = [C.primary, C.sky, C.grass, C.sunshine, C.berry] as const
/** Kolor dużego bloba po zlaniu. */
export const BIG_COLOR: string = C.grass

/** Ile blobów naraz na ekranie (duży zielony liczy się jako jeden, odłamki po wybuchu nie). */
export const MAX_BLOBS = 8
/** Klaster tej wielkości zlewa się w jednego dużego. */
export const MERGE_AT = 4
/** Od tej masy duży zaczyna się trząść… */
export const SHAKE_FROM = 9
/** …a przy tej wybucha na tyle małych. */
export const BURST_AT = 12
/** Ile ms narastającego trzęsienia między dojściem do BURST_AT a wybuchem. */
export const BURST_DELAY = 600
/** Ile ms trwa wpadanie małego bloba w dużego. */
export const ABSORB_MS = 400

/** Tempo dryfu (px/klatkę). Rzucone i uciekające bloby wracają do tego zakresu. */
export const CRUISE_MIN = 1.2
export const CRUISE_MAX = 2
/** Górny limit prędkości nadanej rzutem (px/klatkę). */
export const FLING_MAX = 30
/** Ile ostatnich ms ruchu palca liczy się do prędkości rzutu. */
export const FLING_WINDOW_MS = 80
/** Mnożnik prędkości w każdej klatce, gdy blob leci szybciej niż dryf. */
const DAMPING = 0.96

/** Ucieczka spod kursora (desktop): zasięg, siła i limit prędkości. */
export const FLEE_RADIUS = 90
export const FLEE_ACCEL = 0.35
export const FLEE_MAX = CRUISE_MAX * 2

const BOUNCE_SQUASH_MS = 120
const ABSORB_BUMP_MS = 250
const MS_PER_FRAME = 1000 / 60

export type BlobState = 'free' | 'held' | 'absorbing' | 'burst'

export type BlobParticle = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  blobIdx: number
  clusterId: number | null
  clusterUntil: number
  state: BlobState
  /** Ile małych blobów w sobie ma; 1 dla małego. Waży przy zderzeniach. */
  mass: number
  big: boolean
  absorbingInto: number | null
  absorbStart: number
  absorbFrom: { x: number; y: number; size: number } | null
  /** Moment wybuchu, ustawiany gdy masa dojdzie do BURST_AT. */
  burstAt: number | null
  /** Amplituda drżenia w px (tylko duży, rośnie z masą). */
  shake: number
  /** Do kiedy duży jest spłaszczony po odbiciu od ściany. */
  squashUntil: number
  /** Do kiedy duży „oddycha" po wchłonięciu. */
  bumpUntil: number
  /** Przesunięcie z drżenia na tę klatkę, gotowe do narysowania. */
  jitterX: number
  jitterY: number
  /** Poza dużego na tę klatkę: oddech po wchłonięciu albo przysiad po odbiciu. */
  pose: 'normal' | 'bump' | 'squash'
}

export type BlobEnv = {
  w: number
  h: number
  /** Kursor nad warstwą (tylko desktop z prawdziwym hoverem), inaczej null. */
  pointer: { x: number; y: number } | null
}

export type BlobEvent =
  | { type: 'merge' }
  | { type: 'absorb' }
  | { type: 'burst'; x: number; y: number }

export type PointerSample = { x: number; y: number; t: number }

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randomColor(): string {
  return BLOB_COLORS[Math.floor(Math.random() * BLOB_COLORS.length)]
}

function base(id: number, size: number): Omit<BlobParticle, 'x' | 'y' | 'vx' | 'vy'> {
  return {
    id,
    size,
    color: randomColor(),
    blobIdx: Math.floor(Math.random() * 3),
    clusterId: null,
    clusterUntil: 0,
    state: 'free',
    mass: 1,
    big: false,
    absorbingInto: null,
    absorbStart: 0,
    absorbFrom: null,
    burstAt: null,
    shake: 0,
    squashUntil: 0,
    bumpUntil: 0,
    jitterX: 0,
    jitterY: 0,
    pose: 'normal',
  }
}

export function initBlob(id: number, w: number, h: number): BlobParticle {
  const size = Math.round(rand(44, 72))
  const angle = Math.random() * Math.PI * 2
  const speed = rand(CRUISE_MIN, CRUISE_MAX)
  return {
    ...base(id, size),
    x: rand(size, w - size),
    y: rand(size, h - size),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  }
}

export function spawnFromEdge(id: number, w: number, h: number): BlobParticle {
  const size = Math.round(rand(44, 72))
  const edge = Math.floor(Math.random() * 4)
  let x: number, y: number
  switch (edge) {
    case 0:  x = rand(0, w);    y = -size;      break
    case 1:  x = w + size;      y = rand(0, h); break
    case 2:  x = rand(0, w);    y = h + size;   break
    default: x = -size;         y = rand(0, h); break
  }
  const toCentreAngle = Math.atan2(h / 2 - y, w / 2 - x)
  const spread = (Math.random() - 0.5) * (Math.PI / 3)
  const speed = rand(CRUISE_MIN, CRUISE_MAX)
  return {
    ...base(id, size),
    x, y,
    vx: Math.cos(toCentreAngle + spread) * speed,
    vy: Math.sin(toCentreAngle + spread) * speed,
  }
}

export function isOffScreen(blob: BlobParticle, w: number, h: number): boolean {
  return (
    blob.x < -blob.size ||
    blob.x > w + blob.size ||
    blob.y < -blob.size ||
    blob.y > h + blob.size
  )
}

export function checkCollision(a: BlobParticle, b: BlobParticle): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy) < (a.size + b.size) / 2
}

/** Średnica bloba o polu równym sumie pól podanych. */
export function mergedSize(sizes: number[]): number {
  return Math.sqrt(sizes.reduce((acc, s) => acc + s * s, 0))
}

/**
 * Prędkość rzutu z historii pozycji palca (px/klatkę). Liczy się tylko końcówka
 * ruchu: palec, który zatrzymał się przed puszczeniem, nie rzuca wcale.
 */
export function flingVelocity(samples: PointerSample[], now: number): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 }
  const last = samples[samples.length - 1]
  if (now - last.t > FLING_WINDOW_MS) return { vx: 0, vy: 0 }
  let recent = samples.filter(s => s.t >= now - FLING_WINDOW_MS)
  if (recent.length < 2) recent = samples.slice(-2)
  const first = recent[0]
  const dt = last.t - first.t
  if (dt <= 0) return { vx: 0, vy: 0 }
  let vx = ((last.x - first.x) / dt) * MS_PER_FRAME
  let vy = ((last.y - first.y) / dt) * MS_PER_FRAME
  const speed = Math.hypot(vx, vy)
  if (speed > FLING_MAX) {
    vx = (vx / speed) * FLING_MAX
    vy = (vy / speed) * FLING_MAX
  }
  return { vx, vy }
}

function unpair(blob: BlobParticle): BlobParticle {
  return {
    ...blob,
    vx: blob.vx + (Math.random() - 0.5) * 0.8,
    vy: blob.vy + (Math.random() - 0.5) * 0.8,
    clusterId: null,
    clusterUntil: 0,
  }
}

function collidable(b: BlobParticle): boolean {
  return b.state === 'free'
}

/** Rzucony blob zwalnia do tempa dryfu, ale nigdy poniżej niego. */
function damp(b: BlobParticle): BlobParticle {
  const speed = Math.hypot(b.vx, b.vy)
  if (speed <= CRUISE_MAX) return b
  const target = Math.max(speed * DAMPING, CRUISE_MAX)
  const k = target / speed
  return { ...b, vx: b.vx * k, vy: b.vy * k }
}

function flee(b: BlobParticle, pointer: { x: number; y: number }): BlobParticle {
  const dx = b.x - pointer.x
  const dy = b.y - pointer.y
  const d = Math.hypot(dx, dy)
  if (d >= FLEE_RADIUS || d === 0) return b
  const before = Math.hypot(b.vx, b.vy)
  const a = FLEE_ACCEL * (1 - d / FLEE_RADIUS)
  let vx = b.vx + (dx / d) * a
  let vy = b.vy + (dy / d) * a
  const speed = Math.hypot(vx, vy)
  const cap = Math.max(FLEE_MAX, before)
  if (speed > cap) {
    vx = (vx / speed) * cap
    vy = (vy / speed) * cap
  }
  return { ...b, vx, vy }
}

function bounceWalls(b: BlobParticle, w: number, h: number, now: number): BlobParticle {
  const r = b.size / 2
  let { x, y, vx, vy, squashUntil } = b
  let hit = false
  if (x - r < 0 && vx < 0) { x = r; vx = -vx; hit = true }
  if (x + r > w && vx > 0) { x = w - r; vx = -vx; hit = true }
  if (y - r < 0 && vy < 0) { y = r; vy = -vy; hit = true }
  if (y + r > h && vy > 0) { y = h - r; vy = -vy; hit = true }
  if (hit) squashUntil = now + BOUNCE_SQUASH_MS
  return { ...b, x, y, vx, vy, squashUntil }
}

function shakeFor(mass: number, burstAt: number | null, now: number): number {
  if (mass < SHAKE_FROM) return 0
  const span = BURST_AT - SHAKE_FROM
  let amp = 1 + (Math.min(mass, BURST_AT) - SHAKE_FROM) / span * 5
  if (burstAt !== null) {
    const progress = 1 - Math.max(0, burstAt - now) / BURST_DELAY
    amp += 6 * progress
  }
  return amp
}

function burst(big: BlobParticle): BlobParticle[] {
  return Array.from({ length: BURST_AT }, (_, i) => {
    const angle = (i / BURST_AT) * Math.PI * 2 + rand(-0.2, 0.2)
    const speed = rand(CRUISE_MAX * 2.5, CRUISE_MAX * 3.5)
    const size = Math.round(rand(44, 72))
    // Odłamki są kolorowe, ale nie zielone — mają się odcinać od tego, co pękło.
    const palette = BLOB_COLORS.filter(c => c !== BIG_COLOR)
    return {
      ...base(-(big.id * 100 + i + 1), size),
      color: palette[Math.floor(Math.random() * palette.length)],
      state: 'burst' as const,
      x: big.x + Math.cos(angle) * big.size / 4,
      y: big.y + Math.sin(angle) * big.size / 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    }
  })
}

export function stepBlobs(
  blobs: BlobParticle[],
  now: number,
  env: BlobEnv,
): { blobs: BlobParticle[]; events: BlobEvent[] } {
  const events: BlobEvent[] = []
  const byId = new Map(blobs.map(b => [b.id, b]))

  // 1. Ruch. Trzymany stoi pod palcem, wchłaniany płynie do dużego, reszta dryfuje.
  let next: BlobParticle[] = []
  const growth = new Map<number, { size: number; mass: number }[]>()
  for (const b of blobs) {
    if (b.state === 'held') { next.push(b); continue }
    if (b.state === 'absorbing') {
      const target = b.absorbingInto !== null ? byId.get(b.absorbingInto) : undefined
      if (!target || !target.big || !b.absorbFrom) {
        next.push({ ...b, state: 'free', absorbingInto: null, absorbFrom: null })
        continue
      }
      const t = Math.min(1, (now - b.absorbStart) / ABSORB_MS)
      if (t >= 1) {
        const list = growth.get(target.id) ?? []
        list.push({ size: b.absorbFrom.size, mass: b.mass })
        growth.set(target.id, list)
        continue
      }
      next.push({
        ...b,
        x: b.absorbFrom.x + (target.x - b.absorbFrom.x) * t,
        y: b.absorbFrom.y + (target.y - b.absorbFrom.y) * t,
        size: b.absorbFrom.size * (1 - t),
      })
      continue
    }
    let moved: BlobParticle = { ...b, x: b.x + b.vx, y: b.y + b.vy }
    if (b.state === 'burst') { next.push(moved); continue }
    moved = damp(moved)
    if (b.big) {
      moved = bounceWalls(moved, env.w, env.h, now)
    } else if (env.pointer) {
      moved = flee(moved, env.pointer)
    }
    next.push(moved)
  }

  // 2. Duży: rośnie o to, co właśnie wchłonął; drży; wybucha.
  next = next.flatMap(b => {
    if (!b.big) return [b]
    const eaten = growth.get(b.id)
    if (eaten) {
      b = {
        ...b,
        mass: b.mass + eaten.reduce((acc, e) => acc + e.mass, 0),
        size: mergedSize([b.size, ...eaten.map(e => e.size)]),
        bumpUntil: now + ABSORB_BUMP_MS,
      }
    }
    if (b.burstAt !== null && now >= b.burstAt) {
      events.push({ type: 'burst', x: b.x, y: b.y })
      return burst(b)
    }
    const burstAt = b.burstAt ?? (b.mass >= BURST_AT ? now + BURST_DELAY : null)
    const shake = shakeFor(b.mass, burstAt, now)
    return [{
      ...b,
      burstAt,
      shake,
      jitterX: shake ? (Math.random() - 0.5) * 2 * shake : 0,
      jitterY: shake ? (Math.random() - 0.5) * 2 * shake : 0,
      pose: now < b.bumpUntil ? 'bump' : now < b.squashUntil ? 'squash' : 'normal',
    }]
  })

  // 3. Klastry wygasają.
  next = next.map(b =>
    b.clusterId !== null && now >= b.clusterUntil ? unpair(b) : b,
  )

  // 4. Zderzenia.
  const members = (cid: number) => next.filter(x => x.clusterId === cid)
  const setCluster = (ids: Set<number>, cid: number) => {
    const group = next.filter(x => ids.has(x.id))
    const vx = group.reduce((acc, x) => acc + x.vx, 0) / group.length
    const vy = group.reduce((acc, x) => acc + x.vy, 0) / group.length
    const clusterUntil = now + rand(2000, 3000)
    next = next.map(x => ids.has(x.id) ? { ...x, vx, vy, clusterId: cid, clusterUntil } : x)
  }
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i], b = next[j]
      if (!collidable(a) || !collidable(b) || !checkCollision(a, b)) continue

      if (a.big || b.big) {
        // Mniejszy wpada w większego; większy przejmuje pęd proporcjonalnie do mas.
        const [big, small] = (a.big && b.big ? a.size >= b.size : a.big) ? [a, b] : [b, a]
        const bi = big === a ? i : j
        const si = small === a ? i : j
        const total = big.mass + small.mass
        next[bi] = {
          ...big,
          vx: (big.mass * big.vx + small.mass * small.vx) / total,
          vy: (big.mass * big.vy + small.mass * small.vy) / total,
        }
        next[si] = {
          ...small,
          state: 'absorbing',
          absorbingInto: big.id,
          absorbStart: now,
          absorbFrom: { x: small.x, y: small.y, size: small.size },
          clusterId: null,
          clusterUntil: 0,
        }
        events.push({ type: 'absorb' })
        continue
      }

      if (a.clusterId !== null && a.clusterId === b.clusterId) continue
      const ids = new Set<number>([a.id, b.id])
      if (a.clusterId !== null) members(a.clusterId).forEach(m => ids.add(m.id))
      if (b.clusterId !== null) members(b.clusterId).forEach(m => ids.add(m.id))
      const cid = a.clusterId ?? b.clusterId ?? Math.min(a.id, b.id)
      setCluster(ids, cid)
    }
  }

  // 5. Klaster MERGE_AT zlewa się w jednego dużego zielonego.
  const clusters = new Map<number, BlobParticle[]>()
  for (const b of next) {
    if (b.clusterId === null || b.big) continue
    const list = clusters.get(b.clusterId) ?? []
    list.push(b)
    clusters.set(b.clusterId, list)
  }
  for (const group of clusters.values()) {
    if (group.length < MERGE_AT) continue
    const n = group.length
    const ids = new Set(group.map(g => g.id))
    const big: BlobParticle = {
      ...base(Math.min(...group.map(g => g.id)), mergedSize(group.map(g => g.size))),
      color: BIG_COLOR,
      big: true,
      mass: group.reduce((acc, g) => acc + g.mass, 0),
      x: group.reduce((acc, g) => acc + g.x, 0) / n,
      y: group.reduce((acc, g) => acc + g.y, 0) / n,
      vx: group.reduce((acc, g) => acc + g.vx, 0) / n,
      vy: group.reduce((acc, g) => acc + g.vy, 0) / n,
      bumpUntil: now + ABSORB_BUMP_MS,
    }
    next = [...next.filter(b => !ids.has(b.id)), big]
    events.push({ type: 'merge' })
  }

  return { blobs: next, events }
}
