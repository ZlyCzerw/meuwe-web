# Animated Blob Physics — Welcome Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static decorative blobs on the Welcome screen with 6 physics-driven blob faces that move freely, collide, briefly travel together, and respawn when off-screen.

**Architecture:** A pure-function physics module (`blobPhysics.ts`) handles all state transitions — movement, collision, pairing, and respawn — making it fully testable without React. A thin `useBlobPhysics` hook wraps these functions in a `requestAnimationFrame` loop. `Welcome.tsx` consumes the hook and renders blobs behind the UI.

**Tech Stack:** React 18, TypeScript, Vitest + jsdom, existing `OrganicBlob` / `BlobFace` components, `BLOBS` / `C` / `INK` tokens.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/hooks/blobPhysics.ts` | Pure physics functions + types |
| Create | `src/hooks/blobPhysics.test.ts` | Unit tests for physics functions |
| Create | `src/hooks/useBlobPhysics.ts` | React hook: rAF loop + respawn |
| Modify | `src/components/OrganicBlob.tsx` | Add `animated` prop (pulse animation) |
| Modify | `src/screens/Welcome.tsx` | Replace static blobs with hook-driven render |

---

## Task 1: Pure physics types and functions

**Files:**
- Create: `src/hooks/blobPhysics.ts`
- Create: `src/hooks/blobPhysics.test.ts`

### Step 1a: Write failing tests

Create `src/hooks/blobPhysics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  initBlob,
  spawnFromEdge,
  isOffScreen,
  checkCollision,
  resolveCollision,
  unpair,
  stepBlobs,
  type BlobParticle,
} from './blobPhysics'

// Helper: minimal blob without randomness
function blob(overrides: Partial<BlobParticle> & { id: number }): BlobParticle {
  return {
    x: 200, y: 400, vx: 1, vy: 0,
    color: '#FF7A45', size: 60, blobIdx: 0,
    pairedWith: null, pairedUntil: 0,
    ...overrides,
  }
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

  it('starts unpaired', () => {
    const b = initBlob(1, 400, 800)
    expect(b.pairedWith).toBeNull()
    expect(b.pairedUntil).toBe(0)
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

  it('velocity points roughly toward centre (dot product with to-centre vector > 0)', () => {
    for (let i = 0; i < 20; i++) {
      const b = spawnFromEdge(i, 400, 800)
      const toCx = 200 - b.x
      const toCy = 400 - b.y
      const dot = b.vx * toCx + b.vy * toCy
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

  it('returns true when centre is more than size past top edge', () => {
    expect(isOffScreen(blob({ id: 1, x: 200, y: -60, size: 50 }), 400, 800)).toBe(true)
  })

  it('returns false when blob is partially off-screen but centre is still within size margin', () => {
    // Centre at x=380 with size=50: 380 > 400-50=350 but 380 < 400+50=450 → still alive
    expect(isOffScreen(blob({ id: 1, x: 380, y: 400, size: 50 }), 400, 800)).toBe(false)
  })
})

describe('checkCollision', () => {
  it('detects overlap when distance < sum of radii', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60 })
    const b = blob({ id: 2, x: 140, y: 100, size: 60 }) // distance=40 < (60+60)/2=60
    expect(checkCollision(a, b)).toBe(true)
  })

  it('returns false when blobs are far apart', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60 })
    const b = blob({ id: 2, x: 300, y: 300, size: 60 })
    expect(checkCollision(a, b)).toBe(false)
  })

  it('returns false when blobs are exactly touching (not overlapping)', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60 })
    const b = blob({ id: 2, x: 160, y: 100, size: 60 }) // distance=60 = (60+60)/2
    expect(checkCollision(a, b)).toBe(false)
  })
})

describe('resolveCollision', () => {
  it('assigns the averaged velocity to both blobs', () => {
    const a = blob({ id: 1, vx: 2, vy: 0 })
    const b = blob({ id: 2, vx: 0, vy: 2 })
    const [ra, rb] = resolveCollision(a, b, 1000)
    expect(ra.vx).toBeCloseTo(1)
    expect(ra.vy).toBeCloseTo(1)
    expect(rb.vx).toBeCloseTo(1)
    expect(rb.vy).toBeCloseTo(1)
  })

  it('sets pairedWith cross-references', () => {
    const a = blob({ id: 1 })
    const b = blob({ id: 2 })
    const [ra, rb] = resolveCollision(a, b, 1000)
    expect(ra.pairedWith).toBe(2)
    expect(rb.pairedWith).toBe(1)
  })

  it('sets pairedUntil 2–3 seconds from now', () => {
    const a = blob({ id: 1 })
    const b = blob({ id: 2 })
    const now = 5000
    const [ra] = resolveCollision(a, b, now)
    expect(ra.pairedUntil).toBeGreaterThanOrEqual(now + 2000)
    expect(ra.pairedUntil).toBeLessThanOrEqual(now + 3000)
  })
})

