# Event Link Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `https://meuwe.eu/?event=<uuid>` show the event's own first photo, title and place in the link preview, instead of the static meuwe banner.

**Architecture:** A Cloudflare Pages Function bound to the `/` route only. When the query string carries a valid event UUID it fetches the row through the existing public `get_event_by_id` RPC and rewrites the Open Graph tags in the streamed HTML with `HTMLRewriter`. All decision logic lives in `src/lib/` so `tsc -b` and vitest cover it; the function file is a thin shell. Separately, photos are downscaled in the browser before upload so previews stay under WhatsApp's size ceiling.

**Tech Stack:** Cloudflare Pages Functions, `HTMLRewriter` (built into the Workers runtime), Supabase PostgREST RPC, vitest. **No new npm dependency.**

**Spec:** `docs/superpowers/specs/2026-08-19-event-link-preview-design.md`

---

## Facts Established Before Planning

Do not re-derive these; they were checked against the live repo and the live site.

- `functions/` is covered by **no** tsconfig (`tsconfig.app.json` includes only `src`, `tsconfig.node.json` only `vite.config.ts`). `npx tsc -b` will never check `functions/index.ts`. That is why all logic goes in `src/lib/`.
- `functions/` **is** linted — `eslint.config.js` matches `**/*.{ts,tsx}` with no ignore for it. `npx eslint functions/` currently exits 0.
- `HTMLRewriter` does **not** trip `no-undef`; this was verified with a throwaway probe file. No type declaration or `@cloudflare/workers-types` dependency is needed.
- `get_event_by_id` is `SECURITY DEFINER` and granted to `anon` (`supabase/migrations/20260608_private_events.sql`). The anon key alone is enough. It returns a JSON **array** — zero or one row.
- `db.uploadEventPhoto` (`src/lib/supabase.ts:278`) is the **only** call site that uploads a photo — `resolvePhotoUrls` is called once, at `src/screens/CreateSheet.tsx:228`.
- Commit messages in this repo are plain imperative sentences (`Spread piled-up pins on tap instead of opening a guess`), not `feat:` prefixes. **Never add a `Co-Authored-By` trailer.**

## Deliberate Deviation From The Spec

The spec's "Photo Downscaling On Upload" section says to wire the resizer into both photo paths in `CreateSheet.tsx`. **Do it in `db.uploadEventPhoto` instead** — one choke point, covering all three entry points (camera, two file inputs) and any future caller, with no diff to an 800-line component. Task 8 updates the spec to match.

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `src/lib/ogPreview.ts` | Pure. Turns an event row into `{ title, description, image, url }`. No imports, no I/O. | create |
| `src/lib/ogPreview.test.ts` | Tests for date formatting, excerpting, assembly | create |
| `src/lib/imageResize.ts` | Pure `fitWithin` + `downscaleImage` canvas wrapper | create |
| `src/lib/imageResize.test.ts` | Tests for `fitWithin` and the two pass-through paths | create |
| `functions/index.ts` | Route `/`, fetch event, rewrite head. Hand-rolled types. | create |
| `src/lib/supabase.ts:278` | Call `downscaleImage` before upload | modify |
| `docs/superpowers/specs/2026-08-19-event-link-preview-design.md` | Record the choke-point deviation | modify |

`index.html` and `scripts/seo-content.mjs` are **not** touched.

---

### Task 1: Date formatting in `ogPreview.ts`

The calendar day must come from the event's own approximate timezone, derived from its longitude. `events` has no timezone column, and formatting in the crawler's zone would shift the day for events near midnight.

