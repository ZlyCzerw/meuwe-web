# Event-sync v2 (regions + Rzeszów) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `scripts/event-sync/` into a region-aware pipeline (Tenerife = region 1, unchanged behavior) and add the Rzeszów region with venue-or-drop geo precision, a curated venue registry, cross-source dedup, and three verified sources (eBilet API, Estrada Rzeszowska, MGOK Tyczyn RSS).

**Architecture:** A `RegionConfig` object carries everything region-specific (timezone, country, bbox, city coords, venue registry, sources, precision policy). The orchestrator (`index.ts`) takes `--region=<id>`, geocodes via a new `Geocoder` class (registry → Nominatim bbox-validated → strict drop / lenient v1 chain), dedupes across sources, and emits an idempotent SQL seed guarded by an external-id alias table.

**Tech Stack:** Node/tsx, TypeScript, cheerio, vitest, Nominatim, Supabase (manual SQL seeds).

**Spec:** `docs/superpowers/specs/2026-07-03-event-sync-v2-rzeszow-design.md`
**Source catalogue:** `docs/event-sources-rzeszow.md` (verified 2026-07-03)

**Conventions:** repo root `/Users/wiktormarc/meuwe-web`; run all commands there. Tests: `npx vitest run <file>` (or `npm test` for all). Typecheck: `npm run typecheck:scraper`. All code files use the existing style: ESM, `.ts` import suffixes, 2-space indent.

**Raw research captures** (2026-07-03, this session's scratchpad — use to build fixtures if live sites act up):
`/private/tmp/claude-501/-Users-wiktormarc-TEST/728e85a5-0d75-4f21-b883-bbf8025047c3/scratchpad/` — `ebilet.html` (city landing), `estrada.html` (listing/homepage), `estrada_detail.html`, `b_mgoktyczyn-feed.html` (RSS).

---

### Task 1: Generalize timezone helpers

**Files:**
- Modify: `scripts/event-sync/timezone.ts`
- Test: `scripts/event-sync/timezone.test.ts`

- [ ] **Step 1: Add failing tests for `localToUtc` with Europe/Warsaw**

Append to `scripts/event-sync/timezone.test.ts`:

```ts
import { localToUtc } from './timezone.ts'

describe('localToUtc (Europe/Warsaw)', () => {
  it('converts summer (CEST, UTC+2) local time to UTC', () => {
    expect(localToUtc('2026-07-15', '19:00', 'Europe/Warsaw').toISOString())
      .toBe('2026-07-15T17:00:00.000Z')
  })
  it('converts winter (CET, UTC+1) local time to UTC', () => {
    expect(localToUtc('2026-01-15', '19:00', 'Europe/Warsaw').toISOString())
      .toBe('2026-01-15T18:00:00.000Z')
  })
  it('still handles Atlantic/Canary', () => {
    expect(localToUtc('2026-07-15', '19:00', 'Atlantic/Canary').toISOString())
      .toBe('2026-07-15T18:00:00.000Z')
  })
})
```

(The existing import line already imports from `./timezone.ts`; merge imports.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/event-sync/timezone.test.ts`
Expected: FAIL — `localToUtc` is not exported.

- [ ] **Step 3: Implement `localToUtc` / `tzOffsetHours`**

Replace the body of `scripts/event-sync/timezone.ts` with:

```ts
/**
 * Timezone helpers. Works for any IANA zone whose offset is a whole number
 * of hours (Atlantic/Canary: UTC+0/+1, Europe/Warsaw: UTC+1/+2).
 */

/** Offset in whole hours of `timeZone` from UTC for the given instant. */
export function tzOffsetHours(date: Date, timeZone: string): number {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find(p => p.type === 'timeZoneName')?.value ?? 'GMT'
  // part looks like 'GMT', 'GMT+1', 'GMT-1'
  const m = part.match(/GMT([+-]\d{1,2})?/)
  return m && m[1] ? parseInt(m[1], 10) : 0
}

/**
 * Convert a local date+time ('YYYY-MM-DD', 'HH:MM') in `timeZone` to a UTC
 * Date, accounting for the correct DST offset on that calendar day.
 */
export function localToUtc(date: string, hour: string, timeZone: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, min] = hour.split(':').map(Number)
  const offset = tzOffsetHours(new Date(Date.UTC(y, mo - 1, d, 12)), timeZone)
  return new Date(Date.UTC(y, mo - 1, d, h - offset, min))
}

export function canaryOffsetHours(date: Date): number {
  return tzOffsetHours(date, 'Atlantic/Canary')
}

export function localCanaryToUtc(date: string, hour: string): Date {
  return localToUtc(date, hour, 'Atlantic/Canary')
}
```

- [ ] **Step 4: Run the full timezone test file**

Run: `npx vitest run scripts/event-sync/timezone.test.ts`
Expected: PASS (old Canary tests + new Warsaw tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/event-sync/timezone.ts scripts/event-sync/timezone.test.ts
git commit -m "feat(event-sync): generalize timezone helpers to any IANA zone"
```

---

### Task 2: RegionConfig types + Tenerife region extraction + `--region` CLI

**Files:**
- Modify: `scripts/event-sync/types.ts`
- Create: `scripts/event-sync/regions/tenerife.ts`
- Create: `scripts/event-sync/regions/index.ts`
- Modify: `scripts/event-sync/geocoder.ts` (mechanical: take region param)
- Modify: `scripts/event-sync/mapper.ts` (remove municipality map)
- Modify: `scripts/event-sync/index.ts`
- Test: `scripts/event-sync/regions/regions.test.ts`

- [ ] **Step 1: Add region types to `types.ts`**

Append to `scripts/event-sync/types.ts`:

```ts
// ─── Region configuration ─────────────────────────────────────────────────────

export interface Bbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** A hand-verified venue with normalized name aliases for registry matching. */
export interface VenueEntry {
  /** Canonical display name */
  name: string;
  /** Normalized aliases (lowercase, no diacritics — see geocoder normalizeName) */
  aliases: string[];
  city: string;
  lat: number;
  lng: number;
}

export interface RegionConfig {
  id: string;
  /** IANA timezone, e.g. 'Europe/Warsaw' */
  timezone: string;
  /** ISO country code, e.g. 'PL' */
  country: string;
  /** Every strict-mode geocode result must fall inside this box */
  bbox: Bbox;
  /** Last-resort coords (lenient mode only) */
  center: Coords;
  /** Municipality fallback coords, keyed by lowercase city name */
  cityCoords: Record<string, Coords>;
  venues: VenueEntry[];
  sources: Source[];
  /** 'strict': venue or drop. 'lenient': v1 fallback chain. */
  precision: 'strict' | 'lenient';
}
```

Also add the optional street address to `RawEvent` (after the `city` field):

```ts
  /** Street address if the source provides one, e.g. 'Chopina 30' */
  address?: string;
```

- [ ] **Step 2: Write the failing region-registry test**

Create `scripts/event-sync/regions/regions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { REGIONS } from './index.ts'

describe('REGIONS registry', () => {
  it('exposes the tenerife region with v1 behavior flags', () => {
    const t = REGIONS.tenerife
    expect(t.id).toBe('tenerife')
    expect(t.timezone).toBe('Atlantic/Canary')
    expect(t.country).toBe('ES')
    expect(t.precision).toBe('lenient')
    expect(t.center).toEqual({ lat: 28.2916, lng: -16.6291 })
    expect(t.cityCoords['adeje']).toEqual({ lat: 28.1222, lng: -16.7270 })
    expect(t.sources.length).toBeGreaterThanOrEqual(7)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run scripts/event-sync/regions/regions.test.ts`
Expected: FAIL — cannot resolve `./index.ts`.

- [ ] **Step 4: Create `regions/tenerife.ts`**

Move the municipality map out of `mapper.ts` verbatim. Create `scripts/event-sync/regions/tenerife.ts`:

```ts
import type { Coords, RegionConfig } from '../types.ts'
import { LagendaSource } from '../sources/lagenda.ts'
import { TribeEventsSource } from '../sources/tribe.ts'
import { EcoEntradasSource } from '../sources/ecoentradas.ts'
import { TenerifeMusicSource } from '../sources/tenerifemusic.ts'
import { RomeriasSource } from '../sources/romerias.ts'
import { AronaSource } from '../sources/arona.ts'
import { AdejeSource } from '../sources/adeje.ts'

// Moved verbatim from mapper.ts (MUNICIPALITY_COORDS).
const CITY_COORDS: Record<string, Coords> = {
  // ⟨copy the ENTIRE MUNICIPALITY_COORDS object literal from mapper.ts:32-81,
  //  including the other-islands entries — do not retype, cut & paste⟩
}

export const TENERIFE: RegionConfig = {
  id: 'tenerife',
  timezone: 'Atlantic/Canary',
  country: 'ES',
  bbox: { minLat: 27.99, maxLat: 28.62, minLng: -16.95, maxLng: -16.10 },
  center: { lat: 28.2916, lng: -16.6291 },
  cityCoords: CITY_COORDS,
  venues: [], // v1 had no venue registry; backfilling is out of scope
  precision: 'lenient',
  sources: [
    new LagendaSource(),
    new TribeEventsSource(),
    new EcoEntradasSource(),
    new TenerifeMusicSource(),
    new RomeriasSource(),
    new AronaSource(),
    new AdejeSource(),
  ],
}
```

Create `scripts/event-sync/regions/index.ts`:

```ts
import type { RegionConfig } from '../types.ts'
import { TENERIFE } from './tenerife.ts'

export const REGIONS: Record<string, RegionConfig> = {
  tenerife: TENERIFE,
}
```

- [ ] **Step 5: Slim down `mapper.ts`**

In `scripts/event-sync/mapper.ts`: delete `MUNICIPALITY_COORDS` and `fallbackCoords` (lines 29-90) and the now-unused `Coords` import. Keep `CATEGORY_RULES` + `mapCategory` untouched. Then check nothing else imported them:

Run: `grep -rn "MUNICIPALITY_COORDS\|fallbackCoords" scripts/ --include="*.ts"`
Expected: hits only in `geocoder.ts` (fixed next step). If `sources/tribe.ts` mentions them in a comment, update the comment to point at `regions/tenerife.ts`.

- [ ] **Step 6: Make `geocoder.ts` region-aware (mechanical, v1 logic intact)**

Replace `scripts/event-sync/geocoder.ts` with:

```ts
import type { Coords, RegionConfig } from './types.ts'

const cache = new Map<string, Coords>()
const UA = 'meuwe-event-sync/1.0 (meuwe@gmail.com)'
let lastCall = 0

async function nominatim(query: string): Promise<Coords | null> {
  const wait = 1100 - (Date.now() - lastCall)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastCall = Date.now()
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

function fallbackCoords(city: string, cityCoords: Record<string, Coords>): Coords | null {
  const key = city.toLowerCase().trim()
  if (cityCoords[key]) return cityCoords[key]
  for (const [k, v] of Object.entries(cityCoords)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

const COUNTRY_NAMES: Record<string, string> = { ES: 'Spain', PL: 'Poland' }

/** v1 geocoding chain, parameterized by region. Replaced by Geocoder in Task 4. */
export async function geocode(venueName: string, city: string, region: RegionConfig): Promise<Coords> {
  const cacheKey = `${region.id}|${venueName}|${city}`.toLowerCase()
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  const countryName = COUNTRY_NAMES[region.country] ?? region.country

  if (venueName && venueName !== city) {
    const c = await nominatim(`${venueName}, ${city}, ${countryName}`)
    if (c) { cache.set(cacheKey, c); return c }
  }
  const c2 = await nominatim(`${city}, ${countryName}`)
  if (c2) { cache.set(cacheKey, c2); return c2 }

  const fb = fallbackCoords(city, region.cityCoords)
  if (fb) { cache.set(cacheKey, fb); return fb }

  cache.set(cacheKey, region.center)
  return region.center
}
```

- [ ] **Step 7: Rewire `index.ts` for regions**

Replace `scripts/event-sync/index.ts` with:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REGIONS } from './regions/index.ts';
import { geocode } from './geocoder.ts';
import { mapCategory } from './mapper.ts';
import { generateSql } from './sql.ts';
import { normalizeEvent } from './normalize.ts';
import { localToUtc } from './timezone.ts';
import type { MeuweEvent, RawEvent, RegionConfig } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'seeds');
const LOOKAHEAD_DAYS = 21;

