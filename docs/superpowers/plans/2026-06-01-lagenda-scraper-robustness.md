# Lagenda Scraper Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the lagenda.org event scraper resilient — layered field extraction with fallbacks, a normalize layer that fills defaults instead of dropping events, a correct Canary timezone, event images, and fixture-based regression tests.

**Architecture:** Three new stateless modules (`extract.ts`, `normalize.ts`, `timezone.ts`) hold the fragile/important logic as pure, testable functions. `lagenda.ts` composes the extract helpers; `index.ts` runs every event through `normalize` and uses the timezone helper. Real HTML fixtures drive vitest tests so HTML changes fail loudly.

**Tech Stack:** TypeScript (ESM, `.ts` import extensions), Node.js, cheerio, vitest. Tests live next to source as `*.test.ts` and are picked up by the existing vitest config (`globals: true`).

**Conventions (this repo):**
- ESM with explicit `.ts` extensions in imports (e.g. `import { x } from './timezone.ts'`).
- `verbatimModuleSyntax` is on → type-only imports MUST use `import type`.
- Run a single test file: `npx vitest run scripts/event-sync/<file>.test.ts`
- Build check: `npx tsc -b`
- Commits: owner is sole author — do NOT add any `Co-Authored-By` trailer.

---

### Task 1: Commit HTML fixtures

Real lagenda.org HTML captured during design (listing + one detail page). These are the regression safety net — committing them locks the expected structure.

**Files:**
- Create (already on disk): `scripts/event-sync/__fixtures__/listing.html`
- Create (already on disk): `scripts/event-sync/__fixtures__/detail.html`

- [ ] **Step 1: Verify fixtures exist**

Run: `ls -la scripts/event-sync/__fixtures__/`
Expected: `listing.html` (~277 KB) and `detail.html` (~90 KB) present.

If missing, re-fetch:
```bash
curl -s -A "Mozilla/5.0 (compatible; meuwe-event-sync/1.0)" \
  "https://lagenda.org/programacion?fecha_ini=01/06/2026&fecha_fin=22/06/2026" \
  -o scripts/event-sync/__fixtures__/listing.html
curl -s -A "Mozilla/5.0 (compatible; meuwe-event-sync/1.0)" \
  "https://lagenda.org/programacion/fiestas-virgen-de-las-nieves-2026-adeje-tenerife-junio-42430" \
  -o scripts/event-sync/__fixtures__/detail.html
```

- [ ] **Step 2: Commit**

```bash
git add scripts/event-sync/__fixtures__/
git commit -m "test: add lagenda.org HTML fixtures for scraper tests"
```

---

### Task 2: Timezone module (`timezone.ts`)

Replaces the hardcoded `utcOffsetHours = 1` in `index.ts`. Canary Islands are UTC+0 in winter (WET) and UTC+1 in summer (WEST); the old constant made winter events 1h off.

**Files:**
- Create: `scripts/event-sync/timezone.ts`
- Test: `scripts/event-sync/timezone.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/event-sync/timezone.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { canaryOffsetHours, localCanaryToUtc } from './timezone.ts'

describe('canaryOffsetHours', () => {
  it('returns 0 in winter (WET)', () => {
    expect(canaryOffsetHours(new Date(Date.UTC(2026, 0, 15, 12)))).toBe(0)
  })
  it('returns 1 in summer DST (WEST)', () => {
    expect(canaryOffsetHours(new Date(Date.UTC(2026, 6, 15, 12)))).toBe(1)
  })
})

describe('localCanaryToUtc', () => {
  it('subtracts 1h in summer (20:00 local → 19:00 UTC)', () => {
    const d = localCanaryToUtc('2026-07-15', '20:00')
    expect(d.toISOString()).toBe('2026-07-15T19:00:00.000Z')
  })
  it('subtracts 0h in winter (20:00 local → 20:00 UTC)', () => {
    const d = localCanaryToUtc('2026-01-15', '20:00')
    expect(d.toISOString()).toBe('2026-01-15T20:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/event-sync/timezone.test.ts`
Expected: FAIL — cannot resolve module `./timezone.ts`.

- [ ] **Step 3: Write the implementation**