**Files:**
- Create: `src/lib/ogPreview.ts`
- Test: `src/lib/ogPreview.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { formatEventDays } from './ogPreview'

// Boguchwała, lng ~21.94 → round(21.94/15) = +1h. A 14:00Z start is 15:00
// local by that estimate, comfortably inside 19 August either way.
const LNG_PL = 21.94
const NOW = new Date('2026-08-19T10:00:00Z')

describe('formatEventDays', () => {
  it('renders a single day as DD.MM', () => {
    expect(formatEventDays('2026-08-19T14:00:00Z', '2026-08-19T21:59:00Z', LNG_PL, NOW))
      .toBe('19.08')
  })

  it('renders a two-day event as DD–DD.MM when the month matches', () => {
    expect(formatEventDays('2026-08-19T14:00:00Z', '2026-08-20T10:00:00Z', LNG_PL, NOW))
      .toBe('19–20.08')
  })

  it('spells out both sides when the month changes', () => {
    expect(formatEventDays('2026-08-30T14:00:00Z', '2026-09-01T10:00:00Z', LNG_PL, NOW))
      .toBe('30.08–01.09')
  })

  it('appends the year when the event is not in the current year', () => {
    expect(formatEventDays('2027-08-19T14:00:00Z', '2027-08-19T21:00:00Z', LNG_PL, NOW))
      .toBe('19.08.2027')
  })

  it('spells out both years when the event crosses new year', () => {
    expect(formatEventDays('2026-12-31T20:00:00Z', '2027-01-01T03:00:00Z', LNG_PL, NOW))
      .toBe('31.12.2026–01.01.2027')
  })

  it('uses the longitude offset, not UTC, to pick the day', () => {
    // 23:30Z on the 18th is 01:30 on the 19th in a +2h zone (lng 30).
    expect(formatEventDays('2026-08-18T23:30:00Z', '2026-08-19T02:00:00Z', 30, NOW))
      .toBe('19.08')
  })

  it('returns an empty string for an unparseable date', () => {
    expect(formatEventDays('not-a-date', 'not-a-date', LNG_PL, NOW)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ogPreview.test.ts`
Expected: FAIL — `Failed to resolve import "./ogPreview"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ogPreview.ts`:

```ts
/**
 * Open Graph preview for a shared event link — pure, no I/O.
 *
 * Mieszka w `src/`, a nie obok funkcji Cloudflare, z jednego powodu:
 * `functions/` nie należy do żadnego tsconfiga, więc `tsc -b` nigdy tam nie
 * zagląda. Tutaj obejmuje ten kod i typecheck, i vitest.
 *
 * Bez importów — plik jest bundlowany do runtime'u Workers, w którym nie ma
 * ani DOM-u, ani niczego z reszty aplikacji.
 */

const HOUR_MS = 3_600_000

/**
 * Kalendarzowy dzień wydarzenia w jego własnej strefie — przybliżonej.
 *
 * `events` nie ma kolumny ze strefą, a aplikacja formatuje godziny w strefie
 * *oglądającego* (`EventSheet`). Podgląd linku generuje crawler, często z USA,
 * więc strefa oglądającego jest tu bezużyteczna. Przybliżenie z długości
 * geograficznej wystarcza, bo wybieramy sam dzień, nie godzinę: `round(lng/15)`
 * myli się o najwyżej godzinę z okładem, co przesuwa dzień tylko dla wydarzeń
 * zaczynających się tuż po północy.
 */
function localParts(iso: string, lng: number): { y: number; m: number; d: number } | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const offsetH = Number.isFinite(lng) ? Math.round(lng / 15) : 0
  const shifted = new Date(ms + offsetH * HOUR_MS)
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() }
}

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Dzień albo zakres dni, zapisem liczbowym — celowo bez nazw miesięcy i bez
 * godzin. Liczby nie wymagają tłumaczenia, a godziny wymagałyby strefy,
 * której nie mamy.
 */
export function formatEventDays(
  startIso: string,
  endIso: string,
  lng: number,
  now: Date = new Date(),
): string {
  const start = localParts(startIso, lng)
  if (!start) return ''
  const end = localParts(endIso, lng) ?? start

  const sameDay = start.y === end.y && start.m === end.m && start.d === end.d
  if (sameDay) {
    const tail = start.y === now.getFullYear() ? '' : `.${start.y}`
    return `${pad(start.d)}.${pad(start.m)}${tail}`
  }

  if (start.y !== end.y) {
    return `${pad(start.d)}.${pad(start.m)}.${start.y}–${pad(end.d)}.${pad(end.m)}.${end.y}`
  }

  const tail = start.y === now.getFullYear() ? '' : `.${start.y}`
  if (start.m === end.m) return `${pad(start.d)}–${pad(end.d)}.${pad(start.m)}${tail}`
  return `${pad(start.d)}.${pad(start.m)}–${pad(end.d)}.${pad(end.m)}${tail}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ogPreview.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ogPreview.ts src/lib/ogPreview.test.ts