describe('unpair', () => {
  it('clears pairedWith and pairedUntil', () => {
    const b = blob({ id: 1, pairedWith: 2, pairedUntil: 9999 })
    const result = unpair(b)
    expect(result.pairedWith).toBeNull()
    expect(result.pairedUntil).toBe(0)
  })

  it('adds a small delta to velocity (speed changes by at most 0.4 in each axis)', () => {
    const b = blob({ id: 1, vx: 1, vy: 1, pairedWith: 2, pairedUntil: 9999 })
    const result = unpair(b)
    expect(Math.abs(result.vx - 1)).toBeLessThanOrEqual(0.4)
    expect(Math.abs(result.vy - 1)).toBeLessThanOrEqual(0.4)
  })
})

describe('stepBlobs', () => {
  it('moves blobs by their velocity each frame', () => {
    const b = blob({ id: 1, x: 100, y: 200, vx: 1.5, vy: -1 })
    const [result] = stepBlobs([b], 0)
    expect(result.x).toBeCloseTo(101.5)
    expect(result.y).toBeCloseTo(199)
  })

  it('expires pairing when now >= pairedUntil', () => {
    const a = blob({ id: 1, pairedWith: 2, pairedUntil: 500, x: 100 })
    const b = blob({ id: 2, pairedWith: 1, pairedUntil: 500, x: 200 })
    const result = stepBlobs([a, b], 1000)
    expect(result[0].pairedWith).toBeNull()
    expect(result[1].pairedWith).toBeNull()
  })

  it('does not expire pairing when now < pairedUntil', () => {
    const a = blob({ id: 1, pairedWith: 2, pairedUntil: 5000, x: 100 })
    const b = blob({ id: 2, pairedWith: 1, pairedUntil: 5000, x: 200 })
    const result = stepBlobs([a, b], 1000)
    expect(result[0].pairedWith).toBe(2)
    expect(result[1].pairedWith).toBe(1)
  })

  it('resolves collision between two unpaired overlapping blobs', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60, vx: 2, vy: 0 })
    const b = blob({ id: 2, x: 140, y: 100, size: 60, vx: 0, vy: 0 }) // distance=40 < 60
    const result = stepBlobs([a, b], 0)
    expect(result[0].pairedWith).toBe(2)
    expect(result[1].pairedWith).toBe(1)
  })

  it('does not resolve collision if either blob is already paired', () => {
    const a = blob({ id: 1, x: 100, y: 100, size: 60, pairedWith: 3, pairedUntil: 9999 })
    const b = blob({ id: 2, x: 140, y: 100, size: 60 })
    const result = stepBlobs([a, b], 0)
    expect(result[0].pairedWith).toBe(3) // unchanged
    expect(result[1].pairedWith).toBeNull() // unchanged
  })
})
```

- [ ] **Step 1b: Run tests to confirm they all fail**

```bash
npm test -- --reporter=verbose src/hooks/blobPhysics.test.ts
```

Expected: all tests fail with `Cannot find module './blobPhysics'`

- [ ] **Step 1c: Create `src/hooks/blobPhysics.ts`**

```ts
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
```

- [ ] **Step 1d: Run tests — all should pass**

```bash
npm test -- --reporter=verbose src/hooks/blobPhysics.test.ts
```

Expected: all tests pass (PASS)

- [ ] **Step 1e: Commit**

```bash
git add src/hooks/blobPhysics.ts src/hooks/blobPhysics.test.ts
git commit -m "feat: add blob physics pure functions with tests"
```

---

## Task 2: `useBlobPhysics` hook

**Files:**
- Create: `src/hooks/useBlobPhysics.ts`

- [ ] **Step 2a: Create `src/hooks/useBlobPhysics.ts`**

```ts
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
```

- [ ] **Step 2b: Run full test suite to make sure nothing broke**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 2c: Commit**

```bash
git add src/hooks/useBlobPhysics.ts
git commit -m "feat: add useBlobPhysics hook with rAF loop and respawn"
```

---

## Task 3: Add `animated` prop to `OrganicBlob`

**Files:**
- Modify: `src/components/OrganicBlob.tsx`

The `animated` prop adds a CSS keyframe pulse+rotation on the SVG element, giving each blob an organic "living border" feel.

- [ ] **Step 3a: Update `src/components/OrganicBlob.tsx`**

Replace the entire file content with:

```tsx
import React from 'react';
import { C, INK, BLOBS } from '../lib/tokens';

const PULSE_CSS = `
@keyframes blobPulse {
  0%   { transform: scale(1)    rotate(0deg);  }
  25%  { transform: scale(1.06) rotate(2deg);  }
  50%  { transform: scale(1.02) rotate(-1deg); }
  75%  { transform: scale(0.96) rotate(3deg);  }
  100% { transform: scale(1)    rotate(0deg);  }
}`;