Create `scripts/event-sync/timezone.ts`:
```ts
/**
 * Timezone helpers for the Atlantic/Canary zone.
 * Winter (WET) = UTC+0, summer DST (WEST) = UTC+1.
 */

/** Offset in whole hours of Atlantic/Canary from UTC for the given instant. */
export function canaryOffsetHours(date: Date): number {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Atlantic/Canary',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find(p => p.type === 'timeZoneName')?.value ?? 'GMT'
  // part looks like 'GMT', 'GMT+1', 'GMT-1'
  const m = part.match(/GMT([+-]\d{1,2})?/)
  return m && m[1] ? parseInt(m[1], 10) : 0
}

/**
 * Convert a local Canary date+time ('YYYY-MM-DD', 'HH:MM') to a UTC Date,
 * accounting for the correct DST offset on that calendar day.
 */
export function localCanaryToUtc(date: string, hour: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, min] = hour.split(':').map(Number)
  const offset = canaryOffsetHours(new Date(Date.UTC(y, mo - 1, d, 12)))
  return new Date(Date.UTC(y, mo - 1, d, h - offset, min))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/event-sync/timezone.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/event-sync/timezone.ts scripts/event-sync/timezone.test.ts
git commit -m "feat: canary timezone helper with DST-aware offset"
```

---

### Task 3: Extraction helpers (`extract.ts`)

Layered, stateless cheerio helpers. Each tries strategies in priority order and returns the first that works. Verified against the real `detail.html` fixture during design.

**Files:**
- Create: `scripts/event-sync/extract.ts`
- Test: `scripts/event-sync/extract.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/event-sync/extract.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as cheerio from 'cheerio'
import {
  extractTitle,
  extractDescription,
  extractImage,
  extractCategories,
} from './extract.ts'

const here = dirname(fileURLToPath(import.meta.url))
const detail = readFileSync(join(here, '__fixtures__', 'detail.html'), 'utf8')

describe('extract helpers (real lagenda detail fixture)', () => {
  const $ = cheerio.load(detail)

  it('extractTitle prefers og:title', () => {
    expect(extractTitle($, 'listing fallback')).toBe(
      'Fiestas Virgen de Las Nieves 2026 - Adeje',
    )
  })

  it('extractImage returns the og:image URL', () => {
    expect(extractImage($)).toBe(
      'https://s3-eu-west-1.amazonaws.com/beta.lagenda/programacion/virgen-nieves-adeje-2026.jpg',
    )
  })

  it('extractDescription returns non-empty clean text', () => {
    const d = extractDescription($, 'fallback')
    expect(d.length).toBeGreaterThan(30)
    expect(d).not.toBe('fallback')
  })

  it('extractCategories reads BreadcrumbList JSON-LD', () => {
    expect(extractCategories($)).toEqual(['Fiestas', 'fiestas populares'])
  })
})

describe('extract helpers (fallback behavior on empty doc)', () => {
  const $ = cheerio.load('<html><body></body></html>')

  it('extractTitle falls back to the listing title', () => {
    expect(extractTitle($, 'My Listing Title')).toBe('My Listing Title')
  })

  it('extractImage returns null when no image present', () => {
    expect(extractImage($)).toBeNull()
  })

  it('extractDescription returns the fallback when nothing found', () => {
    expect(extractDescription($, 'Fallback text.')).toBe('Fallback text.')
  })

  it('extractCategories returns empty array when none present', () => {
    expect(extractCategories($)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/event-sync/extract.test.ts`
Expected: FAIL — cannot resolve module `./extract.ts`.

- [ ] **Step 3: Write the implementation**

