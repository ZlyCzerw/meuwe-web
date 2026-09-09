import { C } from '../lib/tokens'

/** Kolory małych blobów. Zielony jest zarezerwowany dla dużego po zlaniu. */
export const SMALL_COLORS = [C.primary, C.sky, C.sunshine, C.berry] as const
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

/**
 * Wchłanianie i zlewanie w trzech fazach (ułamki ABSORB_MS):
 * sklejenie — blob dociska się do brzegu; falowanie — powierzchnie drżą coraz
 * mocniej; zlanie — blob wpływa do środka i oddaje pole dużemu.
 */
export const ABSORB_MS = 1400
export const STICK_END = 0.2
export const MERGE_START = 0.65
/** Na ile promienia mały wciska się w dużego po sklejeniu (miękkie ciała). */
export const PRESS_IN = 0.12

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

const BOUNCE_SQUASH_MS = 160
const MS_PER_FRAME = 1000 / 60

export type BlobState = 'free' | 'held' | 'absorbing' | 'merging' | 'burst'

/**
 * Gdzie przyklejony blob siedzi względem dużego.
 * `rim`: na brzegu, w kierunku (dx, dy) od środka — jedzie po obwodzie, gdy duży rośnie.
 * `offset`: w stałym przesunięciu (dx, dy) — członkowie zlewającej się czwórki zostają
 * tam, gdzie się zetknęli, a zielony wyrasta między nimi.
 */
export type AbsorbFrom = { size: number; mode: 'rim' | 'offset'; dx: number; dy: number }

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
  /** Ile małych blobów w sobie ma (łącznie z tymi, które właśnie wpływają); 1 dla małego. */
  mass: number
  big: boolean
  /** Duży: średnica z pola już wchłoniętego. `size` dolicza pole oddawane w locie. */
  coreSize: number
  absorbingInto: number | null
  absorbStart: number
  absorbFrom: AbsorbFrom | null
  /** Postęp wchłaniania 0–1, do rysowania faz. */
  absorbT: number
  /** Amplituda falowania powierzchni 0–1. */
  wobble: number
  /** Moment wybuchu, ustawiany gdy masa dojdzie do BURST_AT. */
  burstAt: number | null
  /** Amplituda drżenia w px (tylko duży, rośnie z masą). */
  shake: number
  /** Przesunięcie z drżenia na tę klatkę, gotowe do narysowania. */
  jitterX: number
  jitterY: number
  /** Do kiedy duży jest spłaszczony po odbiciu od ściany… */
  squashUntil: number
  /** …i jak mocno w tej klatce (0–1). */
  squash: number
}

