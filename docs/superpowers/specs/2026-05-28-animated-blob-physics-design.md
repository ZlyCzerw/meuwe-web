# Animated Blob Physics — Welcome Screen

**Date:** 2026-05-28
**Status:** Approved

## Overview

Replace the static decorative blobs on the Welcome/login screen with 6 physics-driven blob faces that move freely around the screen, detect collisions, briefly travel together, and respawn when they leave the viewport.

## Architecture

### New file: `src/hooks/useBlobPhysics.ts`

A single hook manages all blob state and the animation loop. It owns:
- An array of `BlobParticle` objects (see data model below)
- A `requestAnimationFrame` loop started via `useEffect` (cleaned up on unmount)
- Respawn timeouts (also cleaned up on unmount)

The hook takes `count: number` (default 6) and returns `blobs: BlobParticle[]`.

### Modified file: `src/components/OrganicBlob.tsx`

Adds an `animated?: boolean` prop. When true, the wrapper `div` receives a CSS keyframe animation that cycles `border-radius` between 3–4 variants every ~3s `ease-in-out infinite`, producing the organic "floating border" effect without animating the SVG path.

### Modified file: `src/screens/Welcome.tsx`

- Removes the 4 static decorative blobs and 2 static bobbing `OrganicBlob` elements
- Calls `useBlobPhysics(6)` and renders the returned blobs dynamically
- Blob container: `position: absolute`, `inset: 0`, `zIndex: 0`, `pointerEvents: none`, `overflow: hidden`
- UI content wrapper retains `zIndex: 1`
- Background gradient unchanged

## Data Model

```ts
type BlobParticle = {
  id: number
  x: number          // centre x in px
  y: number          // centre y in px
  vx: number         // velocity x in px/frame
  vy: number         // velocity y in px/frame
  color: string      // one of the 5 palette colours
  size: number       // diameter 44–72px, fixed at creation
  blobIdx: number    // 0–2, selects BLOBS path variant
  pairedWith: number | null  // id of collision partner, or null
  pairedUntil: number        // Date.now() timestamp when pairing ends
}
```

## Physics Logic

### Movement

Each `requestAnimationFrame`: `x += vx`, `y += vy`. Initial speed magnitude is random between 1.2–2 px/frame, direction is a random angle. Speed magnitude is preserved throughout (no friction).

### Collision detection

Each frame, every unique pair `(a, b)` is checked:

```
distance(a, b) < (a.size + b.size) / 2
```

On collision (and neither already paired):
1. Compute average velocity: `avgVx = (a.vx + b.vx) / 2`, same for y
2. Assign the averaged velocity to both blobs
3. Set `pairedWith` on each to the other's id
4. Set `pairedUntil = Date.now() + random(2000, 3000)`

After pairing expires:
- Add a small random delta (±0.4 px/frame) to each blob's velocity in opposite directions so they drift apart naturally

### Off-screen & respawn

A blob is "out" when its centre moves beyond `±size` past any viewport edge. On exit:
1. The blob is removed from the array
2. A `setTimeout` of 0–2000ms (random) fires and adds a new blob:
   - Spawns at a random position on one of the 4 edges (centre aligned to edge + small inset)
   - Velocity directed roughly toward the centre of the screen (angle ±30° of dead-centre)
   - New random colour, size, and blobIdx

## Visual Design

| Property | Value |
|---|---|
| Colours | `C.primary` `C.sky` `C.grass` `C.sunshine` `C.berry` |
| Outline | `INK` (#2D2B2A), existing `OrganicBlob` stroke |
| Face | `BlobFace` (happy mood, existing component) |
| Count | 6 simultaneous |
| Size range | 44–72px diameter |
| Border morphing | CSS `border-radius` keyframe on wrapper div, ~3s cycle |
| z-index | 0 (behind all UI at z-index 1) |
| Pointer events | none |

## What is NOT changing

- Background gradient in `Welcome.tsx`
- Logo ("meuwe") breathing animation
- Tagline text
- Google sign-in button and skip button
- `BlobFace` component internals
- `BLOBS` path constants in `tokens.ts`
