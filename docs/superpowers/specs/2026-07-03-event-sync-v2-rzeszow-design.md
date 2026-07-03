# Event-sync v2 — Region-aware pipeline + Rzeszów region

**Date:** 2026-07-03
**Status:** Approved

## Goal

Evolve `scripts/event-sync/` from a Tenerife-only scraper into a region-aware
pipeline, and add a second region: **Rzeszów and surroundings (Tyczyn,
Boguchwała, Łańcut, Jasionka)**. The hard requirement for the new region is
**precise event location** — an event enters the database only with a
verified, venue-level position inside the region.

Output feeds the same meuwe Supabase `events` table as v1 (idempotent SQL
seed files, pasted manually into the SQL Editor).

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Target DB | Same meuwe `events` table as Tenerife |
| Geo precision (Rzeszów) | **Venue or drop** — no city-center/region-center fallbacks |
| Architecture | Shared core + per-region config; Tenerife = region 1, Rzeszów = region 2 |
| Source discovery | Live research → `docs/event-sources-rzeszow.md` catalogue; implement top 3–5 first |
| Geocoding | Curated venue registry + Nominatim (structured, bbox-validated) |
| Cross-source dedup | Yes — title + date + geo proximity; losers recorded as external-id aliases |

## 1. Region configuration

Everything Tenerife-specific moves out of the core into a `RegionConfig`:

```
scripts/event-sync/
  regions/
    tenerife.ts          # current behavior, no regression
    rzeszow.ts
    rzeszow-venues.ts    # curated venue registry
  index.ts, geocoder.ts, normalize.ts, dedupe.ts (new), sql.ts, timezone.ts, mapper.ts
  sources/               # each region config lists its Source instances
```

`RegionConfig` fields:

- `id` — `'tenerife' | 'rzeszow'` (used in seed filename and logging)
- `timezone` — IANA zone (`Atlantic/Canary`, `Europe/Warsaw`)
- `country` — ISO code (`ES`, `PL`)
- `bbox` — region bounding box; every geocode result must fall inside it.
  Rzeszów: approx. lat 49.90–50.20, lng 21.80–22.35 (covers Rzeszów, Tyczyn,
  Boguchwała, Łańcut, Jasionka with margin)
- `cityCoords` — municipality fallback coordinates (today's `MUNICIPALITY_COORDS`)
- `venues` — venue registry (see §2); may be empty (Tenerife initially)
- `sources` — `Source[]` for this region
- `precision` — `'strict'` (Rzeszów: venue or drop) or `'lenient'`
  (Tenerife: keep v1 fallback chain incl. island center, to avoid cutting
  its current volume)

CLI: `npm run event-sync -- --region=rzeszow` (region argument **required**).
Seed file: `supabase/seeds/events_<region>_<YYYYMMDD>.sql`. `timezone.ts`
generalizes `localCanaryToUtc` to `localToUtc(date, hour, timeZone)`.

## 2. Geocoder v2

Cascade under `strict` policy:

1. **Venue registry** (`regions/rzeszow-venues.ts`) — hand-verified coords for
   the region's recurring venues (Hala Podpromie, Millenium Hall, G2A Arena
   Jasionka, Filharmonia Podkarpacka, Teatr im. Siemaszkowej, Teatr Maska,
   Kino Zorza, WDK, Muzeum-Zamek w Łańcucie, MCK Łańcut, MOK Boguchwała,
   MOK Tyczyn, …). Entries carry a canonical name, aliases, city, and coords.
   Matching is on normalized names: lowercase, diacritics stripped,
   boilerplate removed (e.g. trailing "w Rzeszowie"). Expected to resolve the
   large majority of events with zero network calls.
2. **Nominatim** — structured query (venue + city + country) first, then a
   free-text query bounded by the region viewbox. **Every result is validated
   against `bbox`**; a hit outside the region counts as a miss.
3. Miss under `strict` → the event is **dropped**, and the run summary prints
   an actionable line (`⚠ no-venue-match "Klub Vinyl, Rzeszów" (ebilet:1234)`)
   so the venue can be added to the registry and recovered on the next run.