Create `scripts/event-sync/extract.ts`:
```ts
import type { CheerioAPI } from 'cheerio'

/** First non-empty, trimmed string from the candidates; '' if none. */
function firstNonEmpty(...vals: Array<string | undefined | null>): string {
  for (const v of vals) {
    const t = (v ?? '').trim()
    if (t) return t
  }
  return ''
}

/** og:title → itemprop="name" → first h1 → listing title. */
export function extractTitle($: CheerioAPI, listingTitle: string): string {
  return firstNonEmpty(
    $('meta[property="og:title"]').attr('content'),
    $('h1[itemprop="name"] span').first().text(),
    $('h1').first().text(),
    listingTitle,
  )
}

/** og:description → group-datos paragraphs → any long <p> → fallback. */
export function extractDescription($: CheerioAPI, fallback: string): string {
  const og = ($('meta[property="og:description"]').attr('content') ?? '').trim()
  if (og.length > 20) return og.slice(0, 1200)

  const parts: string[] = []
  $('div.group-datos p').each((_, el) => {
    const t = $(el).text().trim()
    if (t.length > 20 && parts.length < 3) parts.push(t)
  })
  if (!parts.length) {
    $('p').each((_, el) => {
      const t = $(el).text().trim()
      if (t.length > 40 && parts.length < 2) parts.push(t)
    })
  }
  const joined = parts.join(' ').slice(0, 1200).trim()
  return joined || fallback
}

/** og:image → itemprop="image" (content or src) → null. */
export function extractImage($: CheerioAPI): string | null {
  const img = firstNonEmpty(
    $('meta[property="og:image"]').attr('content'),
    $('[itemprop="image"]').attr('content'),
    $('[itemprop="image"]').attr('src'),
  )
  return img || null
}

/** BreadcrumbList JSON-LD (items linking to /categoria/) → /categoria/ links. */
export function extractCategories($: CheerioAPI): string[] {
  const cats: string[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text())
      if (json['@type'] === 'BreadcrumbList') {
        for (const it of json.itemListElement ?? []) {
          const name: string | undefined = it?.item?.name
          const id: string = it?.item?.['@id'] ?? ''
          if (name && id.includes('/categoria/') && !cats.includes(name)) {
            cats.push(name)
          }
        }
      }
    } catch {
      /* malformed JSON-LD — ignore and fall through */
    }
  })

  if (!cats.length) {
    $('div.post-category a[href^="/categoria/"]').each((_, el) => {
      const c = $(el).text().trim()
      if (c && !cats.includes(c)) cats.push(c)
    })
  }

  return cats
}

export interface TimeVenue {
  startHour: string | null
  endHour: string | null
  venueName: string | null
}

/** Scan group-datos paragraphs for the first 'HH:MM ... venue' pattern. */
export function extractTimeVenue($: CheerioAPI): TimeVenue {
  let startHour: string | null = null
  let venueName: string | null = null

  $('div.group-datos p').each((_, el) => {
    if (startHour) return
    const text = $(el).text()
    const m = text.match(/[-–]?\s*(\d{1,2}:\d{2})\s*(?:h|:)?\s*([^-\n]{0,60})/)
    if (m) {
      const hm = m[1].match(/(\d{1,2}):(\d{2})/)
      if (hm) startHour = `${hm[1].padStart(2, '0')}:${hm[2]}`
      const venue = m[2].replace(/^\s*(en |el |la |los |las )/i, '').trim()
      if (venue.length > 3 && venue.length < 80) venueName = venue
    }
  })

  return { startHour, endHour: null, venueName }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/event-sync/extract.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/event-sync/extract.ts scripts/event-sync/extract.test.ts
git commit -m "feat: layered extraction helpers for lagenda detail pages"
```

---

### Task 4: Normalize layer (`normalize.ts`)

The single place that decides an event's fate. Fills every missing text field with a default and records warnings. Drops ONLY when the date is missing/invalid (a `NOT NULL` timestamp cannot be built without it).

