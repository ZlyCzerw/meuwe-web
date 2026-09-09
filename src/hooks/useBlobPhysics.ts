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

type Held = { id: number; samples: PointerSample[] }

export type BlobControls = {
  blobs: BlobParticle[]
  /** Warstwa, w której żyją bloby; wyznacza ściany i układ współrzędnych. */
  layerRef: React.RefObject<HTMLDivElement | null>
  /** Złap bloba pod palcem. Zwraca false, gdy tego nie da się złapać (duży, wchłaniany…). */
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
    if (!target || target.state !== 'free' || target.big) return false
    heldRef.current = { id, samples: [{ x, y, t: Date.now() }] }
    commit(blobsRef.current.map(b => b.id === id
      ? { ...b, x, y, vx: 0, vy: 0, state: 'held', clusterId: null, clusterUntil: 0 }
      : b))
    playBlee()
    return true
  }, [])

  const drag = useCallback((x: number, y: number) => {
    const held = heldRef.current
    if (!held) return
    held.samples.push({ x, y, t: Date.now() })
    if (held.samples.length > SAMPLE_KEEP) held.samples.shift()
    commit(blobsRef.current.map(b => b.id === held.id ? { ...b, x, y } : b))
  }, [])

  const release = useCallback(() => {
    const held = heldRef.current
    if (!held) return
    heldRef.current = null
    const { vx, vy } = flingVelocity(held.samples, Date.now())
    commit(blobsRef.current.map(b => b.id === held.id ? { ...b, vx, vy, state: 'free' } : b))
    if (Math.hypot(vx, vy) >= WII_MIN_SPEED) playWii()
  }, [])

  const setPointer = useCallback((p: { x: number; y: number } | null) => {
    pointerRef.current = p
  }, [])

  return { blobs, layerRef, grab, drag, release, setPointer }
}
