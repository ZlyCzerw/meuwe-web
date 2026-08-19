# Event Link Preview (dynamic Open Graph) - Design

**Date:** 2026-08-19
**Status:** Approved (brainstorming)

## Problem

Every link that leaves meuwe shows the same preview. `EventSheet` builds
`https://meuwe.eu/?event=<id>` (`EventSheet.tsx` `handleShare`, and `ics.ts`
`eventUrl`), but the served `index.html` carries one hardcoded `og:image`
pointing at the static `/og-image.png` banner, plus the generic title
"meuwe - local events on a map". Someone pasting a concert into a group chat
gets a preview that says nothing about that concert.

The fix: when the URL carries `?event=<uuid>`, serve the same HTML with the
event's own first photo, title and place in the Open Graph tags.

## Constraint That Shaped Everything

Lowest possible running cost. The design adds **no npm dependency, no new
service, and no plan upgrade** on either Supabase or Cloudflare. Marginal cost
is one Supabase RPC call per opened share link.

Three pieces of existing infrastructure make that possible:

- Cloudflare Pages Functions already run in production (`functions/api/geo.ts`;
  `https://meuwe.eu/api/geo` returns 200).
- `get_event_by_id` is a `SECURITY DEFINER` RPC already granted to `anon`
  (`supabase/migrations/20260608_private_events.sql`), so the edge can read any
  event with nothing but the public anon key.
- `HTMLRewriter` is built into the Workers runtime - streaming HTML rewriting
  with no library.

## Scope

| URL | Preview |
|---|---|
| `https://meuwe.eu` | unchanged - static banner |
| `https://meuwe.eu/pl/`, `/de/`, `/es/`, `/sl/` | unchanged |
| `https://meuwe.eu/?event=<uuid>` | event photo, title, place, date |

The parameter name is load-bearing: `?event=` triggers the lookup, anything else
falls through to the static banner.

## Decisions Taken During Brainstorming

**Private events are treated exactly like public ones.** This extends the
existing rule that possessing the UUID equals possessing the share link equals
authorization - the same rule `get_event_by_id` was written under. The cost was
named and accepted: a private event's title and photo become visible to any
crawler that touches the link (WhatsApp, Slack unfurl, mail link scanners),
without a human clicking.

**Image is the raw `photos[0]` URL.** No transformation service. Accepted
consequence: existing large uploads will not preview in WhatsApp, which drops
images above roughly 300 kB. Mitigated going forward by client-side downscaling
(see below), not retroactively.

**No time in the preview, only the date.** `events` has no timezone column and
the app formats with `toLocaleTimeString` in the *viewer's* zone
(`EventSheet.tsx`). A crawler scraping from a US datacenter would render a
Polish 16:00 as 10:00. Adding a timezone column was considered and rejected as a
separate project.

## Architecture

`functions/` is covered by **no** tsconfig - `tsconfig.app.json` includes only
`src`, `tsconfig.node.json` only `vite.config.ts`. That is why `geo.ts`
hand-rolls its context type rather than depending on `@cloudflare/workers-types`,
and it means `npx tsc -b` will never check anything under `functions/`.

Therefore all logic lives in `src/`, where both `tsc -b` and vitest reach it, and
the function file is a thin shell.

| File | Role | Status |
|---|---|---|
| `src/lib/ogPreview.ts` | `buildOgPreview(event, url)` -> `{ title, description, image }`. Pure, no I/O. | new |
| `src/lib/ogPreview.test.ts` | Unit tests for all of the above | new |
| `functions/index.ts` | Routing, Supabase fetch, HTMLRewriter. Hand-rolled types, following `geo.ts`. | new |
| `src/lib/imageResize.ts` (+ test) | Downscale a photo before upload | new |
| `src/screens/CreateSheet.tsx` | Call the resizer on both photo paths | modified |

`index.html` and `scripts/seo-content.mjs` are **not** touched. HTMLRewriter acts
on the tags already there; no source markers are needed.

## Request Flow

`functions/index.ts` matches the path `/` only. It never runs for `/assets/*.js`,
icons, or the `/pl/` variants. This is the whole reason it is a route handler and
not `functions/_middleware.ts`: middleware would fire on every asset request and
burn the free 100k/day allowance many times over for identical behaviour.

1. No `?event=`, or a value that does not match the UUID shape -> `next()`
   immediately, static asset untouched.
2. Valid UUID -> `next()` and `POST /rest/v1/rpc/get_event_by_id` issued **in
   parallel**, so Supabase latency hides behind the asset fetch instead of adding
   to it.
3. Response -> `buildOgPreview` -> `HTMLRewriter` rewrites attributes in stream.

## Head Rewrites

| Tag | New value |
|---|---|
| `<title>` | event title |
| `og:title`, `twitter:title` | event title |
| `og:description`, `twitter:description`, `meta[name=description]` | `<place> - <date> - <description excerpt>` |
| `og:image`, `og:image:secure_url`, `twitter:image` | `photos[0]` |
| `og:url` | `<request origin>/?event=<id>` |
| `og:image:width`, `og:image:height`, `og:image:type` | **removed** |