function resolveRegion(): RegionConfig {
  const arg = process.argv.find(a => a.startsWith('--region='));
  const id = arg?.split('=')[1];
  if (!id || !REGIONS[id]) {
    console.error(`Usage: npm run event-sync -- --region=<${Object.keys(REGIONS).join('|')}>`);
    process.exit(1);
  }
  return REGIONS[id];
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}

async function toMeuweEvent(
  raw: RawEvent,
  region: RegionConfig,
): Promise<{ event: MeuweEvent; usedFallbackCoords: boolean }> {
  const startHour = raw.startHour ?? '19:00';
  const startUtc = localToUtc(raw.date, startHour, region.timezone);

  let endUtc: Date;
  if (raw.endHour) {
    endUtc = localToUtc(raw.date, raw.endHour, region.timezone);
    if (endUtc <= startUtc) endUtc = addHours(endUtc, 24);
  } else {
    endUtc = addHours(startUtc, 2);
  }

  const coords = await geocode(raw.venueName, raw.city, region);
  const usedFallbackCoords =
    coords.lat === region.center.lat && coords.lng === region.center.lng;
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

async function main() {
  const region   = resolveRegion();
  const now      = new Date();
  const dateFrom = new Date(now);
  const dateTo   = new Date(now);
  dateTo.setDate(dateTo.getDate() + LOOKAHEAD_DAYS);

  const runDate  = now.toISOString().slice(0, 10);
  const dateFromStr = dateFrom.toISOString().slice(0, 10);
  const dateToStr   = dateTo.toISOString().slice(0, 10);

  console.log(`\nevent-sync — ${runDate} — region: ${region.id}`);
  console.log(`Range: ${dateFromStr} → ${dateToStr}`);
  console.log(`Sources: ${region.sources.map(s => s.name).join(', ')}\n`);

  const allRaw: RawEvent[] = [];

  for (const source of region.sources) {
    console.log(`\n▶ ${source.name}`);
    try {
      const raw = await source.scrape({ dateFrom, dateTo });
      console.log(`  → ${raw.length} events collected`);
      allRaw.push(...raw);
    } catch (err) {
      console.error(`  ✗ ${source.name} failed: ${(err as Error).message}`);
    }
  }

  console.log(`\nTotal raw events: ${allRaw.length}`);

  if (!allRaw.length) {
    console.log('Nothing to write. Exiting.');
    return;
  }

  console.log('\nNormalizing + geocoding...');
  const meuweEvents: MeuweEvent[] = [];
  const fallbackCounts: Record<string, number> = {};
  let dropped = 0;

  const bump = (key: string) => {
    fallbackCounts[key] = (fallbackCounts[key] ?? 0) + 1;
  };

  for (const raw of allRaw) {
    const { event: normalized, warnings } = normalizeEvent(raw);

    if (!normalized) {
      dropped++;
      console.warn(`  ⚠ Dropped ${raw.externalId}: ${warnings.join(', ')}`);
      continue;
    }

    warnings.forEach(bump);
    const { event, usedFallbackCoords } = await toMeuweEvent(normalized, region);
    if (usedFallbackCoords) bump('region-center-coords');
    meuweEvents.push(event);
  }

  console.log('\n── Run summary ──');
  console.log(`Collected: ${allRaw.length}`);
  console.log(`Kept:      ${meuweEvents.length} (${dropped} dropped)`);
  const wc = Object.entries(fallbackCounts);
  if (wc.length) {
    console.log('Fallbacks: ' + wc.map(([k, v]) => `${v}× ${k}`).join(', '));
  }

  const sql = generateSql(meuweEvents, {
    dateFrom: dateFromStr,
    dateTo:   dateToStr,
    generatedAt: runDate,
  });

  const filename = `events_${region.id}_${runDate.replace(/-/g, '')}.sql`;
  const filepath = path.join(SEEDS_DIR, filename);
  fs.writeFileSync(filepath, sql, 'utf8');

  console.log(`\n✅ Written to supabase/seeds/${filename}`);
  console.log(`   ${meuweEvents.length} events — paste into Supabase Dashboard → SQL Editor → Run\n`);
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
```

Delete the old `SOURCES` list: `scripts/event-sync/sources/index.ts` is now unused — remove the `SOURCES` export but keep the file's doc-comment header, re-pointing it: sources are registered in `scripts/event-sync/regions/<region>.ts`. (Or delete the file if nothing imports it: `grep -rn "sources/index" scripts/ --include="*.ts"`.)

- [ ] **Step 8: Run tests + typecheck**

Run: `npx vitest run scripts/event-sync/ && npm run typecheck:scraper`
Expected: all existing tests PASS (regression gate) + the new regions test PASSES.

- [ ] **Step 9: Commit**

```bash
git add scripts/event-sync/
git commit -m "refactor(event-sync): region-aware pipeline; tenerife extracted to RegionConfig"
```

---

### Task 3: Rzeszów region config + venue registry + coordinate verification

**Files:**
- Create: `scripts/event-sync/regions/rzeszow-venues.ts`
- Create: `scripts/event-sync/regions/rzeszow.ts`
- Modify: `scripts/event-sync/regions/index.ts`
- Create: `scripts/event-sync/verify-venues.ts` (one-off maintenance script)
- Test: `scripts/event-sync/regions/regions.test.ts`

- [ ] **Step 1: Add failing test for the rzeszow region**

Append to `scripts/event-sync/regions/regions.test.ts`:

```ts
describe('rzeszow region', () => {
  it('is strict, Polish, and covers the surrounding towns', () => {
    const r = REGIONS.rzeszow
    expect(r.precision).toBe('strict')
    expect(r.timezone).toBe('Europe/Warsaw')
    expect(r.country).toBe('PL')
    for (const town of ['rzeszów', 'tyczyn', 'boguchwała', 'łańcut', 'jasionka']) {
      expect(r.cityCoords[town], town).toBeDefined()
    }
  })
  it('every venue and city sits inside the region bbox', () => {
    const r = REGIONS.rzeszow
    const inBox = (lat: number, lng: number) =>
      lat >= r.bbox.minLat && lat <= r.bbox.maxLat && lng >= r.bbox.minLng && lng <= r.bbox.maxLng
    for (const v of r.venues) expect(inBox(v.lat, v.lng), v.name).toBe(true)
    for (const [city, c] of Object.entries(r.cityCoords)) expect(inBox(c.lat, c.lng), city).toBe(true)
  })
  it('venue aliases are already normalized (lowercase ascii)', () => {
    for (const v of REGIONS.rzeszow.venues)
      for (const a of v.aliases)
        expect(a, `${v.name}: "${a}"`).toMatch(/^[a-z0-9 ]+$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/event-sync/regions/regions.test.ts`
Expected: FAIL — `REGIONS.rzeszow` undefined.

- [ ] **Step 3: Create the venue registry**

Create `scripts/event-sync/regions/rzeszow-venues.ts`. Coordinates below are best-effort placements — Step 6 verifies each against Nominatim and you fix any that land >250 m off or outside the right street:

```ts
import type { VenueEntry } from '../types.ts'

/**
 * Hand-curated venues for the Rzeszów region. Matching: geocoder normalizes
 * the scraped venue string (lowercase, diacritics stripped) and checks
 * equality or substring against these aliases — order matters, first match
 * wins, so keep more specific entries above generic ones (e.g. 'skwer
 * kultury' before 'rynek').
 *
 * Grow this list from the "no-venue-match" block in each run summary.
 */
export const RZESZOW_VENUES: VenueEntry[] = [
  { name: 'Hala Podpromie (RSCW)', city: 'Rzeszów', lat: 50.0295, lng: 22.0072,
    aliases: ['podpromie', 'regionalne centrum widowiskowo sportowe'] },
  { name: 'Millenium Hall', city: 'Rzeszów', lat: 50.0323, lng: 22.0121,
    aliases: ['millenium hall', 'millennium hall'] },
  { name: 'G2A Arena (CWK Jasionka)', city: 'Jasionka', lat: 50.0940, lng: 22.0230,
    aliases: ['g2a arena', 'centrum wystawienniczo kongresowe', 'cwk jasionka'] },
  { name: 'Filharmonia Podkarpacka', city: 'Rzeszów', lat: 50.0435, lng: 22.0087,
    aliases: ['filharmonia podkarpacka', 'filharmonia im artura malawskiego'] },
  { name: 'Teatr im. Wandy Siemaszkowej', city: 'Rzeszów', lat: 50.0410, lng: 22.0037,
    aliases: ['teatr im wandy siemaszkowej', 'teatr siemaszkowej'] },
  { name: 'Teatr Maska', city: 'Rzeszów', lat: 50.0378, lng: 22.0079,
    aliases: ['teatr maska'] },
  { name: 'Kino Zorza', city: 'Rzeszów', lat: 50.0341, lng: 22.0056,
    aliases: ['kino zorza'] },
  { name: 'Wojewódzki Dom Kultury w Rzeszowie', city: 'Rzeszów', lat: 50.0426, lng: 22.0021,
    aliases: ['wojewodzki dom kultury', 'wdk rzeszow'] },
  { name: 'Rzeszowskie Piwnice / Skwer Kultury', city: 'Rzeszów', lat: 50.0374, lng: 22.0047,
    aliases: ['rzeszowskie piwnice', 'skwer kultury'] },
  { name: 'Rynek w Rzeszowie', city: 'Rzeszów', lat: 50.0374, lng: 22.0047,
    aliases: ['rynek'] },
  { name: 'Stadion Stal Rzeszów', city: 'Rzeszów', lat: 50.0208, lng: 22.0021,
    aliases: ['stadion stal', 'stadion miejski stal rzeszow', 'stal rzeszow'] },
  { name: 'Muzeum-Zamek w Łańcucie', city: 'Łańcut', lat: 50.0673, lng: 22.2323,
    aliases: ['zamek w lancucie', 'muzeum zamek', 'zamek lancut'] },
  { name: 'MDK Łańcut', city: 'Łańcut', lat: 50.0687, lng: 22.2291,
    aliases: ['mdk lancut', 'miejski dom kultury w lancucie'] },
  { name: 'MGOK Tyczyn', city: 'Tyczyn', lat: 49.9629, lng: 22.0345,
    aliases: ['mgok tyczyn', 'mgok', 'osrodek kultury w tyczynie'] },
  { name: 'MCK Boguchwała', city: 'Boguchwała', lat: 49.9860, lng: 21.9430,
    aliases: ['mck boguchwala', 'centrum kultury w boguchwale'] },
]
```

- [ ] **Step 4: Create `regions/rzeszow.ts` and register it**

Create `scripts/event-sync/regions/rzeszow.ts`:

```ts
import type { RegionConfig } from '../types.ts'
import { RZESZOW_VENUES } from './rzeszow-venues.ts'

export const RZESZOW: RegionConfig = {
  id: 'rzeszow',
  timezone: 'Europe/Warsaw',
  country: 'PL',
  // Covers Rzeszów + Tyczyn, Boguchwała, Łańcut, Jasionka with margin.
  bbox: { minLat: 49.90, maxLat: 50.20, minLng: 21.80, maxLng: 22.35 },
  center: { lat: 50.0412, lng: 21.9991 },
  cityCoords: {
    'rzeszów':            { lat: 50.0412, lng: 21.9991 },
    'rzeszow':            { lat: 50.0412, lng: 21.9991 },
    'tyczyn':             { lat: 49.9628, lng: 22.0333 },
    'boguchwała':         { lat: 49.9864, lng: 21.9426 },
    'boguchwala':         { lat: 49.9864, lng: 21.9426 },
    'łańcut':             { lat: 50.0687, lng: 22.2291 },
    'lancut':             { lat: 50.0687, lng: 22.2291 },
    'jasionka':           { lat: 50.1109, lng: 22.0242 },
    'trzebownisko':       { lat: 50.0790, lng: 22.0570 },
    'krasne':             { lat: 50.0350, lng: 22.0940 },
    'głogów małopolski':  { lat: 50.1500, lng: 21.9611 },
    'świlcza':            { lat: 50.0530, lng: 21.9070 },
  },
  venues: RZESZOW_VENUES,
  precision: 'strict',
  sources: [], // filled by Tasks 8-10
}
```

Update `scripts/event-sync/regions/index.ts`:

```ts
import type { RegionConfig } from '../types.ts'
import { TENERIFE } from './tenerife.ts'
import { RZESZOW } from './rzeszow.ts'

export const REGIONS: Record<string, RegionConfig> = {
  tenerife: TENERIFE,
  rzeszow: RZESZOW,
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run scripts/event-sync/regions/regions.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify registry coordinates against Nominatim**

Create `scripts/event-sync/verify-venues.ts` (maintenance script, not part of the sync run):

```ts
/**
 * One-off check: compares each RZESZOW_VENUES entry against Nominatim and
 * prints the distance. Run after editing the registry:
 *   npx tsx scripts/event-sync/verify-venues.ts
 * Investigate anything > 250 m (or NO RESULT) and fix coords by hand
 * (OpenStreetMap / Google Maps), then re-run.
 */
import { RZESZOW_VENUES } from './regions/rzeszow-venues.ts'

const UA = 'meuwe-event-sync/2.0 (meuwe@gmail.com)'

function distMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(s)))
}

for (const v of RZESZOW_VENUES) {
  await new Promise(r => setTimeout(r, 1100))
  const q = encodeURIComponent(`${v.name.split('(')[0].trim()}, ${v.city}, Poland`)
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { 'User-Agent': UA } },
  )
  const hits = await res.json() as Array<{ lat: string; lon: string; display_name: string }>
  if (!hits.length) { console.log(`?? NO RESULT   ${v.name}`); continue }
  const d = distMeters(v.lat, v.lng, parseFloat(hits[0].lat), parseFloat(hits[0].lon))
  const flag = d > 250 ? '⚠️ ' : 'ok '
  console.log(`${flag} ${String(d).padStart(5)}m  ${v.name}  (${hits[0].display_name.slice(0, 60)})`)
}
```

Run: `npx tsx scripts/event-sync/verify-venues.ts`
Expected: a line per venue. **Fix every ⚠️/NO RESULT entry's coords in `rzeszow-venues.ts`** using OSM, then re-run until distances are plausible (registry coords are the source of truth; small Nominatim offsets on correct venues are fine — judge, don't blindly copy).

- [ ] **Step 7: Re-run region tests (bbox guard) + commit**

Run: `npx vitest run scripts/event-sync/regions/regions.test.ts`
Expected: PASS.

```bash
git add scripts/event-sync/regions/ scripts/event-sync/verify-venues.ts
git commit -m "feat(event-sync): rzeszow region config + curated venue registry"
```

---

### Task 4: Geocoder v2 — registry, bbox validation, strict mode, persistent cache

**Files:**
- Rewrite: `scripts/event-sync/geocoder.ts`
- Modify: `scripts/event-sync/index.ts` (geocode call sites)
- Modify: `.gitignore`
- Test: `scripts/event-sync/geocoder.test.ts` (new)

- [ ] **Step 1: Write failing geocoder tests**

Create `scripts/event-sync/geocoder.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeName, matchVenue, inBbox, Geocoder } from './geocoder.ts'
import { REGIONS } from './regions/index.ts'

const rzeszow = REGIONS.rzeszow
const tmpCache = () => join(mkdtempSync(join(tmpdir(), 'geo-')), 'cache.json')

afterEach(() => vi.unstubAllGlobals())

describe('normalizeName', () => {
  it('strips Polish diacritics incl. ł', () => {
    expect(normalizeName('Zamek w Łańcucie')).toBe('zamek w lancucie')
  })
  it('drops punctuation and collapses whitespace', () => {
    expect(normalizeName('Teatr im. Wandy  Siemaszkowej!')).toBe('teatr im wandy siemaszkowej')
  })
})

describe('matchVenue', () => {
  it('matches a registry venue by substring alias', () => {
    const v = matchVenue('Filharmonia Podkarpacka im. Artura Malawskiego', rzeszow)
    expect(v?.name).toBe('Filharmonia Podkarpacka')
  })
  it('matches Skwer Kultury inside a longer place string', () => {
    const v = matchVenue('Skwer Kultury w Rzeszowie, Rynek', rzeszow)
    expect(v?.name).toBe('Rzeszowskie Piwnice / Skwer Kultury')
  })
  it('returns null for unknown venues', () => {
    expect(matchVenue('Klub Nieznany', rzeszow)).toBeNull()
  })
})

describe('inBbox', () => {
  it('accepts a point inside and rejects one outside', () => {
    expect(inBbox({ lat: 50.04, lng: 22.0 }, rzeszow.bbox)).toBe(true)
    expect(inBbox({ lat: 52.23, lng: 21.01 }, rzeszow.bbox)).toBe(false) // Warsaw
  })
})

describe('Geocoder (strict)', () => {
  it('resolves a registry venue without any network call', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const geo = new Geocoder(rzeszow, tmpCache())
    const r = await geo.geocode('Hala Podpromie', 'Rzeszów')
    expect(r.method).toBe('venue-registry')
    expect(r.coords?.lat).toBeCloseTo(50.02, 1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns method none when Nominatim has nothing (strict drop)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })))
    const geo = new Geocoder(rzeszow, tmpCache())
    const r = await geo.geocode('Klub Nieznany', 'Rzeszów')
    expect(r).toEqual({ coords: null, method: 'none' })
  })

  it('rejects a Nominatim hit outside the bbox (strict)', async () => {
    const warsaw = JSON.stringify([{ lat: '52.2297', lon: '21.0122' }])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(warsaw, { status: 200 })))
    const geo = new Geocoder(rzeszow, tmpCache())
    const r = await geo.geocode('Klub Nieznany', 'Rzeszów')
    expect(r.method).toBe('none')
  })

  it('persists hits to the cache file and reuses them', async () => {
    const inRegion = JSON.stringify([{ lat: '50.05', lon: '22.01' }])
    const fetchSpy = vi.fn(async () => new Response(inRegion, { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const cachePath = tmpCache()
    const geo1 = new Geocoder(rzeszow, cachePath)
    await geo1.geocode('Jakiś Klub', 'Rzeszów')
    geo1.save()
    const geo2 = new Geocoder(rzeszow, cachePath)
    const r = await geo2.geocode('Jakiś Klub', 'Rzeszów')
    expect(r.coords?.lat).toBeCloseTo(50.05)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('Geocoder (lenient = tenerife)', () => {
  it('falls back to cityCoords then center instead of dropping', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })))
    const geo = new Geocoder(REGIONS.tenerife, tmpCache())
    const r = await geo.geocode('Sitio Desconocido', 'Adeje')
    expect(r.method).toBe('city-fallback')
    expect(r.coords).toEqual({ lat: 28.1222, lng: -16.7270 })
    const r2 = await geo.geocode('Sitio Desconocido', 'Ciudad Inexistente XYZ')
    expect(r2.method).toBe('region-center')
    expect(r2.coords).toEqual(REGIONS.tenerife.center)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/event-sync/geocoder.test.ts`
Expected: FAIL — `normalizeName`/`Geocoder` not exported.

- [ ] **Step 3: Rewrite `geocoder.ts`**

Replace the whole file with:

```ts
import fs from 'node:fs'
import type { Bbox, Coords, RegionConfig, VenueEntry } from './types.ts'

export type GeoMethod =
  | 'venue-registry'  // hand-curated coords, no network
  | 'nominatim'       // venue-level Nominatim hit (bbox-validated when strict)
  | 'city-fallback'   // lenient only: city centroid
  | 'region-center'   // lenient only: last resort
  | 'none'            // strict only: event must be dropped

export interface GeoResult {
  coords: Coords | null
  method: GeoMethod
}

const UA = 'meuwe-event-sync/2.0 (meuwe@gmail.com)'
const MISS_TTL_MS = 7 * 24 * 3_600_000 // negative cache entries self-heal after a week

/** lowercase, Polish/Spanish diacritics stripped, punctuation → space. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inBbox(c: Coords, b: Bbox): boolean {
  return c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng
}

/** First venue whose alias equals or is contained in the normalized name wins. */
export function matchVenue(venueName: string, region: RegionConfig): VenueEntry | null {
  const norm = normalizeName(venueName)
  if (!norm) return null
  for (const v of region.venues) {
    if (v.aliases.some(a => norm === a || norm.includes(a))) return v
  }
  return null
}

type CacheEntry = Coords | { miss: true; at: string }
const COUNTRY_NAMES: Record<string, string> = { ES: 'Spain', PL: 'Poland' }

export class Geocoder {
  private cache: Record<string, CacheEntry> = {}
  private lastCall = 0

  constructor(private region: RegionConfig, private cachePath: string) {
    if (fs.existsSync(cachePath)) {
      try { this.cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) } catch { /* corrupt cache = empty */ }
    }
  }

  save(): void {
    fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 1), 'utf8')
  }

  private async nominatim(params: URLSearchParams, validateBbox: boolean): Promise<Coords | null> {
    const wait = 1100 - (Date.now() - this.lastCall) // Nominatim ToS: max 1 req/s
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    this.lastCall = Date.now()
    try {
      params.set('format', 'json')
      params.set('limit', '3')
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': UA },
      })
      if (!res.ok) return null
      const data = await res.json() as Array<{ lat: string; lon: string }>
      for (const hit of data) {
        const c = { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) }
        if (!validateBbox || inBbox(c, this.region.bbox)) return c
      }
      return null
    } catch {
      return null
    }
  }

  async geocode(venueName: string, city: string, address?: string): Promise<GeoResult> {
    // 1. Venue registry — instant, hand-verified.
    const v = matchVenue(venueName, this.region)
    if (v) return { coords: { lat: v.lat, lng: v.lng }, method: 'venue-registry' }

    const strict = this.region.precision === 'strict'
    const key = normalizeName(`${this.region.id} ${venueName} ${city} ${address ?? ''}`)
    const cached = this.cache[key]
    if (cached) {
      if (!('miss' in cached)) return { coords: cached, method: 'nominatim' }
      if (Date.now() - Date.parse(cached.at) < MISS_TTL_MS) return this.fallback(city)
      delete this.cache[key] // expired negative entry → retry
    }

    const cc = this.region.country.toLowerCase()
    let coords: Coords | null = null

    // 2. Structured query with street address — most precise.
    if (address) {
      coords = await this.nominatim(
        new URLSearchParams({ street: address, city, countrycodes: cc }), strict)
    }

    // 3. Free-text venue + city; in strict mode bounded to the region viewbox.
    if (!coords && venueName && venueName !== city) {
      const params = new URLSearchParams({ q: `${venueName}, ${city}`, countrycodes: cc })
      if (strict) {
        const b = this.region.bbox
        params.set('viewbox', `${b.minLng},${b.maxLat},${b.maxLng},${b.minLat}`)
        params.set('bounded', '1')
      }
      coords = await this.nominatim(params, strict)
    }

    if (coords) {
      this.cache[key] = coords
      return { coords, method: 'nominatim' }
    }
    this.cache[key] = { miss: true, at: new Date().toISOString() }
    return this.fallback(city)
  }

  /** strict: drop. lenient: v1 chain — city query → cityCoords → center. */
  private async fallback(city: string): Promise<GeoResult> {
    if (this.region.precision === 'strict') return { coords: null, method: 'none' }

    const countryName = COUNTRY_NAMES[this.region.country] ?? this.region.country
    const cityKey = normalizeName(`${this.region.id} city ${city}`)
    const cached = this.cache[cityKey]
    if (cached && !('miss' in cached)) return { coords: cached, method: 'city-fallback' }

    if (city && (!cached || Date.now() - Date.parse((cached as { at: string }).at) >= MISS_TTL_MS)) {
      const c = await this.nominatim(new URLSearchParams({ q: `${city}, ${countryName}` }), false)
      if (c) {
        this.cache[cityKey] = c
        return { coords: c, method: 'city-fallback' }
      }
      this.cache[cityKey] = { miss: true, at: new Date().toISOString() }
    }

    const k = city.toLowerCase().trim()
    const cityCoords = this.region.cityCoords
    if (cityCoords[k]) return { coords: cityCoords[k], method: 'city-fallback' }
    for (const [name, c] of Object.entries(cityCoords)) {
      if (k.includes(name) || name.includes(k)) return { coords: c, method: 'city-fallback' }
    }
    return { coords: this.region.center, method: 'region-center' }
  }
}
```

- [ ] **Step 4: Run geocoder tests**

Run: `npx vitest run scripts/event-sync/geocoder.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the Geocoder into `index.ts`**

In `scripts/event-sync/index.ts`:

Replace the import `import { geocode } from './geocoder.ts';` with `import { Geocoder } from './geocoder.ts';`.

Change `toMeuweEvent` to accept the geocoder and return `null` on strict drop — replace the whole function with:

```ts
async function toMeuweEvent(
  raw: RawEvent,
  region: RegionConfig,
  geocoder: Geocoder,
): Promise<{ event: MeuweEvent; method: string } | { event: null; method: 'none' }> {
  const startHour = raw.startHour ?? '19:00';
  const startUtc = localToUtc(raw.date, startHour, region.timezone);

  let endUtc: Date;
  if (raw.endHour) {
    endUtc = localToUtc(raw.date, raw.endHour, region.timezone);
    if (endUtc <= startUtc) endUtc = addHours(endUtc, 24);
  } else {
    endUtc = addHours(startUtc, 2);
  }

  const { coords, method } = await geocoder.geocode(raw.venueName, raw.city, raw.address);
  if (!coords) return { event: null, method: 'none' };

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
    method,
  };
}
```

In `main()`, after `const region = resolveRegion();` add:

```ts
  const geocoder = new Geocoder(region, path.join(__dirname, '.geocache.json'));
```

Replace the normalize/geocode loop body (the `for (const raw of allRaw)` loop) with:

```ts
  const noVenueMatch: string[] = [];

  for (const raw of allRaw) {
    const { event: normalized, warnings } = normalizeEvent(raw);

    if (!normalized) {
      dropped++;
      console.warn(`  ⚠ Dropped ${raw.externalId}: ${warnings.join(', ')}`);
      continue;
    }

    warnings.forEach(bump);
    const result = await toMeuweEvent(normalized, region, geocoder);
    if (!result.event) {
      dropped++;
      noVenueMatch.push(`"${normalized.venueName}", ${normalized.city} [${normalized.externalId}]`);
      continue;
    }
    bump(`geo:${result.method}`);
    meuweEvents.push(result.event);
  }

  geocoder.save();
```

And extend the run summary (after the `Fallbacks:` line) with the registry worklist:

```ts
  if (noVenueMatch.length) {
    console.log(`\n⚠ no-venue-match (${noVenueMatch.length}) — add to regions/rzeszow-venues.ts to recover:`);
    for (const line of noVenueMatch) console.log(`  - ${line}`);
  }
```

- [ ] **Step 6: Gitignore the cache**

Append to `.gitignore`:

```
scripts/event-sync/.geocache.json
```

- [ ] **Step 7: Full test run + typecheck**

Run: `npx vitest run scripts/event-sync/ && npm run typecheck:scraper`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/event-sync/ .gitignore
git commit -m "feat(event-sync): geocoder v2 — venue registry, bbox validation, strict mode, disk cache"
```

---

### Task 5: External-id alias migration + SQL generator support

**Files:**
- Create: `supabase/migrations/20260703_event_external_id_aliases.sql`
- Modify: `scripts/event-sync/sql.ts`
- Test: `scripts/event-sync/sql.test.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260703_event_external_id_aliases.sql`:

```sql
-- Cross-source dedup: external_ids of duplicate scraped events, pointing at
-- the external_id of the event that was kept. Seed files skip any event whose
-- external_id appears here, so duplicates can't resurface on later runs.
create table if not exists public.event_external_id_aliases (
  alias_external_id text primary key,
  canonical_external_id text not null,
  created_at timestamptz not null default now()
);

alter table public.event_external_id_aliases enable row level security;
-- No policies on purpose: the table is only read/written from the Supabase
-- SQL editor (service role bypasses RLS); the app never touches it.
```

> ⚠️ Per `project_meuwe_supabase_envs` memory: the repo `.env` points at **PROD** Supabase. Apply this migration in the Dashboard SQL editor of whichever project the seeds go to — and confirm with Wiktor which DB that is before running.

- [ ] **Step 2: Extend the failing SQL tests**

`scripts/event-sync/sql.test.ts` currently builds a `MeuweEvent` and asserts on `generateSql(events, meta)` output. Update the existing calls to the new signature `generateSql(events, [], meta)` and append:

```ts
describe('generateSql with aliases', () => {
  const ev: MeuweEvent = {
    externalId: 'ebilet:abc',
    title: 'Koncert',
    description: 'Opis',
    lat: 50.04, lng: 22.0,
    placeName: 'Filharmonia Podkarpacka, Rzeszów',
    category: 'music',
    startTime: new Date('2026-07-10T17:00:00Z'),
    endTime: new Date('2026-07-10T19:00:00Z'),
    tags: ['music'],
    photos: [],
  }
  const meta = { dateFrom: '2026-07-03', dateTo: '2026-07-24', generatedAt: '2026-07-03' }
  const sql = generateSql([ev], [{ alias: 'estrada:9:2026-07-10', canonical: 'ebilet:abc' }], meta)

  it('guards every event insert against the alias table', () => {
    expect(sql).toContain(
      `WHERE NOT EXISTS (SELECT 1 FROM public.event_external_id_aliases a WHERE a.alias_external_id = 'ebilet:abc')`,
    )
  })
  it('records loser external_ids as aliases', () => {
    expect(sql).toContain(`INSERT INTO public.event_external_id_aliases`)
    expect(sql).toContain(`('estrada:9:2026-07-10', 'ebilet:abc')`)
  })
})
```

(Import `MeuweEvent` type if the file doesn't already.)

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run scripts/event-sync/sql.test.ts`
Expected: FAIL (signature + missing SQL fragments).

- [ ] **Step 4: Implement in `sql.ts`**

Replace `generateSql` with (helpers `esc`, `pgTs`, `pgTextArray` unchanged):

```ts
export interface AliasPair {
  alias: string;
  canonical: string;
}

export function generateSql(
  events: MeuweEvent[],
  aliases: AliasPair[],
  meta: { dateFrom: string; dateTo: string; generatedAt: string }
): string {
  const lines: string[] = [
    `-- Auto-generated by event-sync on ${meta.generatedAt}`,
    `-- Scraped range: ${meta.dateFrom} → ${meta.dateTo}`,
    `-- Run manually in Supabase Dashboard → SQL Editor`,
    `-- Idempotent: ON CONFLICT (external_id) DO NOTHING skips duplicates`,
    `-- Requires migrations 20260530_add_external_id.sql + 20260703_event_external_id_aliases.sql`,
    '',
    `DO $$`,
    `DECLARE`,
    `  team_id uuid := '${MEUWE_TEAM_UUID}';`,
    `BEGIN`,
    '',
  ];

  for (const ev of events) {
    lines.push(`-- ${esc(ev.title)} [${ev.externalId}]`);
    lines.push(
      `INSERT INTO public.events (id, title, description, lat, lng, place_name, ` +
      `category, start_time, end_time, creator_id, status, external_id, photos)`
    );
    lines.push(`SELECT`);
    lines.push(`  gen_random_uuid(),`);
    lines.push(`  '${esc(ev.title)}',`);
    lines.push(`  '${esc(ev.description)}',`);
    lines.push(`  ${ev.lat.toFixed(6)}, ${ev.lng.toFixed(6)},`);
    lines.push(`  '${esc(ev.placeName)}',`);
    lines.push(`  '${ev.category}',`);
    lines.push(`  '${pgTs(ev.startTime)}',`);
    lines.push(`  '${pgTs(ev.endTime)}',`);
    lines.push(`  team_id, 'upcoming', '${esc(ev.externalId)}', ${pgTextArray(ev.photos)}`);
    lines.push(`WHERE NOT EXISTS (SELECT 1 FROM public.event_external_id_aliases a WHERE a.alias_external_id = '${esc(ev.externalId)}')`);
    lines.push(`ON CONFLICT (external_id) DO NOTHING;`);

    if (ev.tags.length) {
      lines.push(`INSERT INTO public.event_tags (event_id, tag)`);
      lines.push(`  SELECT id, unnest(ARRAY[${ev.tags.map(t => `'${esc(t)}'`).join(', ')}])`);
      lines.push(`  FROM public.events WHERE external_id = '${esc(ev.externalId)}'`);
      lines.push(`ON CONFLICT DO NOTHING;`);
    }

    lines.push('');
  }

  if (aliases.length) {
    lines.push(`-- Cross-source duplicate aliases (losers → kept event)`);
    lines.push(`INSERT INTO public.event_external_id_aliases (alias_external_id, canonical_external_id) VALUES`);
    lines.push(aliases
      .map(a => `  ('${esc(a.alias)}', '${esc(a.canonical)}')`)
      .join(',\n'));
    lines.push(`ON CONFLICT (alias_external_id) DO NOTHING;`);
    lines.push('');
  }

  lines.push('END $$;');
  return lines.join('\n');
}
```

Update the `generateSql` call in `index.ts` to pass `[]` for aliases for now (Task 6 replaces it):

```ts
  const sql = generateSql(meuweEvents, [], {
```

- [ ] **Step 5: Run tests + typecheck, commit**

Run: `npx vitest run scripts/event-sync/sql.test.ts && npm run typecheck:scraper`
Expected: PASS.

```bash
git add supabase/migrations/20260703_event_external_id_aliases.sql scripts/event-sync/sql.ts scripts/event-sync/sql.test.ts scripts/event-sync/index.ts
git commit -m "feat(event-sync): external-id alias table + alias-aware SQL generation"
```

---

### Task 6: Cross-source dedup

**Files:**
- Create: `scripts/event-sync/dedupe.ts`
- Modify: `scripts/event-sync/index.ts`
- Test: `scripts/event-sync/dedupe.test.ts`

- [ ] **Step 1: Write failing dedupe tests**

Create `scripts/event-sync/dedupe.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dedupe, haversineMeters } from './dedupe.ts'
import type { MeuweEvent } from './types.ts'

function ev(overrides: Partial<MeuweEvent>): MeuweEvent {
  return {
    externalId: 'x:1',
    title: 'Koncert Zespołu',
    description: 'opis',
    lat: 50.0435, lng: 22.0087,
    placeName: 'Filharmonia Podkarpacka, Rzeszów',
    category: 'music',
    startTime: new Date('2026-07-10T17:00:00Z'),
    endTime: new Date('2026-07-10T19:00:00Z'),
    tags: ['music'],
    photos: [],
    ...overrides,
  }
}

describe('haversineMeters', () => {
  it('measures ~111 km per degree of latitude', () => {
    const d = haversineMeters({ lat: 50.0, lng: 22.0 }, { lat: 51.0, lng: 22.0 })
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('dedupe', () => {
  it('merges same title + close time + close location across sources', () => {
    const a = ev({ externalId: 'ebilet:1', description: 'a'.repeat(500), photos: ['x.jpg'] })
    const b = ev({ externalId: 'estrada:2:2026-07-10', title: 'Koncert  Zespołu!' })
    const { kept, aliases } = dedupe([a, b])
    expect(kept).toHaveLength(1)
    expect(kept[0].externalId).toBe('ebilet:1') // richer record wins
    expect(aliases).toEqual([{ alias: 'estrada:2:2026-07-10', canonical: 'ebilet:1' }])
  })

  it('does NOT merge same title on different days', () => {
    const a = ev({ externalId: 'a:1' })
    const b = ev({ externalId: 'b:1', startTime: new Date('2026-07-12T17:00:00Z'), endTime: new Date('2026-07-12T19:00:00Z') })
    expect(dedupe([a, b]).kept).toHaveLength(2)
  })

  it('does NOT merge same title same day at distant venues (> 300 m)', () => {
    const a = ev({ externalId: 'a:1' })
    const b = ev({ externalId: 'b:1', lat: 50.0295, lng: 22.0072 }) // Podpromie, ~1.5 km away
    expect(dedupe([a, b]).kept).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/event-sync/dedupe.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `dedupe.ts`**

```ts
import type { Coords, MeuweEvent } from './types.ts'
import { normalizeName } from './geocoder.ts'
import type { AliasPair } from './sql.ts'

export interface DedupeResult {
  kept: MeuweEvent[]
  aliases: AliasPair[]
}

const MAX_DIST_M = 300
const MAX_TIME_DIFF_MS = 24 * 3_600_000

export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Richer record wins: images count double, description length breaks ties. */
function richness(e: MeuweEvent): number {
  return (e.photos.length ? 2 : 0) + Math.min(e.description.length, 1000) / 1000
}

/**
 * Cross-source dedup: two events are duplicates when the normalized titles
 * match, starts are within 24 h, and venues within 300 m. Losers become
 * external-id aliases of the kept event so they never re-insert.
 */
export function dedupe(events: MeuweEvent[]): DedupeResult {
  const sorted = [...events].sort((a, b) => richness(b) - richness(a))
  const kept: MeuweEvent[] = []
  const aliases: AliasPair[] = []

  for (const ev of sorted) {
    const dup = kept.find(k =>
      normalizeName(k.title) === normalizeName(ev.title) &&
      Math.abs(k.startTime.getTime() - ev.startTime.getTime()) <= MAX_TIME_DIFF_MS &&
      haversineMeters(k, ev) < MAX_DIST_M,
    )
    if (dup) {
      aliases.push({ alias: ev.externalId, canonical: dup.externalId })
    } else {
      kept.push(ev)
    }
  }
  return { kept, aliases }
}
```

- [ ] **Step 4: Run dedupe tests**

Run: `npx vitest run scripts/event-sync/dedupe.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into `index.ts`**

Add import: `import { dedupe } from './dedupe.ts';`

Between the run summary and SQL generation, replace the `generateSql(meuweEvents, [], …)` call with:

```ts
  const { kept, aliases } = dedupe(meuweEvents);
  if (aliases.length) {
    console.log(`Dedup:     ${aliases.length} cross-source duplicate(s) merged`);
  }

  const sql = generateSql(kept, aliases, {
    dateFrom: dateFromStr,
    dateTo:   dateToStr,
    generatedAt: runDate,
  });
```

…and update the final count log to use `kept.length`.

- [ ] **Step 6: Full tests + typecheck, commit**

Run: `npx vitest run scripts/event-sync/ && npm run typecheck:scraper`
Expected: PASS.

```bash
git add scripts/event-sync/
git commit -m "feat(event-sync): cross-source dedup with external-id aliases"
```

---

### Task 7: Polish category rules + title-aware mapping

**Files:**
- Modify: `scripts/event-sync/mapper.ts`
- Modify: `scripts/event-sync/index.ts` (one call site)
- Test: `scripts/event-sync/mapper.test.ts` (new)

- [ ] **Step 1: Write failing mapper tests**

Create `scripts/event-sync/mapper.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapCategory } from './mapper.ts'

describe('mapCategory (Polish)', () => {
  it.each([
    [['Koncert'], 'music'],
    [[], 'music', 'Kaśka Sochacka — koncert jesienny'],
    [['Spektakl teatralny'], 'culture'],
    [[], 'culture', 'Kabaret Młodych Panów'],
    [['Wystawa malarstwa'], 'art'],
    [[], 'art', 'Wernisaż akwareli i rzeźby'],
    [[], 'family', 'Bajka dla dzieci'],
    [[], 'outdoor', 'Speedway Euro Championship - Final'],
    [[], 'outdoor', 'V Bieg Doliną Strugu'],
    [[], 'culture', 'Jarmark Świętojański'],
    [[], 'culture', 'Film w plenerze || Rzymskie wakacje'],
  ])('categories=%j → %s (title=%s)', (cats, expected, title = '') => {
    expect(mapCategory(cats as string[], title).category).toBe(expected)
  })

  it('keeps working for Spanish sources without a title', () => {
    expect(mapCategory(['concierto de jazz']).category).toBe('music')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/event-sync/mapper.test.ts`
Expected: FAIL (Polish strings map to default `culture`, e.g. `Koncert` case… note `koncert` contains no ES keyword; `concierto|concert` regex does NOT match `koncert`).

- [ ] **Step 3: Implement**

In `scripts/event-sync/mapper.ts`, add Polish rules to `CATEGORY_RULES`. Order matters — insert these BEFORE the existing Spanish/English rules (Polish sources are more literal, and `musical` in the ES театр rule would shadow PL matches):

```ts
const CATEGORY_RULES: Array<{ match: RegExp; category: string; tags: string[] }> = [
  // ── Polish (checked first) ──
  { match: /koncert|muzyk|piosenk|zespół|zespol|symfoni|filharmoni|orkiestr|disco polo|hip[- ]?hop|festiwal muzyczny/i, category: 'music', tags: ['music'] },
  { match: /spektakl|teatral|kabaret|stand[- ]?up|opera|operetk|balet|musical/i, category: 'culture', tags: ['art'] },
  { match: /wystaw|wernisaż|wernisaz|galeri|malarstw|rzeźb|rzezb|fotografi/i, category: 'art', tags: ['art'] },
  { match: /dzieci|rodzin|bajk|przedszkol|maluch/i, category: 'family', tags: ['family'] },
  { match: /bieg\b|maraton|rajd|turniej|mecz|żużel|zuzel|speedway|siatkówk|siatkowk|koszykówk|koszykowk|piłk|pilk/i, category: 'outdoor', tags: ['outdoor', 'sport'] },
  { match: /jarmark|festyn|piknik|dożynki|dozynki|odpust/i, category: 'culture', tags: ['culture'] },
  { match: /degustac|kulinarn|food ?truck|gastro/i, category: 'food', tags: ['food'] },
  { match: /kino|film|seans/i, category: 'culture', tags: ['art'] },
  { match: /warsztat|wykład|wyklad|spotkanie autorskie|promocj.*książk|ksiazk/i, category: 'art', tags: ['art'] },
  // ── Spanish/English (v1 rules, unchanged) ──
  // ⟨keep the existing 10 rules from the current file here⟩
];
```

Change `mapCategory` to also consider the title:

```ts
export function mapCategory(rawCategories: string[], title = ''): { category: string; tags: string[] } {
  const combined = [...rawCategories, title].join(' ');
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(combined)) {
      return { category: rule.category, tags: rule.tags };
    }
  }
  return { category: 'culture', tags: ['culture'] };
}
```

In `index.ts`, update the call inside `toMeuweEvent`:

```ts
  const { category, tags } = mapCategory(raw.categories, raw.title);
```

- [ ] **Step 4: Run ALL event-sync tests (Tenerife regression!)**

Run: `npx vitest run scripts/event-sync/`
Expected: PASS. If a Tenerife source test asserts a category that a new PL rule now shadows (e.g. `film`/`kino` firing on Spanish strings), reorder/narrow the PL rule (e.g. require word boundaries) rather than changing the Tenerife expectation.

- [ ] **Step 5: Commit**

```bash
git add scripts/event-sync/mapper.ts scripts/event-sync/mapper.test.ts scripts/event-sync/index.ts
git commit -m "feat(event-sync): Polish category rules + title-aware category mapping"
```

---

### Task 8: Shared PL date helpers + eBilet source

**Files:**
- Create: `scripts/event-sync/sources/pl-dates.ts`
- Create: `scripts/event-sync/sources/ebilet.ts`
- Create: `scripts/event-sync/__fixtures__/ebilet_group_events.json`
- Modify: `scripts/event-sync/regions/rzeszow.ts` (register source)
- Test: `scripts/event-sync/sources/pl-dates.test.ts`, `scripts/event-sync/sources/ebilet.test.ts`

- [ ] **Step 1: Create the API fixture**

Create `scripts/event-sync/__fixtures__/ebilet_group_events.json` (shape captured live 2026-07-03 from `api/LandingPage/group/{id}/event`; irrelevant fields trimmed):

```json
{
  "events": [
    {
      "date": "2026-07-09T19:00:00",
      "city": "Rzeszów",
      "placeName": "Filharmonia Podkarpacka im. Artura Malawskiego",
      "street": "Chopina 30",
      "postalCode": "35-959",
      "titleTitle": "Abba i Inni Symfonicznie II",
      "titleId": "186000",
      "organizerName": "Agencja Brussa Jarosław Brussa",
      "uniqueId": "11111111-1111-1111-1111-111111111111",
      "isCancelled": false,
      "soldOut": false
    },
    {
      "date": "2026-07-12T20:00:00",
      "city": "Jasionka",
      "placeName": "G2A Arena",
      "street": "Jasionka 953",
      "postalCode": "36-002",
      "titleTitle": "Kaśka Sochacka — Jesień",
      "titleId": "187001",
      "organizerName": "Follow The Step",
      "uniqueId": "22222222-2222-2222-2222-222222222222",
      "isCancelled": false,
      "soldOut": false
    },
    {
      "date": "2026-07-10T19:00:00",
      "city": "Warszawa",
      "placeName": "Stodoła",
      "street": "Batorego 10",
      "postalCode": "02-591",
      "titleTitle": "Koncert w innym mieście",
      "titleId": "187002",
      "organizerName": "X",
      "uniqueId": "33333333-3333-3333-3333-333333333333",
      "isCancelled": false,
      "soldOut": false
    },
    {
      "date": "2026-07-11T19:00:00",
      "city": "Rzeszów",
      "placeName": "Millenium Hall",
      "street": "al. Kopisto 1",
      "postalCode": "35-315",
      "titleTitle": "Odwołany koncert",
      "titleId": "187003",
      "organizerName": "X",
      "uniqueId": "44444444-4444-4444-4444-444444444444",
      "isCancelled": true,
      "soldOut": false
    },
    {
      "date": "2026-09-30T19:00:00",
      "city": "Rzeszów",
      "placeName": "Filharmonia Podkarpacka im. Artura Malawskiego",
      "street": "Chopina 30",
      "postalCode": "35-959",
      "titleTitle": "Poza oknem scrapowania",
      "titleId": "187004",
      "organizerName": "X",
      "uniqueId": "55555555-5555-5555-5555-555555555555",
      "isCancelled": false,
      "soldOut": false
    }
  ]
}
```

- [ ] **Step 2: Write failing tests (pl-dates + ebilet)**

Create `scripts/event-sync/sources/pl-dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { inferYear, parsePlDate } from './pl-dates.ts'

const NOW = new Date('2026-07-03T12:00:00Z')

describe('inferYear', () => {
  it('keeps the current year for upcoming dates', () => {
    expect(inferYear(15, 7, NOW)).toBe(2026)
  })
  it('keeps the current year for dates a few weeks back (already-running events)', () => {
    expect(inferYear(20, 6, NOW)).toBe(2026)
  })
  it('rolls far-past dates to next year', () => {
    expect(inferYear(10, 1, NOW)).toBe(2027)
  })
})

describe('parsePlDate', () => {
  it('parses dd.mm.yyyy', () => {
    expect(parsePlDate('Spacer po rynku | 31.05.2026 r.', NOW)).toBe('2026-05-31')
  })
  it('parses dd.mm and infers the year', () => {
    expect(parsePlDate('23.06 | Wernisaż prac', NOW)).toBe('2026-06-23')
  })
  it('returns null when there is no date', () => {
    expect(parsePlDate('Dni Tyczyna | Parkingi', NOW)).toBeNull()
  })
  it('rejects impossible dates', () => {
    expect(parsePlDate('45.13 | coś', NOW)).toBeNull()
  })
})
```

Create `scripts/event-sync/sources/ebilet.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { extractGroupApiUrls, toRawEvents, type EbiletApiEvent } from './ebilet.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(here, '..', '__fixtures__', 'ebilet_group_events.json'), 'utf8'),
) as { events: EbiletApiEvent[] }

const opts = {
  dateFrom: new Date('2026-07-03T00:00:00Z'),
  dateTo: new Date('2026-07-24T00:00:00Z'),
}

describe('extractGroupApiUrls', () => {
  it('finds unique group event API urls in landing HTML', () => {
    const html = `
      fetch("https://www.ebilet.pl/api/LandingPage/group/02db2641-2c21-41d3-aeb1-055f5a25a7f8/event")
      fetch("https://www.ebilet.pl/api/LandingPage/group/02db2641-2c21-41d3-aeb1-055f5a25a7f8/event")
      fetch("https://www.ebilet.pl/api/LandingPage/group/099d324f-022e-4295-8ae5-4e844bcba52d/place")
      fetch("https://www.ebilet.pl/api/LandingPage/group/765c8a47-e869-4db1-84de-db239b2ab2bc/event")`
    const urls = extractGroupApiUrls(html)
    expect(urls).toHaveLength(2) // /place group ignored, duplicate deduped
    expect(urls[0]).toContain('/event')
  })
})

describe('toRawEvents', () => {
  const raws = toRawEvents(fixture.events, opts)

  it('keeps only in-region, in-window, non-cancelled events', () => {
    expect(raws.map(r => r.externalId).sort()).toEqual([
      'ebilet:11111111-1111-1111-1111-111111111111',
      'ebilet:22222222-2222-2222-2222-222222222222',
    ])
  })
  it('carries exact venue, street address and city', () => {
    const filharmonia = raws.find(r => r.externalId.includes('1111'))!
    expect(filharmonia.venueName).toBe('Filharmonia Podkarpacka im. Artura Malawskiego')
    expect(filharmonia.address).toBe('Chopina 30')
    expect(filharmonia.city).toBe('Rzeszów')
    expect(filharmonia.date).toBe('2026-07-09')
    expect(filharmonia.startHour).toBe('19:00')
    expect(filharmonia.country).toBe('PL')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run scripts/event-sync/sources/pl-dates.test.ts scripts/event-sync/sources/ebilet.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement `pl-dates.ts`**

```ts
/** Shared Polish date helpers for Rzeszów-region sources. */

const PAST_GRACE_DAYS = 45

/**
 * Infer the year for a day+month with no year: assume the nearest upcoming
 * occurrence, tolerating dates up to 45 days in the past (already-running
 * events); anything older is next year's date.
 */
export function inferYear(day: number, month: number, now: Date): number {
  const y = now.getUTCFullYear()
  const candidate = Date.UTC(y, month - 1, day)
  return candidate < now.getTime() - PAST_GRACE_DAYS * 86_400_000 ? y + 1 : y
}

/** First 'dd.mm[.yyyy]' in the text → 'YYYY-MM-DD', or null. */
export function parsePlDate(text: string, now: Date): string | null {
  const m = text.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/)
  if (!m) return null
  const day = Number(m[1]), month = Number(m[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const year = m[3] ? Number(m[3]) : inferYear(day, month, now)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
```

- [ ] **Step 5: Implement `ebilet.ts`**

```ts
/**
 * eBilet — Polish ticketing platform, Rzeszów-region city landing pages.
 *
 * The landing HTML (https://www.ebilet.pl/miasto/{slug}) embeds URLs of an
 * internal JSON API: /api/LandingPage/group/{uuid}/event. Each returns
 * { events: [...] } with per-event date, city, venue name and street address
 * — far more accurate than the page's JSON-LD, which mixes multi-city tours.
 * Verified live 2026-07-03 (see docs/event-sources-rzeszow.md).
 */
import { normalizeName } from '../geocoder.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const CITY_SLUGS = ['rzeszow', 'lancut', 'jasionka'] // boguchwala/tyczyn: no city page (404)
const REGION_CITIES = new Set([
  'rzeszow', 'lancut', 'jasionka', 'tyczyn', 'boguchwala',
  'trzebownisko', 'krasne', 'glogow malopolski', 'swilcza',
])
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export interface EbiletApiEvent {
  date: string
  city: string | null
  placeName: string | null
  street: string | null
  postalCode: string | null
  titleTitle: string
  titleId: string
  organizerName?: string | null
  uniqueId: string
  isCancelled: boolean
  soldOut: boolean
}

export function extractGroupApiUrls(html: string): string[] {
  const re = /https:\/\/www\.ebilet\.pl\/api\/LandingPage\/group\/[0-9a-f-]{36}\/event/g
  return [...new Set(html.match(re) ?? [])]
}

export function toRawEvents(events: EbiletApiEvent[], opts: ScrapeOptions): RawEvent[] {
  const from = opts.dateFrom.toISOString().slice(0, 10)
  const to = opts.dateTo.toISOString().slice(0, 10)
  const out: RawEvent[] = []

  for (const e of events) {
    if (!e?.date || !e.uniqueId || e.isCancelled) continue
    if (!e.city || !REGION_CITIES.has(normalizeName(e.city))) continue
    const date = e.date.slice(0, 10)
    if (date < from || date > to) continue

    out.push({
      externalId: `ebilet:${e.uniqueId}`,
      title: e.titleTitle,
      description: [e.titleTitle, e.placeName, e.city, e.organizerName]
        .filter(Boolean).join(' — '),
      date,
      startHour: /^\d{2}:\d{2}/.test(e.date.slice(11)) ? e.date.slice(11, 16) : null,
      endHour: null,
      venueName: e.placeName ?? '',
      city: e.city,
      address: e.street ?? undefined,
      country: 'PL',
      categories: [],
    })
  }
  return out
}

export class EbiletSource implements Source {
  readonly id = 'ebilet'
  readonly name = 'eBilet (PL ticketing API)'

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${url}`)
    return res.text()
  }

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const byId = new Map<string, RawEvent>()

    for (const slug of CITY_SLUGS) {
      let html: string
      try {
        html = await this.fetchText(`https://www.ebilet.pl/miasto/${slug}`)
      } catch (err) {
        console.warn(`  ⚠ ebilet: city page ${slug} failed: ${(err as Error).message}`)
        continue
      }

      for (const apiUrl of extractGroupApiUrls(html)) {
        await new Promise(r => setTimeout(r, 300)) // politeness
        try {
          const body = await this.fetchText(apiUrl)
          const parsed = JSON.parse(body) as { events?: EbiletApiEvent[] }
          for (const raw of toRawEvents(parsed.events ?? [], options)) {
            const prev = byId.get(raw.externalId)
            if (!prev || (!prev.venueName && raw.venueName)) byId.set(raw.externalId, raw)
          }
        } catch (err) {
          console.warn(`  ⚠ ebilet: group API failed: ${(err as Error).message}`)
        }
      }
    }
    return [...byId.values()]
  }
}
```

- [ ] **Step 6: Register in the region + run tests**

In `scripts/event-sync/regions/rzeszow.ts`:

```ts
import { EbiletSource } from '../sources/ebilet.ts'
// …
  sources: [
    new EbiletSource(),
  ],
```

Run: `npx vitest run scripts/event-sync/ && npm run typecheck:scraper`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/event-sync/sources/pl-dates.ts scripts/event-sync/sources/pl-dates.test.ts scripts/event-sync/sources/ebilet.ts scripts/event-sync/sources/ebilet.test.ts scripts/event-sync/__fixtures__/ebilet_group_events.json scripts/event-sync/regions/rzeszow.ts
git commit -m "feat(event-sync): ebilet source (rzeszow/lancut/jasionka) via LandingPage API"
```

---

### Task 9: Estrada Rzeszowska source

**Files:**
- Create: `scripts/event-sync/sources/estrada.ts`
- Create: `scripts/event-sync/__fixtures__/estrada_listing.html`, `scripts/event-sync/__fixtures__/estrada_detail.html`
- Modify: `scripts/event-sync/regions/rzeszow.ts`
- Test: `scripts/event-sync/sources/estrada.test.ts`

- [ ] **Step 1: Build fixtures from the live site (or scratchpad backups)**

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
curl -s -L -H "User-Agent: $UA" "https://estrada.rzeszow.pl/" -o /tmp/estrada_full.html
curl -s -L -H "User-Agent: $UA" "https://estrada.rzeszow.pl/wydarzenia/film-w-plenerze-rzymskie-wakacje,wydarzenie2116/" -o scripts/event-sync/__fixtures__/estrada_detail.html
# Trim the 630 KB homepage to just 2-3 .calendarSingleDay blocks (keep them verbatim):
python3 - <<'PY'
import re
html = open('/tmp/estrada_full.html', encoding='utf-8', errors='replace').read()
blocks = re.findall(r'<div class="calendarSingleDay.*?(?=<div class="calendarSingleDay|$)', html, re.S)
print(f'{len(blocks)} day blocks found')
open('scripts/event-sync/__fixtures__/estrada_listing.html', 'w').write(
  '<html><body>' + ''.join(blocks[:3]) + '</body></html>')
PY
```

Expected: `estrada_listing.html` contains ≥1 day block with `.calendar--left .day`, `.month`, and `article` cards with `/wydarzenia/…,wydarzenie{id}/` links; `estrada_detail.html` contains `.where` with `span.date`=`23.07.2026`, `span.time`=`21:00`, `span.place`=`Skwer Kultury w Rzeszowie, Rynek` and an `.ArticleFull__text` div. **Open both and confirm before writing tests; adjust test expectations to the actual fixture content** (day numbers etc. depend on fetch day). If the site is unreachable, copy `estrada.html`/`estrada_detail.html` from the scratchpad path in the plan header.

- [ ] **Step 2: Write failing tests**

Create `scripts/event-sync/sources/estrada.test.ts` (adjust literals to your fixture):

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as cheerio from 'cheerio'
import { parseListing, parseDetail } from './estrada.ts'

const here = dirname(fileURLToPath(import.meta.url))
const listing = readFileSync(join(here, '..', '__fixtures__', 'estrada_listing.html'), 'utf8')
const detail = readFileSync(join(here, '..', '__fixtures__', 'estrada_detail.html'), 'utf8')
const NOW = new Date('2026-07-03T12:00:00Z')

describe('parseListing', () => {
  const items = parseListing(cheerio.load(listing), NOW)

  it('extracts at least one event card per day block', () => {
    expect(items.length).toBeGreaterThan(0)
  })
  it('builds absolute detail URLs without the ?img/?tytul query', () => {
    for (const it2 of items) {
      expect(it2.url).toMatch(/^https:\/\/estrada\.rzeszow\.pl\/wydarzenia\/.+,wydarzenie\d+\/$/)
    }
  })
  it('carries an ISO date and a venue hint', () => {
    expect(items[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(typeof items[0].venueHint).toBe('string')
  })
  it('dedupes the double links (?img / ?tytul) of one card', () => {
    const urls = items.map(i => `${i.url}|${i.date}`)
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('parseDetail (real fixture)', () => {
  const d = parseDetail(cheerio.load(detail))

  it('extracts the start time', () => {
    expect(d.time).toBe('21:00')
  })
  it('extracts the place string', () => {
    expect(d.place).toContain('Skwer Kultury')
  })
  it('extracts a meaningful description', () => {
    expect(d.description.length).toBeGreaterThan(100)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run scripts/event-sync/sources/estrada.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement `estrada.ts`**

```ts
/**
 * Estrada Rzeszowska — the city's culture agency (estrada.rzeszow.pl).
 * The homepage is a server-rendered calendar: `.calendarSingleDay` blocks
 * (day + month, no year — inferred) with `article` cards. Venue comes from
 * the card's `.organizer` span; the detail page has a `.where` block with
 * `span.date` / `span.time` / `span.place` and description in
 * `.ArticleFull__text`. Verified live 2026-07-03.
 */
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import { inferYear } from './pl-dates.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://estrada.rzeszow.pl'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const MAX_DETAIL_FETCHES = 40

export interface EstradaListItem {
  url: string
  title: string
  /** 'YYYY-MM-DD' from the calendar day block */
  date: string
  venueHint: string
  imageUrl?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

export function parseListing($: CheerioAPI, now: Date): EstradaListItem[] {
  const items: EstradaListItem[] = []
  const seen = new Set<string>()

  $('.calendarSingleDay').each((_, dayEl) => {
    const day = parseInt($(dayEl).find('.calendar--left .day').first().text().trim(), 10)
    const month = parseInt($(dayEl).find('.calendar--left .month').first().text().trim(), 10)
    if (!day || !month) return
    const date = `${inferYear(day, month, now)}-${pad(month)}-${pad(day)}`

    $(dayEl).find('article').each((_, art) => {
      const a = $(art).find('a[href*="/wydarzenia/"][title]').first()
      const href = a.attr('href')
      const title = a.attr('title')?.trim()
      if (!href || !title) return
      const url = BASE + href.split('?')[0]
      const key = `${url}|${date}`
      if (seen.has(key)) return
      seen.add(key)

      const imgSrc = $(art).find('img').first().attr('src')
      items.push({
        url,
        title,
        date,
        venueHint: $(art).find('.organizer').first().text().trim(),
        imageUrl: imgSrc ? (imgSrc.startsWith('http') ? imgSrc : BASE + imgSrc) : undefined,
      })
    })
  })
  return items
}

export function parseDetail($: CheerioAPI): { time: string | null; place: string; description: string } {
  const timeText = $('.where .time').first().text().trim()
  const time = /^\d{1,2}:\d{2}$/.test(timeText)
    ? timeText.padStart(5, '0')
    : null
  const place = $('.where .place').first().text().trim()
  const description = $('.ArticleFull__text').first().text()
    .replace(/\s+/g, ' ').trim().slice(0, 1500)
  return { time, place, description }
}

export class EstradaSource implements Source {
  readonly id = 'estrada'
  readonly name = 'Estrada Rzeszowska'

  private async fetchHtml(url: string): Promise<CheerioAPI> {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${url}`)
    return cheerio.load(await res.text())
  }

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const from = options.dateFrom.toISOString().slice(0, 10)
    const to = options.dateTo.toISOString().slice(0, 10)

    const $ = await this.fetchHtml(`${BASE}/`)
    const items = parseListing($, new Date())
      .filter(i => i.date >= from && i.date <= to)
      .slice(0, MAX_DETAIL_FETCHES)

    // One event page can be listed on several days — fetch each detail once.
    const detailCache = new Map<string, { time: string | null; place: string; description: string }>()
    const out: RawEvent[] = []

    for (const item of items) {
      let d = detailCache.get(item.url)
      if (!d) {
        await new Promise(r => setTimeout(r, 300)) // politeness
        try {
          d = parseDetail(await this.fetchHtml(item.url))
        } catch {
          d = { time: null, place: '', description: '' }
        }
        detailCache.set(item.url, d)
      }

      const idMatch = item.url.match(/,wydarzenie(\d+)\/$/)
      out.push({
        externalId: `estrada:${idMatch ? idMatch[1] : item.url}:${item.date}`,
        title: item.title,
        description: d.description,
        date: item.date,
        startHour: d.time,
        endHour: null,
        venueName: d.place || item.venueHint,
        city: 'Rzeszów',
        country: 'PL',
        categories: [],
        sourceUrl: item.url,
        imageUrl: item.imageUrl,
      })
    }
    return out
  }
}
```

- [ ] **Step 5: Register + run tests**

Add `new EstradaSource()` to `sources` in `regions/rzeszow.ts` (import from `'../sources/estrada.ts'`).

Run: `npx vitest run scripts/event-sync/ && npm run typecheck:scraper`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/event-sync/sources/estrada.ts scripts/event-sync/sources/estrada.test.ts scripts/event-sync/__fixtures__/estrada_listing.html scripts/event-sync/__fixtures__/estrada_detail.html scripts/event-sync/regions/rzeszow.ts
git commit -m "feat(event-sync): estrada rzeszowska source (calendar listing + detail pages)"
```

---

### Task 10: MGOK Tyczyn RSS source

**Files:**
- Create: `scripts/event-sync/sources/mgoktyczyn.ts`
- Create: `scripts/event-sync/__fixtures__/mgoktyczyn_feed.xml`
- Modify: `scripts/event-sync/regions/rzeszow.ts`
- Test: `scripts/event-sync/sources/mgoktyczyn.test.ts`

- [ ] **Step 1: Build the fixture**

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
curl -s -L -H "User-Agent: $UA" "https://mgoktyczyn.pl/feed/" -o scripts/event-sync/__fixtures__/mgoktyczyn_feed.xml
```

Expected: a WP RSS with ~10 `<item>` entries; titles like `23.06 | Wernisaż prac uczestników zajęć`, `Spacer po tyczyńskim rynku lat 1945 – 1960 | 31.05.2026 r.`; empty `description`/`content:encoded` (this is normal for this feed). If unreachable, copy `b_mgoktyczyn-feed.html` from the scratchpad path in the plan header.

- [ ] **Step 2: Write failing tests**

Create `scripts/event-sync/sources/mgoktyczyn.test.ts` (adjust expected counts/titles to the fixture you fetched):

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseFeed } from './mgoktyczyn.ts'

const here = dirname(fileURLToPath(import.meta.url))
const xml = readFileSync(join(here, '..', '__fixtures__', 'mgoktyczyn_feed.xml'), 'utf8')
const NOW = new Date('2026-06-20T12:00:00Z')

describe('parseFeed', () => {
  const events = parseFeed(xml, NOW)

  it('keeps only items with a parseable date in the title', () => {
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('strips the date fragment from the title', () => {
    const wernisaz = events.find(e => e.title.includes('Wernisaż prac'))
    expect(wernisaz).toBeDefined()
    expect(wernisaz!.title).not.toMatch(/\d{1,2}\.\d{1,2}/)
    expect(wernisaz!.title).not.toMatch(/^\s*\|/)
  })
  it('defaults venue to MGOK Tyczyn in Tyczyn', () => {
    expect(events[0].venueName).toBe('MGOK Tyczyn')
    expect(events[0].city).toBe('Tyczyn')
    expect(events[0].country).toBe('PL')
  })
  it('builds a stable externalId from the post guid + date', () => {
    expect(events[0].externalId).toMatch(/^mgoktyczyn:\d+:\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run scripts/event-sync/sources/mgoktyczyn.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement `mgoktyczyn.ts`**

```ts
/**
 * MGOK Tyczyn — WordPress RSS (https://mgoktyczyn.pl/feed/).
 * The feed's description/content are EMPTY; the event date lives in the
 * post title ('23.06 | Wernisaż prac…', '… | 31.05.2026 r.'). Items without
 * a parseable date are news, not events — skipped. Venue defaults to MGOK
 * Tyczyn (resolved by the venue registry). Verified live 2026-07-03.
 */
import * as cheerio from 'cheerio'
import { parsePlDate } from './pl-dates.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const FEED_URL = 'https://mgoktyczyn.pl/feed/'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const DATE_FRAGMENT = /\s*\|?\s*\d{1,2}\.\d{1,2}(?:\.\d{4})?\s*r?\.?\s*\|?\s*/

export function parseFeed(xml: string, now: Date): RawEvent[] {
  const $ = cheerio.load(xml, { xmlMode: true })
  const out: RawEvent[] = []

  $('item').each((_, el) => {
    const rawTitle = $(el).find('title').first().text().trim()
    const link = $(el).find('link').first().text().trim()
    const guid = $(el).find('guid').first().text().trim()

    const date = parsePlDate(rawTitle, now)
    if (!date) return // news post, not a dated event

    const title = rawTitle.replace(DATE_FRAGMENT, ' ').replace(/\s+/g, ' ').trim() || rawTitle
    const idMatch = guid.match(/p=(\d+)/)

    out.push({
      externalId: `mgoktyczyn:${idMatch ? idMatch[1] : encodeURIComponent(guid)}:${date}`,
      title,
      description: '',
      date,
      startHour: null,
      endHour: null,
      venueName: 'MGOK Tyczyn',
      city: 'Tyczyn',
      country: 'PL',
      categories: [rawTitle],
      sourceUrl: link,
    })
  })
  return out
}

export class MgokTyczynSource implements Source {
  readonly id = 'mgoktyczyn'
  readonly name = 'MGOK Tyczyn (RSS)'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${FEED_URL}`)
    const from = options.dateFrom.toISOString().slice(0, 10)
    const to = options.dateTo.toISOString().slice(0, 10)
    return parseFeed(await res.text(), new Date())
      .filter(e => e.date >= from && e.date <= to)
  }
}
```

- [ ] **Step 5: Register + run everything**

Add `new MgokTyczynSource()` to `sources` in `regions/rzeszow.ts`.

Run: `npx vitest run scripts/event-sync/ && npm run typecheck:scraper`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/event-sync/sources/mgoktyczyn.ts scripts/event-sync/sources/mgoktyczyn.test.ts scripts/event-sync/__fixtures__/mgoktyczyn_feed.xml scripts/event-sync/regions/rzeszow.ts
git commit -m "feat(event-sync): mgok tyczyn RSS source"
```

---

### Task 11: End-to-end verification (live runs)

**Files:** none new — verification only.

- [ ] **Step 1: Full test suite + typecheck**

Run: `npm test && npm run typecheck:scraper`
Expected: everything PASSES (including all pre-existing Tenerife tests — the regression gate from the spec).

- [ ] **Step 2: Live Rzeszów run**

Run: `npm run event-sync -- --region=rzeszow`
Expected:
- all 3 sources report collected counts (ebilet likely tens of events; estrada a few dozen; mgoktyczyn a handful),
- run summary shows `geo:venue-registry` as the dominant method,
- a `no-venue-match` block may list unknown venues → **add the legit ones to `regions/rzeszow-venues.ts`** (verify coords with `npx tsx scripts/event-sync/verify-venues.ts`), re-run, watch the drop count fall,
- `supabase/seeds/events_rzeszow_<date>.sql` is written.

- [ ] **Step 3: Sanity-check the seed**

Open the seed file and verify by eye:
- every event's `lat/lng` differs (no single repeated fallback coordinate),
- `place_name` values are concrete venues ("Filharmonia Podkarpacka…", "Skwer Kultury…"), not bare city names — except where the venue registry legitimately resolved a city-central venue,
- timestamps are UTC and plausible (a 19:00 July event = `17:00+00`),
- the alias `INSERT` block appears iff the run reported merged duplicates,
- every `INSERT INTO public.events` carries the `WHERE NOT EXISTS … event_external_id_aliases` guard.

- [ ] **Step 4: Live Tenerife smoke run (no regression)**

Run: `npm run event-sync -- --region=tenerife`
Expected: sources run as before; seed written to `events_tenerife_<date>.sql`; fallback counters comparable to v1 runs (island-center fallbacks still allowed — lenient).

- [ ] **Step 5: Wrap-up commit (registry growth from step 2, if any)**

```bash
git add scripts/event-sync/regions/rzeszow-venues.ts
git commit -m "chore(event-sync): grow rzeszow venue registry from first live run"
```

Do NOT commit the generated seed files (they stay untracked, as today). Before pasting the Rzeszów seed into Supabase, apply `supabase/migrations/20260703_event_external_id_aliases.sql` in the target project's SQL editor — and per the Supabase-envs memory, confirm which project (prod `bcfhsbnbvsuxsiwmeway` vs staging) is intended.

---

## Self-review notes

- **Spec coverage:** region config (T2-3), geocoder v2 + registry + cache (T3-4), alias migration + SQL guard (T5), dedup (T6), PL categories (T7), 3 verified sources (T8-10), research catalogue (done — `docs/event-sources-rzeszow.md`), regression gate + live runs (T11). Boguchwała has no viable source yet — documented as a gap in the catalogue (spec allows 3-5 initial sources).
- **Type consistency:** `GeoResult`/`Geocoder` (T4) match usage in `index.ts`; `AliasPair` defined in `sql.ts` (T5) and imported by `dedupe.ts` (T6); `RawEvent.address` added in T2, used by ebilet (T8) and geocoder (T4).
- **Known judgment calls for the executor:** estrada/mgoktyczyn fixture literals depend on fetch-day content — tests say what to assert, adjust literals to the real fixture; venue registry coords must pass the `verify-venues.ts` check before the first live run.