git commit -m "Read an event's day from its own longitude, not the crawler's clock"
```

---

### Task 2: Description excerpt in `ogPreview.ts`

**Files:**
- Modify: `src/lib/ogPreview.ts`
- Test: `src/lib/ogPreview.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/ogPreview.test.ts`, and extend the existing import line to `import { formatEventDays, excerpt, OG_DESCRIPTION_CHARS } from './ogPreview'`:

```ts
describe('excerpt', () => {
  it('collapses newlines and runs of spaces into single spaces', () => {
    expect(excerpt('Wydarzenie bezpłatne.\n\nKreatywna   Środa')).toBe('Wydarzenie bezpłatne. Kreatywna Środa')
  })

  it('returns an empty string for null', () => {
    expect(excerpt(null)).toBe('')
  })

  it('leaves text at or under the limit untouched', () => {
    const text = 'a'.repeat(OG_DESCRIPTION_CHARS)
    expect(excerpt(text)).toBe(text)
  })

  it('cuts on a word boundary and marks the cut', () => {
    const text = `${'ab '.repeat(120)}end`
    const out = excerpt(text, 20)
    expect(out).toBe('ab ab ab ab ab ab…')
    expect(out.length).toBeLessThanOrEqual(21)
  })

  it('cuts hard when backing off to a space would eat most of the excerpt', () => {
    // One long unbroken token: the only space sits at index 2, far below the
    // 60% floor, so a word-boundary cut would leave almost nothing.
    expect(excerpt(`ab ${'x'.repeat(100)}`, 20)).toBe('ab xxxxxxxxxxxxxxxxx…')
  })

  it('does not extend past the limit to finish a URL', () => {
    // Unlike truncateDescription in text.ts, which deliberately does.
    const out = excerpt(`start https://example.com/${'a'.repeat(200)}`, 30)
    expect(out.length).toBeLessThanOrEqual(31)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ogPreview.test.ts`
Expected: FAIL — `excerpt is not a function` / no export named `excerpt`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/ogPreview.ts`:

```ts
/** Ile opisu mieści się w podglądzie linku, zanim zetną go same serwisy. */
export const OG_DESCRIPTION_CHARS = 200

/**
 * Poniżej tego udziału limitu cofanie się do spacji kosztuje za dużo — wtedy
 * tniemy twardo. Ten sam próg co w `text.ts`, dla spójności podglądów.
 */
const WORD_BOUNDARY_MIN_RATIO = 0.6

/**
 * Opis zwinięty do jednej linii i przycięty do limitu.
 *
 * Świadomie nie używamy `truncateDescription` z `text.ts`: tamto przedłuża
 * podgląd do końca adresu przeciętego granicą, co jest słuszne w karcie
 * wydarzenia, ale tutaj 120-znakowy URL rozsadziłby cały opis.
 */
export function excerpt(text: string | null | undefined, limit = OG_DESCRIPTION_CHARS): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) return flat

  const cut = flat.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const body = lastSpace >= limit * WORD_BOUNDARY_MIN_RATIO ? cut.slice(0, lastSpace) : cut
  return `${body.trimEnd()}…`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ogPreview.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ogPreview.ts src/lib/ogPreview.test.ts
git commit -m "Flatten an event description into one line for the link preview"
```

---

### Task 3: Assemble the preview in `ogPreview.ts`

**Files:**
- Modify: `src/lib/ogPreview.ts`
- Test: `src/lib/ogPreview.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/ogPreview.test.ts`, extending the import to also pull `buildOgPreview` and `type OgEvent`:

```ts
const BASE: OgEvent = {
  title: 'Kreatywna Środa-DYSKOTEKA DLA DZIECI',
  description: 'Wydarzenie bezpłatne.\n\nKreatywna Środa z MCK.',
  place_name: 'MCK Boguchwala, Boguchwala',
  lng: 21.94,
  start_time: '2026-08-19T14:00:00Z',
  end_time: '2026-08-19T21:59:00Z',
  photos: ['https://example.com/a.jpg'],
}
const URL_ = 'https://meuwe.eu/?event=380a9df3-d10a-4e17-b307-427bb9828a0c'
const NOW_ = new Date('2026-08-19T10:00:00Z')

describe('buildOgPreview', () => {
  it('uses the event title and the first photo', () => {
    const og = buildOgPreview(BASE, URL_, NOW_)
    expect(og.title).toBe('Kreatywna Środa-DYSKOTEKA DLA DZIECI')
    expect(og.image).toBe('https://example.com/a.jpg')
    expect(og.url).toBe(URL_)
  })

  it('joins place, day and description', () => {
    expect(buildOgPreview(BASE, URL_, NOW_).description)
      .toBe('MCK Boguchwala, Boguchwala · 19.08 — Wydarzenie bezpłatne. Kreatywna Środa z MCK.')
  })

  it('drops the place when the event has none', () => {
    expect(buildOgPreview({ ...BASE, place_name: null }, URL_, NOW_).description)
      .toBe('19.08 — Wydarzenie bezpłatne. Kreatywna Środa z MCK.')
  })

  it('drops the dash when the event has no description', () => {
    expect(buildOgPreview({ ...BASE, description: null }, URL_, NOW_).description)
      .toBe('MCK Boguchwala, Boguchwala · 19.08')
  })

  it('reports no image when photos is null, so the static banner survives', () => {
    expect(buildOgPreview({ ...BASE, photos: null }, URL_, NOW_).image).toBeNull()
  })

  it('reports no image when photos is empty', () => {
    expect(buildOgPreview({ ...BASE, photos: [] }, URL_, NOW_).image).toBeNull()
  })

  it('skips photo entries that are not absolute http(s) URLs', () => {
    expect(buildOgPreview({ ...BASE, photos: ['javascript:alert(1)', 'https://ok.example/b.jpg'] }, URL_, NOW_).image)
      .toBe('https://ok.example/b.jpg')
  })

  it('falls back to the site name when the title is blank', () => {
    expect(buildOgPreview({ ...BASE, title: '   ' }, URL_, NOW_).title).toBe('meuwe')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ogPreview.test.ts`
Expected: FAIL — no export named `buildOgPreview`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/ogPreview.ts`:

```ts
/**
 * Tylko te pola wydarzenia, których dotyka podgląd.
 *
 * Celowo nie `EventRow` z `types.ts`: ten moduł ma nie mieć importów, a węższy
 * kształt pozwala testom budować przypadki bez wypełniania kolumn, które nic
 * tu nie zmieniają.
 */
export type OgEvent = {
  title: string
  description: string | null
  place_name: string | null
  lng: number
  start_time: string
  end_time: string
  photos: string[] | null
}

export type OgPreview = {
  title: string
  description: string
  /** `null` znaczy: zostaw statyczny baner i jego deskryptory w spokoju. */
  image: string | null
  url: string
}

/** Nic poza absolutnym http(s) nie ma prawa wejść do `og:image`. */
const ABSOLUTE_HTTP = /^https?:\/\//i

function firstUsablePhoto(photos: string[] | null): string | null {
  for (const photo of photos ?? []) {
    const url = (photo ?? '').trim()
    if (ABSOLUTE_HTTP.test(url)) return url
  }
  return null
}

export function buildOgPreview(event: OgEvent, url: string, now: Date = new Date()): OgPreview {
  const head = [(event.place_name ?? '').trim(), formatEventDays(event.start_time, event.end_time, event.lng, now)]
    .filter(Boolean)
    .join(' · ')
  const body = excerpt(event.description)

  return {
    title: event.title.trim() || 'meuwe',
    description: [head, body].filter(Boolean).join(' — '),
    image: firstUsablePhoto(event.photos),
    url,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ogPreview.test.ts`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ogPreview.ts src/lib/ogPreview.test.ts
git commit -m "Assemble the Open Graph preview an event link should carry"
```

---

### Task 4: The Cloudflare Pages Function

> **Superseded — read `functions/index.ts` instead.** The code listing below is
> what was planned, not what shipped. Review added six changes to it: a 2 s
> `AbortSignal` timeout on the Supabase call, a `try`/`catch` around composing
> and rewriting, the `imageSecure` branch for `og:image:secure_url`, stripping
> `etag`/`last-modified` inside the rewrite, `head title` in place of `title`,
> and lowercasing the id in `og:url`. The `env.ASSETS` fallback shown here was
> removed entirely - `ctx.next()` is the documented API for this mode and the
> one that applies `public/_headers`. Re-running this listing verbatim would
> regress all of it.

No unit test — `wrangler` is not installed, so nothing runs Pages Functions locally (the same is already true of `/api/geo`). The logic it wraps is covered by Tasks 1–3; this file is verified by lint here and by a real deploy in Task 9.

**Files:**
- Create: `functions/index.ts`

- [ ] **Step 1: Write the function**

```ts
// Cloudflare Pages Function: GET /
//
// Podmienia tagi Open Graph na dane wydarzenia, kiedy adres niesie
// `?event=<uuid>` — czyli dokładnie dla linków, które rozdaje przycisk
// „udostępnij" w `EventSheet`. Bez tego parametru oddaje statyczny plik
// nietknięty.
//
// Dlaczego to `functions/index.ts`, a nie `functions/_middleware.ts`: ten plik
// obsługuje wyłącznie ścieżkę `/`. Middleware odpalałoby się przy KAŻDYM
// żądaniu — każdym chunku JS, każdej ikonie — i zjadałoby darmowy limit
// wielokrotnie szybciej za identyczne zachowanie.
//
// Typy są pisane ręcznie, wzorem `api/geo.ts`: katalog `functions/` nie należy
// do żadnego tsconfiga, więc zależność od `@cloudflare/workers-types` i tak
// nie byłaby przez nic sprawdzana.

import { buildOgPreview, type OgEvent, type OgPreview } from '../src/lib/ogPreview'

interface Env {
  /** Ustawiane w Cloudflare Pages → Settings → Environment variables. */
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  ASSETS?: { fetch: (request: Request) => Promise<Response> }
}

interface Ctx {
  request: Request
  env: Env
  next: () => Promise<Response>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Deskryptory statycznego banera. Zostają, dopóki baner zostaje. */
const IMAGE_DESCRIPTORS = ['og:image:width', 'og:image:height', 'og:image:type']

const servePage = (ctx: Ctx): Promise<Response> =>
  ctx.env.ASSETS ? ctx.env.ASSETS.fetch(ctx.request) : ctx.next()

/**
 * `get_event_by_id` to SECURITY DEFINER nadany roli `anon` — sam klucz
 * anonimowy wystarcza, żeby odczytać wydarzenie po UUID. Każda porażka kończy
 * się `null`, bo strona główna nie może się wywrócić przez podgląd linku.
 */
async function fetchEvent(env: Env, id: string): Promise<OgEvent | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_event_by_id`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_event_id: id }),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as OgEvent[]
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
  } catch {
    return null
  }
}

function rewrite(page: Response, og: OgPreview): Response {
  if (!(page.headers.get('content-type') ?? '').includes('text/html')) return page

  const byProperty: Record<string, string> = {
    'og:title': og.title,
    'og:description': og.description,
    // Musi nieść id wydarzenia. Facebook deduplikuje podglądy po `og:url`, więc
    // zostawienie tu gołego `https://meuwe.eu/` zapisałoby pierwsze
    // zescrapowane wydarzenie pod adresem serwisu i podałoby ten sam podgląd
    // dla wszystkich pozostałych linków.
    'og:url': og.url,
  }
  const byName: Record<string, string> = {
    description: og.description,
    'twitter:title': og.title,
    'twitter:description': og.description,
  }

  if (og.image) {
    byProperty['og:image'] = og.image
    byProperty['og:image:secure_url'] = og.image
    byName['twitter:image'] = og.image
  }

  return new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(og.title)
      },
    })
    .on('meta', {
      element(el) {
        const property = el.getAttribute('property')
        if (property) {
          // Zdjęcie wydarzenia nie ma ani 1200x630, ani typu image/png —
          // zostawione deskryptory kazałyby Facebookowi rysować je w złej
          // ramce. Znikają tylko wtedy, gdy naprawdę podmieniamy obrazek.
          if (og.image && IMAGE_DESCRIPTORS.includes(property)) {
            el.remove()
            return
          }
          const value = byProperty[property]
          if (value) el.setAttribute('content', value)
          return
        }
        const name = el.getAttribute('name')
        if (!name) return
        const value = byName[name]
        if (value) el.setAttribute('content', value)
      },
    })
    .transform(page)
}

