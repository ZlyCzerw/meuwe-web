# IP-Based Initial Map Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Warsaw fallback on first launch with a coarse IP-based map center from a Cloudflare Pages Function, without blocking startup or GPS.

**Architecture:** A same-origin Pages Function (`/api/geo`) surfaces the geolocation Cloudflare already computes from `request.cf`. The client fetches it once on first launch (no cached position), non-blocking, and uses it as a low-priority center tier: `GPS > IP > cache > WARSAW`. GPS always overrides; the IP result is cached to `meuwe_last_pos` so later launches (and A2) start warm.

**Tech Stack:** Cloudflare Pages Functions, TypeScript, React, Leaflet, Capacitor, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-01-ip-initial-location-design.md`

---

## File Structure

- **Create** `functions/api/geo.ts` — Cloudflare Pages Function, `GET /api/geo`. Reads `request.cf`, returns `{lat,lng,country}` (or `{country}`), `Cache-Control: no-store`. Outside the app `src` tsconfig — Cloudflare builds it separately.
- **Modify** `src/lib/geo.ts` — add `WEB_ORIGIN` constant, `parseIpGeo()` (pure), `getIpLocation()` (fetch + parse, non-blocking, timeout).
- **Modify** `src/lib/geo.test.ts` — unit tests for `parseIpGeo` and `getIpLocation`.
- **Modify** `src/App.tsx` — `ipPos` state, first-launch fetch effect (cache to `meuwe_last_pos`), pass `ipPos` to `MapScreen`.
- **Modify** `src/screens/MapScreen.tsx` — `ipPos` prop, `IP_ZOOM`, extend the `... || WARSAW` fallback chain, re-center effect that does not set `centeredRef`.

---

### Task 1: Cloudflare Pages Function `/api/geo`

**Files:**
- Create: `functions/api/geo.ts`

- [ ] **Step 1: Create the function**

`functions/api/geo.ts`:

```ts
// Cloudflare Pages Function: GET /api/geo
// Returns the coarse geolocation Cloudflare already computed for the request IP.
// The response is per-IP — it must never be cached and served to another user.

interface CfGeo {
  latitude?: string
  longitude?: string
  country?: string
}

export const onRequestGet = (context: { request: Request }): Response => {
  const cf = (context.request as Request & { cf?: CfGeo }).cf ?? {}
  const lat = cf.latitude != null ? Number(cf.latitude) : NaN
  const lng = cf.longitude != null ? Number(cf.longitude) : NaN
  const country = (cf.country ?? '').toUpperCase()

  const body =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, country } : { country }

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Verify the app build is unaffected**

Run: `npx tsc --noEmit`
Expected: exit 0 (the `functions/` directory is outside the app `src` tsconfig, so this only confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add functions/api/geo.ts
git commit -m "feat(geo): add /api/geo Cloudflare Pages Function for IP location"
```

> **Post-deploy manual check (not part of this task's automated run):** after the branch deploys to Cloudflare Pages, `curl https://<preview-domain>/api/geo` should return JSON with `lat`/`lng`/`country`. Local `vite`/`vite preview` does NOT run Pages Functions, so `/api/geo` returns 404 locally — this is expected.

---

### Task 2: `parseIpGeo` and `getIpLocation` in `geo.ts`

**Files:**
- Modify: `src/lib/geo.ts`
- Test: `src/lib/geo.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the import line at the top of `src/lib/geo.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { haversineKm, countryToLang, parseIpGeo, getIpLocation } from './geo'
```

Append these suites to `src/lib/geo.test.ts`:

```ts
afterEach(() => { vi.unstubAllGlobals() })

describe('parseIpGeo', () => {
  it('parses numeric lat/lng', () => {
    expect(parseIpGeo({ lat: 41.38, lng: 2.17, country: 'ES' }))
      .toEqual({ lat: 41.38, lng: 2.17, country: 'ES' })
  })
  it('coerces string lat/lng and uppercases country', () => {
    expect(parseIpGeo({ lat: '41.38', lng: '2.17', country: 'es' }))
      .toEqual({ lat: 41.38, lng: 2.17, country: 'ES' })
  })
  it('returns null without finite coords', () => {
    expect(parseIpGeo({ country: 'ES' })).toBeNull()
    expect(parseIpGeo(null)).toBeNull()
    expect(parseIpGeo({ lat: 'x', lng: 'y' })).toBeNull()
  })
})

describe('getIpLocation', () => {
  it('returns parsed location on ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ lat: 41.38, lng: 2.17, country: 'ES' }),
    }))
    expect(await getIpLocation()).toEqual({ lat: 41.38, lng: 2.17, country: 'ES' })
  })
  it('returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    expect(await getIpLocation()).toBeNull()
  })
  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await getIpLocation()).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: FAIL — `parseIpGeo`/`getIpLocation` are not exported.