export default function OrganicBlob({
  size = 60,
  color = C.primary,
  idx = 0,
  face,
  animated = false,
}: {
  size?: number;
  color?: string;
  idx?: number;
  face?: React.ReactNode;
  animated?: boolean;
}) {
  const path = BLOBS[idx % BLOBS.length];
  const sw = size <= 28 ? 4 : size <= 44 ? 4.5 : 5;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {animated && <style>{PULSE_CSS}</style>}
      <svg
        width={size}
        height={size}
        viewBox="-3 -3 106 106"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'visible',
          filter: `drop-shadow(0 3px 0 ${INK}22)`,
          ...(animated
            ? { animation: 'blobPulse 3s ease-in-out infinite', transformOrigin: 'center' }
            : {}),
        }}
      >
        <path d={path} fill={color} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
      {face && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {face}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3b: Run tests**

```bash
npm test
```

Expected: all tests pass (no tests broken by OrganicBlob change)

- [ ] **Step 3c: Commit**

```bash
git add src/components/OrganicBlob.tsx
git commit -m "feat: add animated prop to OrganicBlob for organic pulse effect"
```

---

## Task 4: Wire up `Welcome.tsx`

**Files:**
- Modify: `src/screens/Welcome.tsx`

Replace the static blob decorations with the physics-driven hook. The background gradient, logo, tagline, and buttons are unchanged.

- [ ] **Step 4a: Update `src/screens/Welcome.tsx`**

Replace the entire file content with:

```tsx
import { useTranslation } from 'react-i18next'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import { C, INK, F } from '../lib/tokens'
import { useBlobPhysics } from '../hooks/useBlobPhysics'

export default function Welcome({ onSignIn }: { onSignIn: (mode: 'google' | 'skip') => void }) {
  const { t } = useTranslation()
  const blobs = useBlobPhysics(6)

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: `linear-gradient(180deg,${C.cream} 0%,#FFF1E0 40%,#FFE8DC 75%,#FFE0E8 100%)`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Physics blobs — behind all UI (zIndex 0) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {blobs.map(b => (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: b.x - b.size / 2,
              top: b.y - b.size / 2,
            }}
          >
            <OrganicBlob
              size={b.size}
              color={b.color}
              idx={b.blobIdx}
              animated
              face={<BlobFace size={b.size * 0.55} />}
            />
          </div>
        ))}
      </div>

      {/* Logo + tagline */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px', position: 'relative', zIndex: 1,
      }}>
        <div style={{
          fontFamily: F.display, fontWeight: 900, fontSize: 88,
          lineHeight: 0.95, letterSpacing: -3, display: 'flex', alignItems: 'baseline',
        }}>
          <span style={{ color: C.primary, animation: 'breathe-sm 3.2s 0s ease-in-out infinite', display: 'inline-block', transformOrigin: 'center bottom' }}>me</span>
          <span style={{ color: C.sky,     animation: 'breathe-sm 3.2s 0.6s ease-in-out infinite', display: 'inline-block', transformOrigin: 'center bottom' }}>u</span>
          <span style={{ color: C.grass,   animation: 'breathe-sm 3.2s 1.2s ease-in-out infinite', display: 'inline-block', transformOrigin: 'center bottom' }}>we</span>
        </div>
        <div style={{
          marginTop: 16, fontFamily: F.body, fontSize: 17, fontWeight: 600,
          color: C.ink, opacity: 0.7, textAlign: 'center', maxWidth: 280, lineHeight: 1.4,
          whiteSpace: 'pre-line',
        }}>
          {t('welcome.tagline')}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ padding: '0 24px 52px', position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => onSignIn('google')}
          style={{
            width: '100%', padding: '16px 24px', borderRadius: 999,
            background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `0 4px 0 ${INK}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontSize: 16, fontWeight: 700, color: C.ink,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4C13 4 4 13 4 24s9 20 20 20s20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.5 2.4c-5.2 0-9.6-3.3-11.3-8L6.1 32.8C9.4 39.5 16.1 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5c-.5.4 7.4-5.4 7.4-15.2c0-1.3-.1-2.6-.4-3.9z" />
          </svg>
          {t('welcome.google')}
        </button>
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>
          {t('welcome.terms')}
        </div>
        <button
          onClick={() => onSignIn('skip')}
          style={{
            marginTop: 12, width: '100%', padding: '12px',
            fontSize: 14, color: C.inkSoft, fontWeight: 700, textAlign: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          {t('welcome.skip')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4b: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4c: Build check (catches type errors)**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4d: Commit**

```bash
git add src/screens/Welcome.tsx
git commit -m "feat: replace static blobs with physics-driven animated blobs on Welcome screen"
```

---

## Task 5: Manual smoke test

- [ ] **Step 5a: Start dev server**

```bash
npm run dev
```

Open the app in a browser. Navigate to the Welcome/login screen.

- [ ] **Step 5b: Verify these behaviours**

1. **6 blob faces visible** with different colours (orange, blue, green, yellow, pink), black outline, black smile
2. **Blobs move continuously** across the screen
3. **Borders pulse** — each blob subtly scales and rotates in an organic pattern
4. **Blobs are behind the logo and buttons** — logo text and button are on top
5. **Respawn** — watch a blob exit the screen; within 2 seconds a new one enters from an edge
6. **Collision grouping** — when two blobs meet they briefly travel the same direction, then drift apart

- [ ] **Step 5c: Final commit if any tweaks were needed**

```bash
git add -p
git commit -m "fix: tweak blob physics after manual smoke test"
```
