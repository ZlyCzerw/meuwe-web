# Observability — Error Tracking & Analytics

**Status:** Planned (not yet implemented)
**Date:** 2026-06-29
**Stack:** Sentry (errors) + GA4 extended (analytics)

---

## Problem

The application currently has no visibility into runtime errors. When a user encounters a crash, a failed photo upload, a rejected push permission, or a geolocation failure, nothing reaches the developer. GA4 is in place for basic UX events but is incomplete — key actions (map load time, search, push opt-in, photo added) are not tracked.

Infrastructure-level logs exist in Supabase and Cloudflare but are not queryable by us, not alertable, and have limited retention on the free tier.

---

## Goals

1. Know when the app crashes and why, without waiting for user reports.
2. Know which features users actually use and where they drop off.
3. Keep the stack minimal and free-tier compatible.
4. Stay GDPR-compliant — no cookie banner required.

## Non-Goals

- Session replay or heatmaps (PostHog territory, not needed at this stage).
- A/B testing or feature flags.
- Custom log storage in Supabase.
- Server-side observability for edge functions (Supabase Dashboard is sufficient for now).

---

## Architecture

### Layer 1 — Sentry (error tracking)

**Package:** `@sentry/react`

**New file:** `src/lib/monitoring.ts`

Initialised once at app startup (before `<App>` renders). Configuration:

```ts
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENV ?? 'production',
  // Capture 100% of errors, 5% of performance traces (stays within free tier)
  tracesSampleRate: 0.05,
  // Do not send events in local development
  enabled: import.meta.env.PROD,
})

export function identifyUser(id: string, email: string) {
  Sentry.setUser({ id, email })
}

export function clearUser() {
  Sentry.setUser(null)
}

export function captureError(err: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(err, { extra: context })
}
```

**`src/main.tsx`:** wrap `<App>` with `Sentry.ErrorBoundary` so React component crashes are reported with full breadcrumb trail.

**`src/App.tsx`:** call `identifyUser(session.user.id, session.user.email)` after login, `clearUser()` after logout.

**Existing catch blocks** — replace `console.error(...)` with `captureError(err, { scope })` in:
- `src/lib/push.ts` — `register_push_device` RPC failure, FCM token fetch failure
- `src/screens/CreateSheet.tsx` — photo upload failure
- `src/lib/geo.ts` — geolocation permission denied (log as message, not exception)
- `src/lib/nativeAuth.ts` — native sign-in failure

**What Sentry captures automatically (no code needed):**
- Uncaught JS exceptions
- Unhandled promise rejections
- React render errors (via ErrorBoundary)
- Breadcrumbs: clicks, navigation, console calls leading up to the error

### Layer 2 — GA4 extended (analytics)

No architectural change. `src/lib/analytics.ts` gains additional methods alongside the existing seven. The `gtag` script in `index.html` is unchanged.

**New events to add:**

| Method | Trigger | Parameters |
|---|---|---|
| `track.mapLoaded(ms)` | After first pins render in `MapScreen` | `load_time_ms` |
| `track.searchUsed()` | On result selection in `SearchBar` | — |
| `track.pushSubscribed()` | After successful FCM/Web Push registration | `platform: 'web' \| 'android'` |
| `track.pushDenied()` | After permission denied in `subscribePush` | `platform` |
| `track.photoAdded()` | After photo slot filled in `CreateSheet` | — |
| `track.geoBlocked()` | When geolocation permission is denied | — |
| `track.filterApplied(filters)` | When user activates a category filter | `filter_count: number` |

**Placement:**
- `MapScreen` — `track.mapLoaded` fires inside the pins `useEffect` after `leafRef.current` renders markers, measuring from component mount.
- `SearchBar` — `track.searchUsed` fires on result click.
- `push.ts` — `track.pushSubscribed` / `track.pushDenied` inside `subscribePush` and `registerNativePush`, after the permission call resolves.
- `CreateSheet` — `track.photoAdded` inside the `setPhotos` updater when a slot is filled.
- `geo.ts` — `track.geoBlocked` when `requestPermissions` returns `'denied'`.
- `MapScreen` — `track.filterApplied` inside `toggleFilter` / `setSelectedFilters`.

### Layer 3 — ErrorBoundary integration

`src/components/ErrorBoundary.tsx` is already in the codebase. Wrap it with `Sentry.ErrorBoundary` in `src/main.tsx`:

```tsx
import * as Sentry from '@sentry/react'
import { ErrorBoundary } from './components/ErrorBoundary'

// In main.tsx render:
<Sentry.ErrorBoundary fallback={<ErrorBoundary />}>
  <App />
</Sentry.ErrorBoundary>
```

This gives Sentry access to the component tree at crash time.

---

## Environment Variables

Add to `.env` (and to Cloudflare Pages environment variables):

```
VITE_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
VITE_SENTRY_ENV=production
```

For the `staging` deployment:
```
VITE_SENTRY_ENV=staging
```

`VITE_SENTRY_DSN` must be set in Cloudflare Pages → Settings → Environment Variables for both Production and Preview environments.

---

## Sentry Account Setup

1. Create a free account at sentry.io.
2. Create a new project → Platform: React.
3. Copy the DSN from Project Settings → Client Keys.
4. Free tier includes 5,000 errors/month and 10,000 performance transactions/month — sufficient for current scale.

---

## What Does Not Change

- `index.html` — GA4 script tag unchanged.
- Existing `track.*` calls in `App.tsx` and `EventSheet.tsx` — unchanged.
- Supabase schema — no new tables.
- Edge functions — out of scope.

---

## Files Touched in Implementation

| File | Change |
|---|---|
| `package.json` | Add `@sentry/react` |
| `src/lib/monitoring.ts` | New file — Sentry init + helpers |
| `src/lib/analytics.ts` | Add 7 new `track.*` methods |
| `src/main.tsx` | Call `Sentry.init`, wrap with `ErrorBoundary` |
| `src/App.tsx` | Call `identifyUser` / `clearUser` on auth change |
| `src/lib/push.ts` | Replace `console.error` with `captureError` |
| `src/lib/geo.ts` | Add `track.geoBlocked`, `captureError` on denial |
| `src/screens/CreateSheet.tsx` | Add `track.photoAdded`, `captureError` on upload fail |
| `src/screens/MapScreen.tsx` | Add `track.mapLoaded`, `track.filterApplied` |
| `src/screens/SearchBar.tsx` | Add `track.searchUsed` |
| `src/lib/nativeAuth.ts` | Add `captureError` on sign-in failure |
| `.env` | Add `VITE_SENTRY_DSN`, `VITE_SENTRY_ENV` |

---

## GDPR Notes

- Sentry: processes error data (stack traces, breadcrumbs, user ID) as a data processor. No cookies. Covered by Sentry's DPA. Add Sentry to the sub-processors list in `privacy.html`.
- GA4: already in use. No change to cookie/consent posture.
- `Sentry.setUser` uses the internal Supabase UUID and email — both already processed under the existing privacy policy.
