import { BLOBS, INK } from '../lib/tokens'
import BlobFace, { type BlobMood } from './BlobFace'
import { BURST_AT, MERGE_START, isAttached, type BlobParticle } from '../hooks/blobPhysics'

/**
 * Ścieżki blobów (BLOBS) mieszczą się w ~90 jednostkach ze 106 viewBoxa OrganicBlob,
 * więc żeby fizyczna średnica `size` była też widoczną, OrganicBlob dostaje
 * size × VISUAL_SCALE, a tu ścieżka jest skalowana przez size / BODY_UNITS.
 * Bez tego bloby „stykające się" w fizyce miałyby między sobą szczelinę.
 */
export const BODY_UNITS = 90
export const VISUAL_SCALE = 106 / BODY_UNITS

/** Jak mocno faluje powierzchnia przy pełnej amplitudzie: ściśnięcie i obrót. */
const WOBBLE_SQUASH = 0.11
const WOBBLE_ROT = 7
const WOBBLE_HZ = 3.5

function strokeUnits(size: number): number {
  return size <= 80 ? 5 : Math.max(2.5, 5 * 72 / size)
}

type Shape = {
  key: number
  d: string
  color: string
  transform: string
  faceTransform: string
  stroke: number
  face: { size: number; opacity: number; mood: BlobMood; look?: { x: number; y: number } } | null
}

/**
 * Duży zielony i wszystko, co jest do niego przyklejone, rysowane jako jedna ciecz.
 * Filtr goo (rozmycie + próg alfa) skleja stykające się kształty meniskiem, więc
 * sklejanie, falowanie i wpływanie wyglądają jak ciecz, a nie jak nakładające się
 * kółka. Dwa przebiegi: sylwetka w kolorze obrysu, na niej wypełnienia — kreska
 * obiega całość. Buźki nad filtrem, żeby ich nie rozmywał.
 */
export default function BlobLiquid({ blobs }: { blobs: BlobParticle[] }) {
  if (blobs.length === 0) return null
  const bigs = new Map(blobs.filter(b => b.big).map(b => [b.id, b]))
  // Duży faluje w rytmie tego, co w niego wpływa.
  const bigPhase = new Map<number, number>()
  for (const b of blobs) {
    if (isAttached(b) && b.absorbingInto !== null) {
      bigPhase.set(b.absorbingInto, Math.max(bigPhase.get(b.absorbingInto) ?? 0, b.absorbT))
    }
  }

  const shapes: Shape[] = []
  for (const b of blobs) {
    if (b.size < 0.5) continue
    const big = b.big ? b : (b.absorbingInto !== null ? bigs.get(b.absorbingInto) : undefined)
    const jx = big?.jitterX ?? 0
    const jy = big?.jitterY ?? 0
    const phase = b.big ? (bigPhase.get(b.id) ?? 0) : b.absorbT
    const sq = b.wobble * WOBBLE_SQUASH * Math.sin(phase * Math.PI * 2 * WOBBLE_HZ + b.id)
    const rot = b.wobble * WOBBLE_ROT * Math.sin(phase * Math.PI * 2 * WOBBLE_HZ * 0.7 + b.id * 1.7)
    const wall = b.big ? 1 - 0.08 * b.squash : 1
    const scale = b.size / BODY_UNITS
    const place = `translate(${b.x + jx} ${b.y + jy})`
    const wobble = `scale(${1 + sq} ${1 - sq}) rotate(${rot})`
    const transform = `${place} scale(${scale * wall}) ${wobble}`
    const faceTransform = `${place} ${wobble}`

    // Buźka małego gaśnie w pierwszej połowie wpływania; duży dostaje ją, gdy już coś widać.
    const fade = b.big
      ? (b.size > 24 ? 1 : 0)
      : (b.absorbT < MERGE_START ? 1 : Math.max(0, 1 - (b.absorbT - MERGE_START) / (1 - MERGE_START) * 2))
    // Trzymany duży robi wielkie oczy i patrzy na palec; przy masie do wybuchu — zaskoczenie.
    const mood: BlobMood = b.big && b.state === 'held' ? 'startled'
      : b.big && b.mass >= BURST_AT ? 'surprised' : 'happy'
    const face: Shape['face'] = fade > 0
      ? { size: b.size * 0.65, opacity: fade, mood, look: mood === 'startled' ? b.look : undefined }
      : null
    shapes.push({ key: b.id, d: BLOBS[b.blobIdx % BLOBS.length], color: b.color, transform, faceTransform, stroke: strokeUnits(b.size) * 2, face })
  }

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        overflow: 'visible', pointerEvents: 'none', zIndex: 1,
        filter: `drop-shadow(0 3px 0 ${INK}22)`,
      }}
    >
      <defs>
        <filter id="blob-goo" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
        </filter>
      </defs>
      <g filter="url(#blob-goo)">
        {shapes.map(s => (
          <path key={s.key} d={s.d} fill={INK} stroke={INK} strokeWidth={s.stroke} strokeLinejoin="round"
            transform={`${s.transform} translate(-50 -50)`} />
        ))}
      </g>
      <g filter="url(#blob-goo)">
        {shapes.map(s => (
          <path key={s.key} d={s.d} fill={s.color} transform={`${s.transform} translate(-50 -50)`} />
        ))}
      </g>
      {shapes.map(s => s.face && (
        <g key={s.key} transform={`${s.faceTransform} translate(${-s.face.size / 2} ${-s.face.size * 0.45})`}
          opacity={s.face.opacity}>
          <BlobFace size={s.face.size} mood={s.face.mood} look={s.face.look} />
        </g>
      ))}
    </svg>
  )
}