export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const url = new URL(ctx.request.url)
  const id = url.searchParams.get('event') ?? ''
  if (!UUID.test(id)) return servePage(ctx)

  // Równolegle, żeby opóźnienie Supabase schowało się za pobraniem strony,
  // zamiast doklejać się do niego.
  const [page, event] = await Promise.all([servePage(ctx), fetchEvent(ctx.env, id)])
  if (!event) return page

  return rewrite(page, buildOgPreview(event, `${url.origin}/?event=${id}`))
}
```

- [ ] **Step 2: Verify it lints and the rest of the project still typechecks**

Run: `npx eslint functions/ src/lib/ogPreview.ts && npx tsc -b`
Expected: both exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add functions/index.ts
git commit -m "Serve a shared event link with that event's own preview tags"
```

---

### Task 5: `fitWithin` in `imageResize.ts`

**Files:**
- Create: `src/lib/imageResize.ts`
- Test: `src/lib/imageResize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { fitWithin, MAX_EDGE } from './imageResize'

describe('fitWithin', () => {
  it('leaves an image already inside the box alone', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('leaves an image exactly at the limit alone', () => {
    expect(fitWithin(MAX_EDGE, 900)).toEqual({ width: MAX_EDGE, height: 900 })
  })

  it('scales a landscape photo by its long edge', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
  })

  it('scales a portrait photo by its long edge', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('never rounds a dimension down to zero', () => {
    expect(fitWithin(20000, 5)).toEqual({ width: 1600, height: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/imageResize.test.ts`
