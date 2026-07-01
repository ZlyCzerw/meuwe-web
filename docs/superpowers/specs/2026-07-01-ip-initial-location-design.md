# IP-Based Initial Map Location

**Status:** Planned (not yet implemented)
**Date:** 2026-07-01
**Stack:** Cloudflare Pages Function (`request.cf`) + client integration (React/Leaflet/Capacitor)

---

## Problem

On **first launch**, the app has no cached position (`localStorage.meuwe_last_pos` is empty) and GPS has not yet produced a fix. The map falls back to a hardcoded `WARSAW` constant (`{ lat: 52.2297, lng: 21.0122 }`, used in `MapScreen.tsx` at the initial `setView`, `eventsPos`, `doRecenter`, and `onLocationPicked`). A tester in Spain therefore sees Warsaw until the (slowest, cold-start) first GPS fix arrives — the worst-rated behavior per testers.

The previously-considered "A2" fix (seed the map from `meuwe_last_pos`) does **not** help first launch, because that cache is empty on the first run.

## Goals

1. Replace the hardcoded Warsaw fallback with a sensible, IP-derived initial map center on first launch.
2. Do it **without making startup slower** — the location lookup must never block first paint or GPS.
3. Persist the result so subsequent launches and offline have an immediate center (feeds A2).
4. No new third-party data processor; no CSP changes on web.

## Non-Goals

- Replacing GPS. IP is only a coarse first guess; GPS remains the source of truth.
- Language detection from IP (deferred — current `reverseGeocodeCountry` flow is untouched).
- VPN detection or correction (not reliably possible; accepted limitation, see below).
- Country-centroid fallback table when CF returns no lat/lng (YAGNI — rare case).

---

## Approach

Cloudflare already computes approximate geolocation for every request (`request.cf`). We surface it via a **same-origin Pages Function** and use it as a low-priority fallback tier for the map center. Chosen over a third-party IP API (would need a CSP `connect-src` entry + external processor) and over a Supabase edge function (Supabase does not get CF's geo for free).

**Priority chain:** `GPS > IP > cache > WARSAW`. IP and GPS run in parallel; if GPS resolves first, the IP result is ignored for centering.

---

## Components

### 1. Cloudflare Pages Function — `functions/api/geo.ts`

- Route: `GET /api/geo`.
- Reads `context.request.cf`: `latitude`, `longitude`, `country` (CF provides these as strings → parse to number).
- Response:
  - `{ lat: number, lng: number, country: string }` when lat/lng present.
  - `{ country: string }` when CF has country but no coordinates.
- **`Cache-Control: no-store`** — the response is per-IP; it must never be cached and served to another user.
- Static asset serving is unaffected (the function only runs for `/api/geo`).

### 2. Client helper — extend `src/lib/geo.ts`

```ts
export async function getIpLocation(): Promise<{ lat: number; lng: number; country: string } | null>
```

- URL: web → relative `/api/geo` (same origin; CSP `connect-src 'self'` already allows it). Native → absolute `https://meuwe.eu/api/geo` (native origin is `capacitor://localhost`). Native origin selected via `isNativePlatform()`; the production origin is a single constant (confirm `meuwe.eu`).
- Short timeout (~2.5s via `AbortController`). All failures (network, timeout, missing lat/lng) → `null`.
- Always non-blocking; callers never `await` in a way that blocks render.

### 3. App integration — `src/App.tsx`

- New state `ipPos: { lat, lng } | null`.
- On **mount**, if `lastKnownPos === null` (first launch / cleared cache), fire `getIpLocation()` without blocking. IP lookup needs **no permission**, so it can run before the user reaches the map — the result is typically ready by the time the map renders.
- On success: `setIpPos(res)` **and** write it to `localStorage.meuwe_last_pos` so subsequent launches and the A2 fallback have an immediate center. (A real GPS fix later overwrites this key via the existing `onPos` handler — self-healing.)
- Pass `ipPos` to `MapScreen`.

### 4. Map centering — `src/screens/MapScreen.tsx`

- Extend the fallback chain everywhere it appears (initial `setView`, `eventsPos`, `doRecenter`, `onLocationPicked`): `userPos || lastKnownPos || ipPos || WARSAW`.
- New effect on `ipPos`: when it arrives, the map exists, there is no real `userPos`, and `!centeredRef.current` → `map.setView(ipPos, IP_ZOOM)` **without** setting `centeredRef`. This preserves the existing behavior where the first **real** GPS fix still auto-centers (same distinction as the A2 "seed vs real fix" rule).
- `IP_ZOOM` is wider than the GPS zoom (e.g. **11**, city level) so the coarse IP guess does not imply false precision. GPS later zooms to 15.

---

## Data Flow

1. App mounts. If no `meuwe_last_pos` → `getIpLocation()` fires in the background (no permission prompt).
2. User navigates to the map; GPS `watchPosition` starts (asks permission).
3. Map renders immediately on the best available center (`ipPos` if already resolved, else `WARSAW`).
4. Whichever resolves:
   - IP first → map re-centers to city (zoom 11), `centeredRef` stays false.
   - GPS first → map centers precisely (zoom 15), `centeredRef` set; IP result ignored for centering.
   - IP then GPS → city view, then snap to precise on GPS.
5. IP result is cached to `meuwe_last_pos`; the first real GPS fix overwrites it.

---

## Privacy

The device IP already reaches Cloudflare on every request (it is the host). The Pages Function only reads geolocation CF has **already** computed — no new third-party processor, no new data sharing, no consent change required. `Cache-Control: no-store` prevents cross-user leakage via the CDN cache. Only timing/coordinates for the current user's own request are involved; no coordinates are logged server-side.

## Known Limitation — VPN

IP geolocation resolves to the VPN exit node, not the device. With a VPN active the initial guess points at the exit city. This is accepted because:

- The IP guess is a low-priority tier, always overridden by GPS (which a VPN cannot spoof).
- It is transient (only until the first GPS fix) and non-blocking.
- The wide `IP_ZOOM` signals imprecision.
- The cache self-heals — the first real GPS fix overwrites the IP value.

Net effect is generally no worse than today's Warsaw fallback and better for the majority (non-VPN users outside Poland). No VPN detection is attempted (not reliably possible).

---

## Testing

- **`getIpLocation`** — unit tests with a mocked `fetch`: valid response → parsed `{lat,lng,country}`; missing lat/lng → `null`; network error / timeout → `null`.
- **Pages Function** — handler logic tested against a mock `context` (with and without `request.cf.latitude/longitude`).
- **Map centering (IP tier, `centeredRef` preservation, zoom)** — verified manually on a native Android build; Leaflet behavior is not meaningfully testable in jsdom.

## Rollout / Verification Notes

- The Pages Function requires the `functions/` directory, which Cloudflare Pages auto-deploys — first introduction of Pages Functions to this project.
- Behavior is only fully observable on a native build / real device (cold first launch, real IP). A browser preview cannot reproduce the cold-cache first-launch path faithfully.
- Confirm the production web origin (`meuwe.eu`) used by the native absolute URL before implementation.

---

## Open Decisions (resolved)

- **Fallback when CF returns no lat/lng:** keep the existing chain (no country-centroid table). Accepted — `request.cf` almost always includes coordinates.
- **Scope:** initial map center + cache to `meuwe_last_pos`. Language-from-IP deferred.