export type BlobEnv = {
  w: number
  h: number
  /** Kursor nad warstwą (tylko desktop z prawdziwym hoverem), inaczej null. */
  pointer: { x: number; y: number } | null
  /** Świeże id dla blobów, które powstają w kroku (zielony, odłamki). */
  allocId: () => number
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
  return SMALL_COLORS[Math.floor(Math.random() * SMALL_COLORS.length)]
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
    coreSize: size,
    absorbingInto: null,
    absorbStart: 0,
    absorbFrom: null,
    absorbT: 0,
    wobble: 0,
    burstAt: null,
    shake: 0,
    jitterX: 0,
    jitterY: 0,
    squashUntil: 0,
    squash: 0,
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

/** Przyklejony do dużego: wchłaniany albo zlewający się w czwórce. */
export function isAttached(b: BlobParticle): boolean {
  return b.state === 'absorbing' || b.state === 'merging'
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

function burst(big: BlobParticle, allocId: () => number): BlobParticle[] {
  return Array.from({ length: BURST_AT }, (_, i) => {
    const angle = (i / BURST_AT) * Math.PI * 2 + rand(-0.2, 0.2)
    const speed = rand(CRUISE_MAX * 2.5, CRUISE_MAX * 3.5)
    const size = Math.round(rand(44, 72))
    return {
      ...base(allocId(), size),
      state: 'burst' as const,
      x: big.x + Math.cos(angle) * big.size / 4,
      y: big.y + Math.sin(angle) * big.size / 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    }
  })
}

const smooth = (u: number) => u * u * (3 - 2 * u)

/**
 * Pozycja, rozmiar i falowanie przyklejonego bloba w chwili t (0–1) względem dużego.
 * Do MERGE_START siedzi tam, gdzie się skleił (dociskając się lekko), potem
 * płynie do środka i kurczy się do zera.
 */
export function attachedFrame(from: AbsorbFrom, big: { x: number; y: number; size: number }, t: number) {
  const r = from.size / 2
  const press = PRESS_IN * Math.min(1, t / STICK_END)
  let rideX: number, rideY: number
  if (from.mode === 'rim') {
    const d = Math.hypot(from.dx, from.dy) || 1
    const dist = big.size / 2 + r * (1 - press)
    rideX = big.x + (from.dx / d) * dist
    rideY = big.y + (from.dy / d) * dist
  } else {
    rideX = big.x + from.dx
    rideY = big.y + from.dy
  }
  if (t < MERGE_START) {
    const wobble = t < STICK_END ? 0 : smooth((t - STICK_END) / (MERGE_START - STICK_END))
    return { x: rideX, y: rideY, size: from.size, wobble }
  }
  const u = smooth((t - MERGE_START) / (1 - MERGE_START))
  return {
    x: rideX + (big.x - rideX) * u,
    y: rideY + (big.y - rideY) * u,
    size: from.size * (1 - u),
    wobble: 1 - u,
  }
}

export function stepBlobs(
  blobs: BlobParticle[],
  now: number,
  env: BlobEnv,
): { blobs: BlobParticle[]; events: BlobEvent[] } {
  const events: BlobEvent[] = []

  // 1. Ruch swobodnych. Trzymany stoi pod palcem, przyklejeni czekają na dużego.
  let next: BlobParticle[] = blobs.map(b => {
    if (b.state === 'held' || isAttached(b)) return b
    let moved: BlobParticle = { ...b, x: b.x + b.vx, y: b.y + b.vy }
    if (b.state === 'burst') return moved
    moved = damp(moved)
    if (b.big) moved = bounceWalls(moved, env.w, env.h, now)
    else if (env.pointer && b.clusterId === null) moved = flee(moved, env.pointer)
    return moved
  })

  // 2. Przyklejeni jadą z dużym i przechodzą fazy; oddane pole zbiera duży.
  const bigs = new Map(next.filter(b => b.big).map(b => [b.id, b]))
  const donated = new Map<number, number>()      // id dużego → pole w locie (px²)
  const finished = new Map<number, number[]>()      // id dużego → pola dokończone (px²)
  next = next.flatMap(b => {
    if (!isAttached(b)) return [b]
    const big = b.absorbingInto !== null ? bigs.get(b.absorbingInto) : undefined
    if (!big || !b.absorbFrom) {
      return [{ ...b, state: 'free' as const, absorbingInto: null, absorbFrom: null, absorbT: 0, wobble: 0 }]
    }
    const t = Math.min(1, (now - b.absorbStart) / ABSORB_MS)
    if (t >= 1) {
      finished.set(big.id, [...(finished.get(big.id) ?? []), b.absorbFrom.size ** 2])
      return []
    }
    const f = attachedFrame(b.absorbFrom, big, t)
    donated.set(big.id, (donated.get(big.id) ?? 0) + b.absorbFrom.size ** 2 - f.size ** 2)
    return [{ ...b, x: f.x, y: f.y, size: f.size, wobble: f.wobble, absorbT: t }]
  })

  // 3. Duży: rośnie o oddane pole, faluje razem z przyklejonymi, drży, wybucha.
  next = next.flatMap(b => {
    if (!b.big) return [b]
    // Masa jest już policzona w chwili styku (przy zlaniu: przy narodzinach),
    // tu dochodzi tylko pole, które przyklejony oddał do końca.
    const mass = b.mass
    const coreSize = mergedSize([b.coreSize, ...(finished.get(b.id) ?? []).map(Math.sqrt)])
    const size = Math.sqrt(coreSize ** 2 + (donated.get(b.id) ?? 0))
    const riders = next.filter(x => isAttached(x) && x.absorbingInto === b.id)
    const wobble = riders.length
      ? Math.max(...riders.map(x => x.wobble)) * Math.min(1, MERGE_AT / Math.max(mass, 1))
      : 0
    if (b.burstAt !== null && now >= b.burstAt) {
      events.push({ type: 'burst', x: b.x, y: b.y })
      return burst({ ...b, size }, env.allocId)
    }
    const burstAt = b.burstAt ?? (mass >= BURST_AT && riders.length === 0 ? now + BURST_DELAY : null)
    const shake = shakeFor(mass, burstAt, now)
    const squashLeft = Math.max(0, b.squashUntil - now) / BOUNCE_SQUASH_MS
    return [{
      ...b,
      coreSize, mass, size, wobble, burstAt, shake,
      jitterX: shake ? (Math.random() - 0.5) * 2 * shake : 0,
      jitterY: shake ? (Math.random() - 0.5) * 2 * shake : 0,
      squash: squashLeft > 0 ? Math.sin(squashLeft * Math.PI) : 0,
    }]
  })

  // 4. Klastry wygasają.
  next = next.map(b =>
    b.clusterId !== null && now >= b.clusterUntil ? unpair(b) : b,
  )

  // 5. Zderzenia. Styk jest dokładny: po zderzeniu obrysy stykają się, bez szczeliny
  //    i bez nachodzenia, a klaster jedzie z jedną prędkością, więc tak zostaje.
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
        // Mniejszy dosuwa się do brzegu większego i wpada w niego; większy
        // przejmuje pęd proporcjonalnie do mas.
        const [big, small] = (a.big && b.big ? a.size >= b.size : a.big) ? [a, b] : [b, a]
        const bi = big === a ? i : j
        const si = small === a ? i : j
        const total = big.mass + small.mass
        let dx = small.x - big.x, dy = small.y - big.y
        const d = Math.hypot(dx, dy)
        if (d === 0) { dx = 1; dy = 0 } else { dx /= d; dy /= d }
        const dist = big.size / 2 + small.size / 2
        next[bi] = {
          ...big,
          mass: total,
          vx: (big.mass * big.vx + small.mass * small.vx) / total,
          vy: (big.mass * big.vy + small.mass * small.vy) / total,
        }
        next[si] = {
          ...small,
          x: big.x + dx * dist,
          y: big.y + dy * dist,
          state: 'absorbing',
          absorbingInto: big.id,
          absorbStart: now,
          absorbFrom: { size: small.size, mode: 'rim', dx, dy },
          absorbT: 0,
          clusterId: null,
          clusterUntil: 0,
        }
        events.push({ type: 'absorb' })
        continue
      }

      if (a.clusterId !== null && a.clusterId === b.clusterId) continue
      // Dosunięcie do stycznej wzdłuż linii środków. Klaster jest sztywny: pojedynczy
      // przybysz dosuwa się cały, dwa klastry po połowie, każdy razem ze swoimi.
      let dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      if (d === 0) { dx = 1; dy = 0 } else { dx /= d; dy /= d }
      const gap = (a.size + b.size) / 2 - d
      const sideA = new Set(a.clusterId !== null ? members(a.clusterId).map(m => m.id) : [a.id])
      const sideB = new Set(b.clusterId !== null ? members(b.clusterId).map(m => m.id) : [b.id])
      const wa = a.clusterId !== null && b.clusterId === null ? 0
        : b.clusterId !== null && a.clusterId === null ? 1 : 0.5
      next = next.map(x =>
        sideA.has(x.id) ? { ...x, x: x.x - dx * gap * wa, y: x.y - dy * gap * wa }
        : sideB.has(x.id) ? { ...x, x: x.x + dx * gap * (1 - wa), y: x.y + dy * gap * (1 - wa) }
        : x)

      const ids = new Set<number>([...sideA, ...sideB])
      const cid = a.clusterId ?? b.clusterId ?? Math.min(a.id, b.id)
      setCluster(ids, cid)
    }
  }

  // 6. Klaster MERGE_AT zlewa się: zielony wyrasta w środku masy, a członkowie
  //    zostają tam, gdzie się stykają, falują i wpływają do niego.
  const clusters = new Map<number, BlobParticle[]>()
  for (const b of next) {
    if (b.clusterId === null || b.big || b.state !== 'free') continue
    const list = clusters.get(b.clusterId) ?? []
    list.push(b)
    clusters.set(b.clusterId, list)
  }
  for (const group of clusters.values()) {
    if (group.length < MERGE_AT) continue
    const n = group.length
    const area = group.reduce((acc, g) => acc + g.size ** 2, 0)
    const cx = group.reduce((acc, g) => acc + g.x * g.size ** 2, 0) / area
    const cy = group.reduce((acc, g) => acc + g.y * g.size ** 2, 0) / area
    const big: BlobParticle = {
      ...base(env.allocId(), 0),
      color: BIG_COLOR,
      big: true,
      coreSize: 0,
      size: 0,
      mass: group.reduce((acc, g) => acc + g.mass, 0),
      x: cx,
      y: cy,
      vx: group.reduce((acc, g) => acc + g.vx, 0) / n,
      vy: group.reduce((acc, g) => acc + g.vy, 0) / n,
    }
    const ids = new Set(group.map(g => g.id))
    next = [
      ...next.map(b => ids.has(b.id) ? {
        ...b,
        state: 'merging' as const,
        absorbingInto: big.id,
        absorbStart: now,
        absorbFrom: { size: b.size, mode: 'offset' as const, dx: b.x - cx, dy: b.y - cy },
        absorbT: 0,
        clusterId: null,
        clusterUntil: 0,
      } : b),
      big,
    ]
    events.push({ type: 'merge' })
  }

  return { blobs: next, events }
}
