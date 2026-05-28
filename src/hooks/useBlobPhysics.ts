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
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    let animId: number

    const step = () => {
      const now = Date.now()
      const w = window.innerWidth
      const h = window.innerHeight

      setBlobs(prev => {
        const stepped = stepBlobs(prev, now)

        return stepped.filter(b => {
          if (!isOffScreen(b, w, h)) return true

          // Schedule a replacement blob to enter from an edge
          const delay = Math.random() * 2000
          const t = setTimeout(() => {
            const id = ++nextId.current
            setBlobs(curr => [
              ...curr.filter(x => x.id !== b.id),
              spawnFromEdge(id, window.innerWidth, window.innerHeight),
            ])
          }, delay)
          timeoutsRef.current.push(t)
          return false
        })
      })

      animId = requestAnimationFrame(step)
    }

    animId = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(animId)
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return blobs
}