Expected: FAIL — `Failed to resolve import "./imageResize"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/imageResize.ts`:

```ts
/**
 * Zbijanie zdjęcia przed wysłaniem do bucketa.
 *
 * Powód jest jeden i konkretny: pierwsze zdjęcie wydarzenia trafia teraz do
 * `og:image` udostępnianego linku, a WhatsApp odpuszcza podgląd przy obrazkach
 * grubszych niż mniej więcej 300 kB. Zdjęcia z aparatu szły dotąd surowe, do
 * 6 MB.
 */

/** Dłuższy bok po przeskalowaniu. Z zapasem starcza na podgląd 1200x630. */
export const MAX_EDGE = 1600

/** Próg, powyżej którego WhatsApp przestaje pokazywać obrazek. */
export const TARGET_BYTES = 300 * 1024

const FIRST_QUALITY = 0.82
const RETRY_QUALITY = 0.65

/** Wymiary zmieszczone w kwadracie `maxEdge`, z zachowaniem proporcji. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/imageResize.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/imageResize.ts src/lib/imageResize.test.ts
git commit -m "Work out the box a shared photo has to fit into"
```

---

### Task 6: `downscaleImage` in `imageResize.ts`

The canvas encoding itself cannot run under jsdom (`createImageBitmap` and `toBlob` are unimplemented). What the tests must nail down is the part that matters for correctness: **an upload must never fail because resizing failed.** Both pass-through paths are tested for real.