Two of these are non-obvious and the feature is broken without them:

**`og:url` must carry the event id.** It is hardcoded to `https://meuwe.eu/`
today (`index.html`). Facebook deduplicates previews by `og:url`, so leaving it
would file the first scraped event's preview under `meuwe.eu/` and serve that
same preview for every subsequent event link.

**`og:url` is built from the request's own origin, not a hardcoded
`meuwe.eu`.** `functions/index.ts` reads `url.origin` off the incoming request,
so a crawler hitting a `*.pages.dev` preview deployment gets an `og:url`
pointing at that preview host, not at production. This is deliberate, not an
oversight the spec failed to catch: if the domain were hardcoded, scraping a
preview deployment's `?event=` link would still write into Facebook's cache
under the production `meuwe.eu` URL, letting a preview build - possibly
mid-review, possibly broken - poison the cached preview that real users see
for the real link. Keying `og:url` to the request's actual origin keeps each
deployment's cache entries separate.

**The three image descriptors must go.** They are declared `1200`/`630`/
`image/png` for the static banner. An event photo has neither those dimensions
nor that type, and leaving them makes Facebook lay the image out in the wrong
frame.

Unchanged: `canonical` (stays `https://meuwe.eu/`, so Google does not index
thousands of ephemeral event URLs), `og:type`, `twitter:card`, `hreflang`,
JSON-LD.

## Description Composition

Built in `ogPreview.ts` from `place_name`, the date, and the description
collapsed to a single line and cut to ~200 characters on a word boundary.

The existing `truncateDescription` (`src/lib/text.ts`) is deliberately **not**
reused. It extends the preview to the end of any URL straddling the limit -
correct inside an event card, wrong here, where a 120-character address would
blow out the description.

Date formatting uses a calendar day derived from an offset approximated from the
event's `lng` (`round(lng / 15)` hours). Hour-level precision is not needed to
pick a calendar day, so this lands correctly for Poland and Tenerife except for
events starting within about an hour of midnight. Format is numeric - `19.08`,
`19-20.08` for multi-day, year appended only when it differs from the current one
- so it needs no translation.

## Failure Handling

Event missing, Supabase unreachable, environment variables absent, `photos`
empty - all fall through and serve the page unchanged with the static banner. No
error path may break `/`; it is the site's front door.

**Event with no photo:** title and description are still substituted, the image
stays the static banner.

## Caching

None added. Caching the rewritten HTML would save RPC calls but would outlive the
next deploy and hand users a page referencing JS bundles that no longer exist.
One RPC per link open is cheaper than that class of bug, and Facebook caches the
preview on its own side regardless.

## Photo Downscaling On Upload

`src/lib/imageResize.ts`: `createImageBitmap(file, { imageOrientation: 'from-image' })`
- EXIF orientation must be honoured or phone photos upload rotated - then canvas
to at most 1600 px on the long edge, JPEG quality stepped down a ladder -
0.82, then 0.65, then 0.5 - stopping as soon as a step lands under 300 kB and
otherwise keeping the smallest result. One retry was tried first and measured
short: a busy or low-light photo (sensor noise) could shrink from 539 kB to
only 305 kB on a single q0.65 retry, still over WhatsApp's ceiling. The third
step exists because that measurement did.

Wired into `db.uploadEventPhoto` (`src/lib/supabase.ts`) rather than into
`CreateSheet.tsx`: that method is the only place a photo reaches storage, so one
call site covers the camera path and both file inputs, and any future caller.
The existing 6 MB guard in `CreateSheet.tsx` stays as an input check.

Applies to new uploads only. Already-stored photos are left alone.

## Verification

`npm test` and `npx tsc -b` cover `ogPreview` and `imageResize`. Neither reaches
the function itself: `wrangler` is not installed, so `npm run dev` does not run
Pages Functions (the same is already true of `/api/geo`). Real proof comes after
deploy:

```
curl -sA "facebookexternalhit/1.1" 'https://meuwe.eu/?event=380a9df3-d10a-4e17-b307-427bb9828a0c' | grep -E 'og:(title|image|url)'
```

Then the Facebook Sharing Debugger to force a cache refresh.

## Manual Step Outside The Code

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are inlined into the bundle at
build time and do not exist in the function's runtime. Two variables -
`SUPABASE_URL` and `SUPABASE_ANON_KEY` - must be added in Cloudflare Pages ->
Settings -> Environment variables, for Production and Preview.

Until they are set, the function passes the page through unchanged. Nothing
breaks; the preview simply stays as it is today.

## Out Of Scope

JSON-LD `Event` schema, `/pl/?event=` variants, an image transformation service,
a timezone column on `events`, retroactive resizing of stored photos.
