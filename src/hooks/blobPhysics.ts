import { C } from '../lib/tokens'

export const BLOB_COLORS = [C.primary, C.sky, C.grass, C.sunshine, C.berry] as const

export type BlobParticle = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  blobIdx: number
  pairedWith: number | null
  pairedUntil: number
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function initBlob(id: number, w: number, h: number): BlobParticle {
  const size = Math.round(rand(44, 72))
  const angle = Math.random() * Math.PI * 2
  const speed = rand(1.2, 2)
  return {
    id,
    x: rand(size, w - size),
    y: rand(size, h - size),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    color: BLOB_COLORS[Math.floor(Math.random() * BLOB_COLORS.length)],
    size,
    blobIdx: Math.floor(Math.random() * 3),
    pairedWith: null,
    pairedUntil: 0,
  }
}

export function spawnFromEdge(id: number, w: number, h: number): BlobParticle {
  const size = Math.round(rand(44, 72))
  const edge = Math.floor(Math.random() * 4)
  let x: number, y: number
  switch (edge) {
    case 0:  x = rand(0, w);    y = -size;   break
    case 1:  x = w + size;      y = rand(0, h); break
    case 2:  x = rand(0, w);    y = h + size; break
    default: x = -size;         y = rand(0, h); break
  }
  const toCentreAngle = Math.atan2(h / 2 - y, w / 2 - x)
  const spread = (Math.random() - 0.5) * (Math.PI / 3)
  const speed = rand(1.2, 2)
  return {
    id,
    x, y,
    vx: Math.cos(toCentreAngle + spread) * speed,
    vy: Math.sin(toCentreAngle + spread) * speed,
    color: BLOB_COLORS[Math.floor(Math.random() * BLOB_COLORS.length)],
    size,
    blobIdx: Math.floor(Math.random() * 3),
    pairedWith: null,
    pairedUntil: 0,
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

export function resolveCollision(
  a: BlobParticle,
  b: BlobParticle,
  now: number,
): [BlobParticle, BlobParticle] {
  const avgVx = (a.vx + b.vx) / 2
  const avgVy = (a.vy + b.vy) / 2
  const pairedUntil = now + rand(2000, 3000)
  return [
    { ...a, vx: avgVx, vy: avgVy, pairedWith: b.id, pairedUntil },
    { ...b, vx: avgVx, vy: avgVy, pairedWith: a.id, pairedUntil },
  ]
}

export function unpair(blob: BlobParticle): BlobParticle {
  return {
    ...blob,
    vx: blob.vx + (Math.random() - 0.5) * 0.8,
    vy: blob.vy + (Math.random() - 0.5) * 0.8,
    pairedWith: null,
    pairedUntil: 0,
  }
}

export function stepBlobs(blobs: BlobParticle[], now: number): BlobParticle[] {
  let next = blobs.map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy }))

  // Expire pairings
  next = next.map(b =>
    b.pairedWith !== null && now >= b.pairedUntil ? unpair(b) : b
  )

  // Resolve new collisions between unpaired blobs
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i], b = next[j]
      if (a.pairedWith === null && b.pairedWith === null && checkCollision(a, b)) {
        const [ra, rb] = resolveCollision(a, b, now)
        next[i] = ra
        next[j] = rb
      }
    }
  }

  return next
}