**Files:**
- Modify: `src/lib/imageResize.ts`
- Test: `src/lib/imageResize.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/imageResize.test.ts`, extending the imports to `import { fitWithin, downscaleImage, MAX_EDGE, TARGET_BYTES } from './imageResize'` and adding `vi, afterEach` to the vitest import:

```ts
function fileOfSize(bytes: number, name = 'photo.jpg', type = 'image/jpeg'): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('downscaleImage', () => {
  it('returns a small photo untouched, without decoding it', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    const file = fileOfSize(TARGET_BYTES - 1)
    expect(await downscaleImage(file)).toBe(file)
    expect(decode).not.toHaveBeenCalled()
  })

  it('returns a non-image untouched', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    const file = fileOfSize(TARGET_BYTES * 2, 'notes.pdf', 'application/pdf')
    expect(await downscaleImage(file)).toBe(file)
    expect(decode).not.toHaveBeenCalled()
  })

  it('returns the original when decoding throws, so the upload still happens', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')))
    const file = fileOfSize(TARGET_BYTES * 2)
    expect(await downscaleImage(file)).toBe(file)
  })

  it('returns the original when the browser has no createImageBitmap', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const file = fileOfSize(TARGET_BYTES * 2)
    expect(await downscaleImage(file)).toBe(file)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/imageResize.test.ts`