**Files:**
- Create: `scripts/event-sync/normalize.ts`
- Test: `scripts/event-sync/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/event-sync/normalize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeEvent } from './normalize.ts'
import type { RawEvent } from './types.ts'

function raw(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    externalId: 'lagenda:1',
    title: 'Concierto',
    description: 'Una descripción suficientemente larga para pasar.',
    date: '2026-06-15',
    startHour: '20:00',
    endHour: null,
    venueName: 'Teatro Guimerá',
    city: 'Santa Cruz de Tenerife',
    country: 'ES',
    categories: ['concierto'],
    ...overrides,
  }
}

describe('normalizeEvent', () => {
  it('keeps a complete event with no warnings', () => {
    const { event, warnings } = normalizeEvent(raw())
    expect(event).not.toBeNull()
    expect(warnings).toEqual([])
  })

  it('drops an event with no date', () => {
    const { event, warnings } = normalizeEvent(raw({ date: '' }))
    expect(event).toBeNull()
    expect(warnings).toContain('no-date')
  })

  it('drops an event with an invalid date', () => {
    const { event } = normalizeEvent(raw({ date: '15/06/2026' }))
    expect(event).toBeNull()
  })

  it('fills empty description from title + city, with a warning', () => {
    const { event, warnings } = normalizeEvent(raw({ description: '' }))
    expect(event?.description).toBe('Concierto. Santa Cruz de Tenerife.')
    expect(warnings).toContain('empty-description')
  })

  it('defaults missing start time to 19:00, with a warning', () => {
    const { event, warnings } = normalizeEvent(raw({ startHour: null }))
    expect(event?.startHour).toBe('19:00')
    expect(warnings).toContain('default-time')
  })

  it('defaults missing venue to the city, with a warning', () => {
    const { event, warnings } = normalizeEvent(raw({ venueName: '' }))
    expect(event?.venueName).toBe('Santa Cruz de Tenerife')
    expect(warnings).toContain('default-venue')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/event-sync/normalize.test.ts`
Expected: FAIL — cannot resolve module `./normalize.ts`.

- [ ] **Step 3: Write the implementation**

Create `scripts/event-sync/normalize.ts`:
```ts
import type { RawEvent } from './types.ts'

export interface NormalizeResult {
  /** null = dropped (only when the date is missing or invalid). */
  event: RawEvent | null
  warnings: string[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Fill missing fields with sensible defaults so events are never dropped for
 * incomplete data. The ONLY hard requirement is a valid 'YYYY-MM-DD' date,
 * because start_time/end_time are NOT NULL and place the event on the timeline.
 */
export function normalizeEvent(raw: RawEvent): NormalizeResult {
  if (!raw.date || !DATE_RE.test(raw.date)) {
    return { event: null, warnings: ['no-date'] }
  }

  const title = (raw.title ?? '').trim()
  if (!title) {
    return { event: null, warnings: ['no-title'] }
  }

  const warnings: string[] = []
  const city = (raw.city ?? '').trim()

  let description = (raw.description ?? '').trim()
  if (!description) {
    description = city ? `${title}. ${city}.` : `${title}.`
    warnings.push('empty-description')
  }

  let startHour = raw.startHour
  if (!startHour) {
    startHour = '19:00'
    warnings.push('default-time')
  }

  let venueName = (raw.venueName ?? '').trim()
  if (!venueName) {
    venueName = city
    warnings.push('default-venue')
  }

  return {
    event: {
      ...raw,
      title,
      description,
      city,
      startHour,
      venueName,
      categories: raw.categories ?? [],
    },
    warnings,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/event-sync/normalize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/event-sync/normalize.ts scripts/event-sync/normalize.test.ts
git commit -m "feat: normalize layer that fills defaults instead of dropping events"
```

---

### Task 5: Types + SQL for images (`types.ts`, `sql.ts`)

Carry the scraped image through to the DB `photos text[]` column (previously never populated).

**Files:**
- Modify: `scripts/event-sync/types.ts`
- Modify: `scripts/event-sync/sql.ts`
- Test: `scripts/event-sync/sql.test.ts`

- [ ] **Step 1: Add `imageUrl` to RawEvent and `photos` to MeuweEvent**

In `scripts/event-sync/types.ts`, inside `interface RawEvent`, add after `sourceUrl?`:
```ts
  /** Cover image URL (e.g. og:image), if any */
  imageUrl?: string
```

In `scripts/event-sync/types.ts`, inside `interface MeuweEvent`, add after `tags: string[]`:
```ts
  /** Cover image URLs (maps to events.photos text[]) */
  photos: string[]
```

- [ ] **Step 2: Write the failing test**

