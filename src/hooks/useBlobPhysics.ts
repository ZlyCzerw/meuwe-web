import { useEffect, useRef, useState } from 'react'
import {
  initBlob, isOffScreen, spawnFromEdge, stepBlobs,
  type BlobParticle,
} from './blobPhysics'

export type { BlobParticle }

export function useBlobPhysics(count = 6): BlobParticle[] {
  const [blobs, setBlobs] = useState<BlobParticle[]>(() =>
    Array.from({ length: count }, (_, i) =>
      initBlob(i, window.innerWidth, window.innerHeight)
    )
  )
  const nextId = useRef(count)
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  // Mirror of blobs state — kept in sync so the rAF loop can read current
  // blobs without a stale closure and without triggering re-renders.
  const blobsRef = useRef<BlobParticle[]>(blobs)

  useEffect(() => {
    let animId: number

    const step = () => {
      const now = Date.now()
      const w = window.innerWidth
      const h = window.innerHeight

      const prev = blobsRef.current
      const stepped = stepBlobs(prev, now)
      const alive = stepped.filter(b => !isOffScreen(b, w, h))
      const departed = stepped.filter(b => isOffScreen(b, w, h))

      // Update state — pure, no side-effects inside the setter
      blobsRef.current = alive
      setBlobs(alive)

      // Schedule respawns outside the setter — no React double-invocation risk
      for (const b of departed) {
        const delay = Math.random() * 2000
        const t = setTimeout(() => {
          const id = ++nextId.current
          timeoutsRef.current.delete(t)
          const next = [
            ...blobsRef.current.filter(x => x.id !== b.id),
            spawnFromEdge(id, window.innerWidth, window.innerHeight),
          ]
          blobsRef.current = next
          setBlobs(next)
        }, delay)
        timeoutsRef.current.add(t)
      }

      animId = requestAnimationFrame(step)
    }

    animId = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(animId)
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current.clear()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return blobs
}