- [ ] **Step 3: Implement in `src/lib/geo.ts`**

`isNativePlatform` is already imported at the top of `geo.ts`. Add, right after the existing `countryToLang` function:

```ts
// Production web origin — used only by native builds, whose runtime origin is
// capacitor://localhost. Web builds call the same-origin relative path.
const WEB_ORIGIN = 'https://meuwe.eu'

export type IpGeo = { lat: number; lng: number; country: string }

// Parse the /api/geo response. Returns null unless finite lat/lng are present.
export function parseIpGeo(data: unknown): IpGeo | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const lat = typeof d.lat === 'number' ? d.lat : Number(d.lat)
  const lng = typeof d.lng === 'number' ? d.lng : Number(d.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const country = typeof d.country === 'string' ? d.country.toUpperCase() : ''
  return { lat, lng, country }
}

// Coarse IP-based location from our Cloudflare Pages Function. Non-blocking,
// short timeout, null on any failure. Web uses the same-origin path; native uses
// the absolute production URL (its own origin is capacitor://localhost).
export async function getIpLocation(): Promise<IpGeo | null> {
  const url = (isNativePlatform() ? WEB_ORIGIN : '') + '/api/geo'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 2500)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return parseIpGeo(await res.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: PASS (all `parseIpGeo` and `getIpLocation` cases green).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/geo.ts src/lib/geo.test.ts
git commit -m "feat(geo): add parseIpGeo + getIpLocation client helper"
```

---

### Task 3: Wire `ipPos` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the helper**

In `src/App.tsx`, extend the existing geo/i18n imports. Add to the import from `./lib/geo` (create the import if none exists):

```ts
import { getIpLocation } from './lib/geo'
```

- [ ] **Step 2: Add `ipPos` state**

Immediately after the existing `lastKnownPos` `useState` block (the one that reads `meuwe_last_pos`), add:

```tsx
const [ipPos, setIpPos] = useState<{ lat: number; lng: number } | null>(null)
```

- [ ] **Step 3: Add the first-launch IP fetch effect**

Add this effect near the other mount effects (e.g. just after the `lastKnownPos`/geo-related state). It runs once:

```tsx
// First launch only (no cached position): fetch a coarse IP-based center so the
// map doesn't fall back to Warsaw while GPS warms up. Non-blocking; GPS overrides.
// The result is cached to meuwe_last_pos so later launches start warm.
useEffect(() => {
  if (lastKnownPos) return
  let cancelled = false
  getIpLocation().then(res => {
    if (cancelled || !res) return
    const pos = { lat: res.lat, lng: res.lng }
    setIpPos(pos)
    try { localStorage.setItem('meuwe_last_pos', JSON.stringify(pos)) } catch {}
  })
  return () => { cancelled = true }
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Pass `ipPos` to `MapScreen`**

In the `<MapScreen ... />` render (where `lastKnownPos={lastKnownPos}` is passed), add on the next line:

```tsx
ipPos={ipPos}
```

- [ ] **Step 5: Typecheck (expected to fail until Task 4)**

Run: `npx tsc --noEmit`
Expected: FAIL — `MapScreen` does not yet accept an `ipPos` prop. This is expected; Task 4 adds it. (If you prefer a green checkpoint, do Task 4 before committing Task 3.)

- [ ] **Step 6: Commit together with Task 4**

Task 3 and Task 4 are committed together in Task 4 Step 6, because the prop contract spans both files.

---

### Task 4: Consume `ipPos` in `MapScreen.tsx`

**Files:**
- Modify: `src/screens/MapScreen.tsx`

- [ ] **Step 1: Add the `IP_ZOOM` constant**

Just below `const WARSAW = { lat: 52.2297, lng: 21.0122 }` (line 18), add:

```tsx
const IP_ZOOM = 11 // coarse city-level zoom for an IP-based guess (GPS uses 15)
```

- [ ] **Step 2: Add `ipPos` to the props**

In the destructured params add `ipPos,` next to `lastKnownPos,`. In the props type object add, next to `lastKnownPos?: ...`:

```tsx
ipPos?: { lat: number; lng: number } | null
```

- [ ] **Step 3: Extend the fallback chain (4 sites)**

Replace `userPos || lastKnownPos || WARSAW` / `initialPos || lastKnownPos || WARSAW` at each of these with the `ipPos` tier inserted before `WARSAW`:

- `eventsPos` (currently `const eventsPos = mapCenter || userPos || lastKnownPos || WARSAW`) →

```tsx
const eventsPos = mapCenter || userPos || lastKnownPos || ipPos || WARSAW
```

- Initial `setView` (`.setView([(initialPos || lastKnownPos || WARSAW).lat, (initialPos || lastKnownPos || WARSAW).lng], initialZoom)`) →

```tsx
.setView([(initialPos || lastKnownPos || ipPos || WARSAW).lat, (initialPos || lastKnownPos || ipPos || WARSAW).lng], initialZoom)
```

- `doRecenter` (`const p = userPos || lastKnownPos || WARSAW`) →

```tsx
const p = userPos || lastKnownPos || ipPos || WARSAW
```

- `onLocationPicked` (`onClick={() => onLocationPicked?.(userPos || lastKnownPos || WARSAW)}`) →

```tsx
onClick={() => onLocationPicked?.(userPos || lastKnownPos || ipPos || WARSAW)}
```

- [ ] **Step 4: Add the IP re-center effect**

Add this effect after the existing "Me marker" effect (the `useEffect(... [userPos])` block). It centers on the IP guess only before any real fix and does NOT set `centeredRef`, so the first GPS fix still auto-centers:

```tsx
// IP-based coarse center: apply once, before any GPS fix, without claiming a
// "real" center — so the first GPS fix still auto-centers (see centeredRef).
useEffect(() => {
  const map = leafRef.current
  if (!ipPos || !map) return
  if (centeredRef.current || userPosRef.current) return
  map.setView([ipPos.lat, ipPos.lng], IP_ZOOM, { animate: true })
}, [ipPos]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Typecheck and run the full test suite**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run`
Expected: PASS (all suites, including the new geo tests).

- [ ] **Step 6: Commit Tasks 3 + 4**

```bash
git add src/App.tsx src/screens/MapScreen.tsx
git commit -m "feat(map): use IP-based initial center before GPS fix"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

- [ ] **Step 2: Record manual verification steps (device / deploy)**

These cannot be verified in a local browser preview (Pages Functions don't run under `vite preview`, and the cold first-launch path needs a real device):

1. Deploy the branch to Cloudflare Pages; `curl https://<preview>/api/geo` returns `{lat,lng,country}`.
2. On a native Android build with `localStorage` cleared (fresh install), open the app **outside Poland** (or via a non-PL network): the map should open near the IP city (zoom ~11), NOT Warsaw, then snap to the precise GPS location when the fix arrives.
3. Confirm the production origin baked into `WEB_ORIGIN` (`https://meuwe.eu`) matches the real deployment domain.

---

## Notes for the Implementer

- **`meuwe.eu` assumption:** `WEB_ORIGIN` in `geo.ts` must equal the production Pages domain the native app should call. Confirm before shipping; change the one constant if different.
- **Local dev:** `/api/geo` 404s under `vite`/`vite preview` (no Pages runtime). `getIpLocation()` handles this gracefully (returns null → existing Warsaw fallback), so local dev is unaffected.
- **VPN:** the IP guess points at the VPN exit node; this is accepted (GPS overrides, wide zoom, self-healing cache) — see the spec's "Known Limitation — VPN".