Create `scripts/event-sync/sql.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateSql } from './sql.ts'
import type { MeuweEvent } from './types.ts'

function ev(overrides: Partial<MeuweEvent> = {}): MeuweEvent {
  return {
    externalId: 'lagenda:1',
    title: 'Fiesta',
    description: 'Desc',
    lat: 28.1,
    lng: -16.7,
    placeName: 'Adeje',
    category: 'culture',
    startTime: new Date('2026-06-15T18:00:00Z'),
    endTime: new Date('2026-06-15T20:00:00Z'),
    tags: [],
    photos: [],
    ...overrides,
  }
}

const meta = { dateFrom: '2026-06-01', dateTo: '2026-06-22', generatedAt: '2026-06-01' }

describe('generateSql photos column', () => {
  it("emits '{}' for an event with no photos", () => {
    const sql = generateSql([ev()], meta)
    expect(sql).toContain('photos')
    expect(sql).toContain(`'{}'`)
  })

  it('emits a text[] array literal when a photo is present', () => {
    const sql = generateSql([ev({ photos: ['https://x/y.jpg'] })], meta)
    expect(sql).toContain(`ARRAY['https://x/y.jpg']::text[]`)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run scripts/event-sync/sql.test.ts`
Expected: FAIL — generated SQL does not contain `photos` / the array literal.

- [ ] **Step 4: Update `sql.ts` to emit the photos column**

In `scripts/event-sync/sql.ts`, add this helper right after the `pgTs` function:
```ts
// Postgres text[] literal: '{}' when empty, ARRAY[...]::text[] otherwise
function pgTextArray(arr: string[]): string {
  if (!arr.length) return `'{}'`
  return `ARRAY[${arr.map(s => `'${esc(s)}'`).join(', ')}]::text[]`
}
```

