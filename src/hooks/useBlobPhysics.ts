import { useCallback, useEffect, useRef, useState } from 'react'
import {
  initBlob, isOffScreen, spawnFromEdge, stepBlobs, flingVelocity,
  MAX_BLOBS, CRUISE_MAX,
  type BlobParticle, type PointerSample,
} from './blobPhysics'
import { playBlee, playWii, playPop } from '../lib/blobSounds'

export type { BlobParticle }

/** Rzut wolniejszy niż to nie robi „łiii" — blob tylko wyślizguje się spod palca. */
const WII_MIN_SPEED = CRUISE_MAX * 2
/** Ile ostatnich pozycji palca pamiętamy do wyliczenia prędkości rzutu. */
const SAMPLE_KEEP = 10

/**
 * Trzymany blob. Mały skacze środkiem pod palec; duży jedzie z zachowanym
 * przesunięciem od miejsca dotknięcia (offX/offY = środek − palec), bo skok
 * dwustupikselowego ciała pod palec wyglądałby jak teleport.
 */
type Held = { id: number; samples: PointerSample[]; offX: number; offY: number; big: boolean }

function lookAt(dx: number, dy: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy)
  return d < 1 ? { x: 0, y: 0 } : { x: dx / d, y: dy / d }
}

export type BlobControls = {
  blobs: BlobParticle[]
  /** Warstwa, w której żyją bloby; wyznacza ściany i układ współrzędnych. */
  layerRef: React.RefObject<HTMLDivElement | null>
  /** Złap bloba pod palcem. Zwraca false, gdy tego nie da się złapać (wchłaniany, odłamek…). */
  grab: (id: number, x: number, y: number) => boolean
  drag: (x: number, y: number) => void
  release: () => void
  /** Pozycja kursora nad warstwą (desktop) — wolne bloby przed nim uciekają. */
  setPointer: (p: { x: number; y: number } | null) => void
}

export function useBlobPhysics(): BlobControls {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const [blobs, setBlobs] = useState<BlobParticle[]>(() =>
    Array.from({ length: MAX_BLOBS }, (_, i) =>
      initBlob(i, window.innerWidth, window.innerHeight),
    ),
  )
  const nextId = useRef(MAX_BLOBS)
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const pendingSpawns = useRef(0)
  // Mirror of blobs state — kept in sync so the rAF loop and pointer handlers can
  // read current blobs without a stale closure and without triggering re-renders.
  const blobsRef = useRef<BlobParticle[]>(blobs)
  const heldRef = useRef<Held | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  const commit = (next: BlobParticle[]) => {
    blobsRef.current = next
    setBlobs(next)
  }

  const size = () => {
    const el = layerRef.current
    return el && el.clientWidth > 0
      ? { w: el.clientWidth, h: el.clientHeight }
      : { w: window.innerWidth, h: window.innerHeight }
  }

  useEffect(() => {
    let animId: number
    const timeouts = timeoutsRef.current

    const step = () => {
      const now = Date.now()
      const { w, h } = size()

      const { blobs: stepped, events } = stepBlobs(blobsRef.current, now, {
        w, h, pointer: pointerRef.current, allocId: () => ++nextId.current,
      })
      const alive = stepped.filter(b => !isOffScreen(b, w, h))
      commit(alive)

      for (const e of events) if (e.type === 'burst') playPop()

      // Trzymany blob wyciągnięty za ekran znika jak każdy inny — palec zostaje z niczym.
      if (heldRef.current && !alive.some(b => b.id === heldRef.current!.id)) heldRef.current = null

      // Uzupełnij pulę do MAX_BLOBS. Odłamki po wybuchu tylko przelatują, nie liczą się.
      const population = alive.filter(b => b.state !== 'burst').length + pendingSpawns.current
      for (let i = population; i < MAX_BLOBS; i++) {
        pendingSpawns.current++
        const t = setTimeout(() => {
          timeouts.delete(t)
          pendingSpawns.current--
          const { w, h } = size()
          commit([...blobsRef.current, spawnFromEdge(++nextId.current, w, h)])
        }, 1000 + Math.random() * 1000)
        timeouts.add(t)
      }

      animId = requestAnimationFrame(step)
    }

    animId = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(animId)
      timeouts.forEach(clearTimeout)
      timeouts.clear()
    }
  }, [])

  const grab = useCallback((id: number, x: number, y: number): boolean => {
    if (heldRef.current) return false
    const target = blobsRef.current.find(b => b.id === id)
    if (!target || target.state !== 'free') return false
    const offX = target.big ? target.x - x : 0
    const offY = target.big ? target.y - y : 0
    heldRef.current = { id, samples: [{ x, y, t: Date.now() }], offX, offY, big: target.big }
    commit(blobsRef.current.map(b => b.id === id
      ? {
        ...b, x: x + offX, y: y + offY, vx: 0, vy: 0, state: 'held',
        clusterId: null, clusterUntil: 0, look: lookAt(-offX, -offY),
      }
      : b))
    // Im cięższy, tym niższy głosik.
    playBlee(Math.max(0.3, 1 / Math.sqrt(target.mass)))
    return true
  }, [])

  const drag = useCallback((x: number, y: number) => {
    const held = heldRef.current
    if (!held) return
    held.samples.push({ x, y, t: Date.now() })
    if (held.samples.length > SAMPLE_KEEP) held.samples.shift()
    commit(blobsRef.current.map(b => b.id === held.id
      ? { ...b, x: x + held.offX, y: y + held.offY, look: lookAt(-held.offX, -held.offY) }
      : b))
  }, [])

  const release = useCallback(() => {
    const held = heldRef.current
    if (!held) return
    heldRef.current = null
    const fling = flingVelocity(held.samples, Date.now())
    const target = blobsRef.current.find(b => b.id === held.id)
    // Ciężki leci ospale: ten sam ruch palca daje prędkość podzieloną przez pierwiastek z masy.
    const k = target ? 1 / Math.sqrt(target.mass) : 1
    const vx = fling.vx * k, vy = fling.vy * k
    commit(blobsRef.current.map(b => b.id === held.id ? { ...b, vx, vy, state: 'free', look: { x: 0, y: 0 } } : b))
    if (Math.hypot(vx, vy) >= WII_MIN_SPEED) playWii()
  }, [])

  const setPointer = useCallback((p: { x: number; y: number } | null) => {
    pointerRef.current = p
  }, [])

  return { blobs, layerRef, grab, drag, release, setPointer }
}