Expected: FAIL — no export named `downscaleImage`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/imageResize.ts`:

```ts
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Zdjęcie zmniejszone na tyle, żeby przeszło przez podgląd linku.
 *
 * Nigdy nie rzuca i nigdy nie zwraca czegoś gorszego od wejścia: każda porażka
 * — brak `createImageBitmap`, nieobsługiwany format, pusty canvas, wynik
 * cięższy od oryginału — kończy się oddaniem pliku bez zmian. Wysyłka zdjęcia
 * jest ważniejsza niż jego rozmiar.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= TARGET_BYTES) return file
  if (typeof createImageBitmap !== 'function') return file

  try {
    // `imageOrientation` musi tu być: bez odczytu EXIF-a zdjęcia z telefonu
    // wgrywałyby się obrócone.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = fitWithin(bitmap.width, bitmap.height)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    let blob = await encode(canvas, FIRST_QUALITY)
    if (blob && blob.size > TARGET_BYTES) blob = (await encode(canvas, RETRY_QUALITY)) ?? blob
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/imageResize.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/imageResize.ts src/lib/imageResize.test.ts
git commit -m "Shrink an oversized photo before it becomes a link preview"
```

---

### Task 7: Resize at the upload choke point

`db.uploadEventPhoto` is the only place a photo reaches storage, so resizing here covers the camera path and both file inputs at once, with no diff to `CreateSheet.tsx`.

**Files:**
- Modify: `src/lib/supabase.ts:278-286`

- [ ] **Step 1: Add the import**

Find the existing import block at the top of `src/lib/supabase.ts` and add:

```ts
import { downscaleImage } from './imageResize'
```

- [ ] **Step 2: Replace the body of `uploadEventPhoto`**

Replace this exact block:

```ts
  async uploadEventPhoto(file:File):Promise<string> {
    const sess=await this.getSession(); if(!sess) throw new Error('not authenticated')
    const ext=file.name.split('.').pop()||'jpg'
    const path=`${sess.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const {error}=await supabase.storage.from('event-photos').upload(path,file,{contentType:file.type})
    if(error) throw error
    const {data}=supabase.storage.from('event-photos').getPublicUrl(path)
    return data.publicUrl
  },
```

with:

```ts
  // Jedyne miejsce, w którym zdjęcie trafia do bucketa — aparat i oba
  // `input[type=file]` schodzą się tutaj. Dlatego zbijanie rozmiaru siedzi w
  // tym miejscu, a nie w trzech miejscach w `CreateSheet`.
  async uploadEventPhoto(file:File):Promise<string> {
    const sess=await this.getSession(); if(!sess) throw new Error('not authenticated')
    const photo=await downscaleImage(file)
    const ext=photo.name.split('.').pop()||'jpg'
    const path=`${sess.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const {error}=await supabase.storage.from('event-photos').upload(path,photo,{contentType:photo.type})
    if(error) throw error
    const {data}=supabase.storage.from('event-photos').getPublicUrl(path)
    return data.publicUrl
  },
```

- [ ] **Step 3: Verify the whole suite and the typecheck still pass**

Run: `npm test && npx tsc -b && npm run lint`
Expected: all green. No test in the suite exercises `uploadEventPhoto` today, so this is a regression check, not new coverage.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "Shrink every event photo on its way to the bucket"
```

---

### Task 8: Record the deviation in the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-08-19-event-link-preview-design.md`

- [ ] **Step 1: Replace the wiring sentence**

In the "Photo Downscaling On Upload" section, replace:

```
Wired into both photo paths in `CreateSheet.tsx`
(`takePhotoNative` and the file picker). The existing 6 MB guard stays as an
input check.
```

with:

```
Wired into `db.uploadEventPhoto` (`src/lib/supabase.ts`) rather than into
`CreateSheet.tsx`: that method is the only place a photo reaches storage, so one
call site covers the camera path and both file inputs, and any future caller.
The existing 6 MB guard in `CreateSheet.tsx` stays as an input check.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-19-event-link-preview-design.md
git commit -m "Note that photo shrinking lives at the upload choke point"
```

---

### Task 9: Deploy and verify against a real crawler

Nothing before this proves the function actually runs — `wrangler` is not installed and `npm run dev` does not serve Pages Functions. This task is where the feature is confirmed.

**Files:** none

- [ ] **Step 1: Set the environment variables**

**This step is the repo owner's, not the implementer's.** In Cloudflare Pages → the meuwe project → Settings → Environment variables, add for both Production and Preview:

- `SUPABASE_URL` — same value as `VITE_SUPABASE_URL` in `.env`
- `SUPABASE_ANON_KEY` — same value as `VITE_SUPABASE_ANON_KEY` in `.env`

They are needed because `VITE_*` variables are inlined into the bundle at build time and do not exist in the function's runtime. Until they are set the function passes the page through unchanged — nothing breaks, the preview just stays as it is today.

- [ ] **Step 2: Deploy the branch and wait for the Pages build**

- [ ] **Step 3: Confirm the rewrite happens**

```bash
curl -sA "facebookexternalhit/1.1" 'https://meuwe.eu/?event=380a9df3-d10a-4e17-b307-427bb9828a0c' | grep -E 'og:(title|image|url)|<title>'
```

Expected: `<title>` and `og:title` carry `Kreatywna Środa-DYSKOTEKA DLA DZIECI`; `og:image` is `https://kultura.boguchwala.pl/static/img/k01/…/Dyskoteka.jpg`; `og:url` ends in `?event=380a9df3-…`; no `og:image:width` line.

**If `og:` values are still the static ones, check in this order before touching any code:**

1. Were the environment variables added (Step 1)? **Cloudflare Pages does not
   apply new environment variables to deployments that already exist** - adding
   them requires a fresh deployment before they take effect. This is the most
   likely cause and it looks exactly like a code bug.
2. Is the link one that was shared somewhere before this deploy? Facebook caches
   per `og:url` for around 30 days and WhatsApp effectively forever, so an old
   link keeps its old preview. Test with a freshly generated link, or force
   "Scrape Again" in the Sharing Debugger.
3. Only then read the Pages function logs.

- [ ] **Step 4: Confirm the plain site is untouched**

```bash
curl -s https://meuwe.eu/ | grep -E 'og:image"|og:url'
```

Expected: `https://meuwe.eu/og-image.png` and `https://meuwe.eu/`, exactly as today.

- [ ] **Step 5: Confirm in a real client**

Paste the event link into the Facebook Sharing Debugger (`https://developers.facebook.com/tools/debug/`), press Scrape Again, and confirm the event photo renders. Then paste it into a WhatsApp chat with yourself.

---

## Self-Review

**Spec coverage:** Scope table → Task 4 (`UUID` guard, `/` route). Private events treated as public → no code needed; the function never reads `is_private`. Architecture/file table → Tasks 1–7. Request flow → Task 4. Head rewrites incl. `og:url` and dropped descriptors → Task 4. Description composition → Tasks 1–3. Failure handling → Task 4 (`fetchEvent` returns `null` on every error) and Task 3 (`image: null` keeps the banner). Caching (none) → no cache header is set anywhere in Task 4. Photo downscaling → Tasks 5–7. Verification → Task 9. Manual step → Task 9 Step 1. Out of scope items appear in no task. **No gaps.**

**Placeholder scan:** No TBD/TODO, no "handle errors appropriately", no "similar to Task N". Every code step carries complete code.

**Type consistency:** `OgEvent` and `OgPreview` are defined in Task 3 and imported under those exact names in Task 4. `buildOgPreview(event, url, now?)` — three parameters, matching both its definition and both call sites. `formatEventDays(startIso, endIso, lng, now)` and `excerpt(text, limit?)` are used in Task 3 exactly as defined in Tasks 1–2. `fitWithin`, `MAX_EDGE`, `TARGET_BYTES` are defined in Task 5 and used in Task 6 under those names. `downscaleImage(file)` is defined in Task 6 and called in Task 7. **Consistent.**