In `scripts/event-sync/sql.ts`, change the INSERT column list line from:
```ts
      `INSERT INTO events (id, title, description, lat, lng, place_name, ` +
      `category, start_time, end_time, creator_id, status, external_id) VALUES (`
```
to:
```ts
      `INSERT INTO events (id, title, description, lat, lng, place_name, ` +
      `category, start_time, end_time, creator_id, status, external_id, photos) VALUES (`
```

In `scripts/event-sync/sql.ts`, change the values line from:
```ts
    lines.push(`  team_id, 'upcoming', '${esc(ev.externalId)}'`)
```
to:
```ts
    lines.push(`  team_id, 'upcoming', '${esc(ev.externalId)}', ${pgTextArray(ev.photos)}`)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run scripts/event-sync/sql.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/event-sync/types.ts scripts/event-sync/sql.ts scripts/event-sync/sql.test.ts
git commit -m "feat: carry scraped cover image into events.photos"
```

---

### Task 6: Refactor `lagenda.ts` to use extract helpers

Replace the inline parsing in `fetchDetail` with the tested `extract.ts` helpers, expose a pure `parseDetail` for testing, and populate `imageUrl`.

**Files:**
- Modify: `scripts/event-sync/sources/lagenda.ts`
- Test: `scripts/event-sync/sources/lagenda.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/event-sync/sources/lagenda.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as cheerio from 'cheerio'
import { parseDetail, parseLagendaDate } from './lagenda.ts'

const here = dirname(fileURLToPath(import.meta.url))
const detail = readFileSync(join(here, '..', '__fixtures__', 'detail.html'), 'utf8')

describe('parseLagendaDate', () => {
  it('parses two-digit year format', () => {
    expect(parseLagendaDate('Sáb, 30/05/26')).toBe('2026-05-30')
  })
  it('parses four-digit year format', () => {
    expect(parseLagendaDate('30/05/2026')).toBe('2026-05-30')
  })
  it('returns null when no date present', () => {
    expect(parseLagendaDate('sin fecha')).toBeNull()
  })
})

describe('parseDetail (real fixture)', () => {
  const result = parseDetail(cheerio.load(detail), 'listing fallback')

  it('extracts the title from og:title', () => {
    expect(result.title).toBe('Fiestas Virgen de Las Nieves 2026 - Adeje')
  })
  it('extracts the cover image', () => {
    expect(result.imageUrl).toContain('virgen-nieves-adeje-2026.jpg')
  })
  it('extracts categories from JSON-LD', () => {
    expect(result.categories).toEqual(['Fiestas', 'fiestas populares'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/event-sync/sources/lagenda.test.ts`
Expected: FAIL — `parseDetail` is not exported from `./lagenda.ts`.

- [ ] **Step 3: Update imports in `lagenda.ts`**

In `scripts/event-sync/sources/lagenda.ts`, change the import block at the top from:
```ts
import * as cheerio from 'cheerio';
import type { Source, ScrapeOptions, RawEvent } from '../types.ts';
```
to:
```ts
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Source, ScrapeOptions, RawEvent } from '../types.ts';
import {
  extractTitle,
  extractDescription,
  extractImage,
  extractCategories,
  extractTimeVenue,
} from '../extract.ts';
```

- [ ] **Step 4: Replace `DetailResult` + `fetchDetail` with `parseDetail` + thin `fetchDetail`**

In `scripts/event-sync/sources/lagenda.ts`, add `imageUrl` to the `DetailResult` interface so it reads:
```ts
interface DetailResult {
  title: string;
  description: string;
  startHour: string | null;
  endHour: string | null;
  venueName: string;
  city: string;
  categories: string[];
  imageUrl: string | null;
}
```

In `scripts/event-sync/sources/lagenda.ts`, replace the entire `fetchDetail` function (everything from `async function fetchDetail(slug: string): Promise<DetailResult> {` through its closing `}`) with:
```ts
/** Pure: parse a loaded detail document into a DetailResult. Testable. */
export function parseDetail($: CheerioAPI, listingTitle: string): DetailResult {
  const city = $('a[href^="/lugares/"]').first().text().trim();
  const { startHour, endHour, venueName } = extractTimeVenue($);
  return {
    title:       extractTitle($, listingTitle),
    description: extractDescription($, ''),
    startHour,
    endHour,
    venueName:   venueName || city,
    city,
    categories:  extractCategories($),
    imageUrl:    extractImage($),
  };
}

async function fetchDetail(slug: string, listingTitle: string): Promise<DetailResult> {
  await sleep(PAGE_DELAY_MS);
  const url = `${BASE}/programacion/${slug}`;
  const html = await fetchHtml(url);
  return parseDetail(cheerio.load(html), listingTitle);
}
```

- [ ] **Step 5: Update the `scrape` loop to pass the listing title and carry `imageUrl`**

In `scripts/event-sync/sources/lagenda.ts`, inside the `scrape` loop, change:
```ts
        const d = await fetchDetail(s.slug);
        events.push({
          externalId:  `${this.id}:${id}`,
          title:       d.title.length > 3 ? d.title : s.title,
          description: d.description || `${s.title}. ${s.city}.`,
          date:        s.date,
          startHour:   d.startHour,
          endHour:     d.endHour,
          venueName:   d.venueName || s.city,
          city:        d.city || s.city,
          country:     'ES',
          categories:  d.categories,
          sourceUrl:   `${BASE}/programacion/${s.slug}`,
        });
```
to:
```ts
        const d = await fetchDetail(s.slug, s.title);
        events.push({
          externalId:  `${this.id}:${id}`,
          title:       d.title || s.title,
          description: d.description || `${s.title}. ${s.city}.`,
          date:        s.date,
          startHour:   d.startHour,
          endHour:     d.endHour,
          venueName:   d.venueName || s.city,
          city:        d.city || s.city,
          country:     'ES',
          categories:  d.categories,
          sourceUrl:   `${BASE}/programacion/${s.slug}`,
          imageUrl:    d.imageUrl ?? undefined,
        });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run scripts/event-sync/sources/lagenda.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/event-sync/sources/lagenda.ts scripts/event-sync/sources/lagenda.test.ts
git commit -m "refactor: lagenda detail parsing via tested extract helpers + image"
```

---

### Task 7: Wire normalize, timezone, and photos into the orchestrator (`index.ts`)

Run every raw event through `normalize`, use the DST-aware timezone helper, map the image into `photos`, count fallbacks, and print a run summary. Also export a shared Tenerife-centre constant from the geocoder for the fallback-coords warning.

**Files:**
- Modify: `scripts/event-sync/geocoder.ts`
- Modify: `scripts/event-sync/index.ts`

- [ ] **Step 1: Export a shared centre constant from the geocoder**

In `scripts/event-sync/geocoder.ts`, add near the top (after the imports):
```ts
/** Last-resort coordinates: centre of Tenerife. */
export const TENERIFE_CENTER = { lat: 28.2916, lng: -16.6291 }
```

In `scripts/event-sync/geocoder.ts`, replace the inline last-resort block:
```ts
  // 4. Centre of Tenerife as last resort
  const fallback = { lat: 28.2916, lng: -16.6291 };
  cache.set(cacheKey, fallback);
  return fallback;
```
with:
```ts
  // 4. Centre of Tenerife as last resort
  cache.set(cacheKey, TENERIFE_CENTER);
  return TENERIFE_CENTER;
```

- [ ] **Step 2: Update imports and remove the old `localToUtc` in `index.ts`**

In `scripts/event-sync/index.ts`, change the import block:
```ts
import { SOURCES } from './sources/index.ts';
import { geocode } from './geocoder.ts';
import { mapCategory } from './mapper.ts';
import { generateSql } from './sql.ts';
import type { MeuweEvent, RawEvent } from './types.ts';
```
to:
```ts
import { SOURCES } from './sources/index.ts';
import { geocode, TENERIFE_CENTER } from './geocoder.ts';
import { mapCategory } from './mapper.ts';
import { generateSql } from './sql.ts';
import { normalizeEvent } from './normalize.ts';
import { localCanaryToUtc } from './timezone.ts';
import type { MeuweEvent, RawEvent } from './types.ts';
```

In `scripts/event-sync/index.ts`, delete the entire `localToUtc` function (the comment block plus the function — from `// Canary Islands = UTC+1 ...` through the closing `}` of `localToUtc`). Keep `addHours`.

- [ ] **Step 3: Update `toMeuweEvent` to use the timezone helper, map photos, and report fallback coords**

In `scripts/event-sync/index.ts`, replace the whole `toMeuweEvent` function with:
```ts
async function toMeuweEvent(
  raw: RawEvent,
): Promise<{ event: MeuweEvent; usedFallbackCoords: boolean }> {
  const startHour = raw.startHour ?? '19:00';
  const startUtc = localCanaryToUtc(raw.date, startHour);

  let endUtc: Date;
  if (raw.endHour) {
    endUtc = localCanaryToUtc(raw.date, raw.endHour);
    // Handle midnight crossover (e.g. start 23:00, end 01:00)
    if (endUtc <= startUtc) endUtc = addHours(endUtc, 24);
  } else {
    endUtc = addHours(startUtc, 2);
  }

  const coords = await geocode(raw.venueName, raw.city, raw.country);
  const usedFallbackCoords =
    coords.lat === TENERIFE_CENTER.lat && coords.lng === TENERIFE_CENTER.lng;
  const { category, tags } = mapCategory(raw.categories);
  const placeName = [raw.venueName, raw.city].filter(Boolean).join(', ');

  return {
    event: {
      externalId: raw.externalId,
      title: raw.title,
      description: raw.description,
      lat: coords.lat,
      lng: coords.lng,
      placeName,
      category,
      startTime: startUtc,
      endTime: endUtc,
      tags,
      photos: raw.imageUrl ? [raw.imageUrl] : [],
    },
    usedFallbackCoords,
  };
}
```

- [ ] **Step 4: Replace the geocode/map loop in `main` with a normalize-first pipeline**

In `scripts/event-sync/index.ts`, replace this block in `main()`:
```ts
  // 2. Geocode + map each event to meuwe schema
  console.log('\nGeocoding...');
  const meuweEvents: MeuweEvent[] = [];
  let skipped = 0;

  for (const raw of allRaw) {
    try {
      meuweEvents.push(await toMeuweEvent(raw));
    } catch (err) {
      console.warn(`  ⚠ Skipping ${raw.externalId}: ${(err as Error).message}`);
      skipped++;
    }
  }

  console.log(`Mapped: ${meuweEvents.length} events (${skipped} skipped)`);
```
with:
```ts
  // 2. Normalize (fill defaults, never drop for missing data) → geocode → map
  console.log('\nNormalizing + geocoding...');
  const meuweEvents: MeuweEvent[] = [];
  const warningCounts: Record<string, number> = {};
  let dropped = 0;

  const bump = (key: string) => {
    warningCounts[key] = (warningCounts[key] ?? 0) + 1;
  };

  for (const raw of allRaw) {
    const { event: normalized, warnings } = normalizeEvent(raw);
    warnings.forEach(bump);

    if (!normalized) {
      dropped++;
      console.warn(`  ⚠ Dropped ${raw.externalId}: ${warnings.join(', ')}`);
      continue;
    }

    const { event, usedFallbackCoords } = await toMeuweEvent(normalized);
    if (usedFallbackCoords) bump('island-center-coords');
    meuweEvents.push(event);
  }

  console.log('\n── Run summary ──');
  console.log(`Collected: ${allRaw.length}`);
  console.log(`Kept:      ${meuweEvents.length} (${dropped} dropped)`);
  const wc = Object.entries(warningCounts);
  if (wc.length) {
    console.log('Fallbacks: ' + wc.map(([k, v]) => `${v}× ${k}`).join(', '));
  }
```

- [ ] **Step 5: Type-check the whole project**

Run: `npx tsc -b`
Expected: no output (success). Fixes any type drift across the touched files.

- [ ] **Step 6: Run the full scraper test suite**

Run: `npx vitest run scripts/event-sync`
Expected: PASS — all suites (timezone, extract, normalize, sql, lagenda) green.

- [ ] **Step 7: Commit**

```bash
git add scripts/event-sync/geocoder.ts scripts/event-sync/index.ts
git commit -m "feat: normalize-first pipeline with DST timezone, photos, run summary"
```

---

### Task 8: End-to-end smoke run (manual, optional)

Confirms the live scraper still produces a valid SQL file after the refactor. Hits the network (~700ms/event), so this is a manual check, not a test.

**Files:** none (runs the existing entry point)

- [ ] **Step 1: Run the scraper against the live site**

Run: `npm run event-sync`
Expected: log shows `▶ lagenda.org`, an event count, then the `── Run summary ──` block with `Kept:` ≥ 1 and a `Fallbacks:` line. A file `supabase/seeds/lagenda_<today>.sql` is written.

- [ ] **Step 2: Spot-check the generated SQL**

Run: `grep -c "INSERT INTO events" supabase/seeds/lagenda_$(date +%Y%m%d).sql && grep -m1 "photos" supabase/seeds/lagenda_$(date +%Y%m%d).sql`
Expected: a non-zero INSERT count and a line containing `photos` (with either `'{}'` or an `ARRAY[...]::text[]` literal).

- [ ] **Step 3: Do NOT commit the generated SQL here**

The GitHub Actions workflow owns committing seed files. Leave the generated file untracked/uncommitted unless you intend to load it. If you want to discard it:
```bash
git checkout -- supabase/seeds/ 2>/dev/null; git clean -f supabase/seeds/lagenda_$(date +%Y%m%d).sql
```

---

## Self-Review

**Spec coverage:**
- Odporność selektorów → Task 3 (`extract.ts` fallback chains), Task 6 (lagenda uses them). ✓
- Jakość ekstrakcji: og: fields → Task 3; image/photos → Tasks 5–7; categories via JSON-LD → Task 3; timezone → Tasks 2, 7. ✓
- Walidacja bez wyrzucania → Task 4 (`normalize.ts`), wired in Task 7. ✓
- Wykrywanie regresji → Task 1 fixtures + tests in Tasks 2–6. ✓
- Run summary → Task 7 Step 4. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `RawEvent.imageUrl?: string` (Task 5) is read in Task 6 (`d.imageUrl ?? undefined`) and Task 7 (`raw.imageUrl ? [raw.imageUrl] : []`). `MeuweEvent.photos: string[]` (Task 5) is produced in Task 7 and consumed by `pgTextArray` in Task 5. `parseDetail`/`extractTimeVenue`/`canaryOffsetHours`/`localCanaryToUtc`/`normalizeEvent`/`TENERIFE_CENTER` names are consistent across tasks. `DetailResult` gains `imageUrl: string | null` (Task 6) matching `extractImage` return type. ✓