Under `lenient` the v1 chain is preserved (venue → city → `cityCoords` →
region center).

**Persistent geocode cache**: replace the in-memory map with a JSON file
(`scripts/event-sync/.geocache.json`, committed or gitignored — gitignored)
keyed by `venue|city|country`, storing hits and misses. Respect Nominatim's
1 req/s limit; cached runs become near-instant.

## 3. Rzeszów sources

A research pass **before implementation** produces
`docs/event-sources-rzeszow.md` in the same format as
`docs/event-sources-tenerife.md` (live-verified status, data structure,
viability, build order). Candidates to verify:

- **City/municipal agendas:** kultura.rzeszow.pl / erzeszow.pl, Estrada
  Rzeszowska, WDK Rzeszów, MOK Boguchwała, MOK Tyczyn, MCK Łańcut, city
  agendas of Tyczyn/Boguchwała/Łańcut/Trzebownisko (Jasionka)
- **Venues:** Millenium Hall, G2A Arena, Filharmonia Podkarpacka, Teatr im.
  Siemaszkowej, Teatr Maska, Kino Zorza, Hala Podpromie, Muzeum-Zamek w
  Łańcucie
- **Ticketing:** bilety24, eBilet, KupBilecik, Going., empik bilety
- **Cheap wins:** WordPress Tribe REST (`/wp-json/tribe/events/v1/events`) and
  `/feed` RSS on Polish municipal/cultural sites — same trick as Tenerife

**Implement the top 3–5 sources initially**; catalogue the rest for later.
Each source implements the existing `Source` interface unchanged.

## 4. Cross-source dedup (`dedupe.ts`)

New step after geocoding, before SQL generation:

- **Duplicate test:** normalized title equality (lowercase, diacritics/punct
  stripped, whitespace collapsed) **and** same local date **and** distance
  < 300 m.
- **Winner:** richer record — scored by (has explicit start hour, description
  length, has image).
- **Losers → aliases:** new migration creates
  `public.event_external_id_aliases (alias_external_id text primary key,
  canonical_external_id text not null)`. Generated SQL inserts winner events
  as today, inserts loser ids into the alias table, and guards every event
  insert with `NOT EXISTS (select 1 from event_external_id_aliases where
  alias_external_id = …)` so a duplicate cannot resurface on a later run even
  if the winning source disappears.

## 5. Categories & normalization

`CATEGORY_RULES` in `mapper.ts` gain Polish patterns (koncert, spektakl,
kabaret, wystawa, wernisaż, warsztaty, dzieci/rodzinne, bieg/rajd,
jarmark/festyn, …). One combined PL+ES+EN rule list — no per-region rules.
`normalize.ts` behavior is unchanged.

## 6. Error handling

- A failing source logs and is skipped (as v1); the run continues.
- Geocode misses under `strict` are collected and printed as a block in the
  run summary (registry-growth worklist), with counts per reason.
- Nominatim network errors are treated as misses, not crashes; negative cache
  entries expire (stored with a timestamp, e.g. 7-day TTL) so transient
  failures self-heal.

## 7. Testing

Vitest, as v1:

- Per-source parser tests with HTML/JSON fixtures (`__fixtures__/`), TDD
- Geocoder: registry matching (aliases, diacritics), bbox validation,
  strict-drop behavior, cache round-trip
- Dedup: match/no-match cases, winner selection, alias emission
- Timezone: `Europe/Warsaw` incl. DST transitions; existing Canary tests keep
  passing
- SQL: alias-guard emission
- **Regression gate:** all existing Tenerife tests pass unchanged after the
  refactor

## 8. Build order

1. Source research → `docs/event-sources-rzeszow.md` + pick initial 3–5
2. Core refactor to regions (Tenerife behavior identical)
3. Geocoder v2 + venue registry + alias migration
4. Rzeszów sources + dedup
5. First full run → review `events_rzeszow_*.sql` seed

## Out of scope

- Automated DB inserts (seeds stay manual, as v1)
- Migrating Tenerife to `strict` precision or backfilling its venue registry
- Scheduling/cron of sync runs
- De-dup backfill for already-inserted Tenerife rows
