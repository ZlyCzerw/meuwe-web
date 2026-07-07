# Rzeszow Group 2 Source Integration Design

## Goal

Expand the Rzeszow event scraper with the full group 2 source set: medium-value official/cultural/family/sport portals plus nightlife venue sites. The work should add active scraper sources only when a source exposes dated public events with a stable parse shape. Sources that do not meet that bar will still be documented with a concrete status and, when useful, added as venue registry entries.

## Scope

Group 2 includes:

- Official, culture, sport, family and local portals: Visit Rzeszow, WDK Rzeszow, kulturapodkarpacka, Teatr Maska, Teatr Siemaszkowej, ROSiR, Stal Rzeszow football, toRzeszow, Czas Dzieci, MapaPrzygod, Co Jest Grane, Radio Rzeszow, FNT.
- Nightlife and venue sites: Jazz Club Gramofon, Strefa 57, Underground Pub, ALOHA Food Bowling & Club, LUKR Club, Grand Club, Sofa Club, Czarny Kot, Jameson Pub, Bue Bue, Lord Jack.

Already-integrated sources are out of scope except where they provide dedupe or venue-registry context.

## Source Triage

Each source will go through the same discovery checklist:

1. Fetch canonical page with browser-like headers.
2. Check for server-rendered events, RSS, WP REST, JSON-LD, form-backed APIs, and SPA state.
3. Save a fixture when the page has parseable event data or when a fixture is needed to prove that no stable events are present.
4. Classify the source as `integrated`, `ready`, `needs-endpoint`, `empty-currently`, `venue-only`, `social-only`, or `blocked`.

Activation requires all of:

- Public data available without login or private social scraping.
- Event title and date are parseable.
- A stable URL or source-specific external id can be built.
- Venue can be extracted, safely defaulted to the owner venue, or resolved by the venue registry.
- A parser test can be written against a fixture before production code.

## Architecture

The scraper will keep the existing `Source` contract and `RawEvent` shape.

- HTML or WP-style culture/local portals get focused source modules, likely grouped by domain family where the parsing style matches.
- Stal Rzeszow football extends the existing Rzeszow sports source area and follows the H69 pattern: keep only home fixtures and assign Stadion Stal Rzeszow.
- Nightlife venue sources use a dedicated venue-owned parser path when pages expose on-site events. If the source page belongs to a club/bar/disco and does not provide a separate venue field, the event is assigned to that venue's verified address.
- Venue-only pages are not added as event sources. They can enrich `rzeszow-venues.ts` so events collected from RESinet, eRzeszow, or future sources geocode cleanly.

## Initial Activation Order

The first implementation wave should prioritize sources with evidence already visible in fixtures:

1. Strefa 57: homepage fixture contains `wydarzenia` loop items with day, Polish month, year, title, image, and event link.
2. Underground Pub: homepage fixture contains an events block with dated items and event detail links.
3. Stal Rzeszow football: fixture likely contains structured schedule data; implement only if home fixtures can be separated reliably.
4. ROSiR, Visit Rzeszow, Teatr Maska, Teatr Siemaszkowej, Czas Dzieci and existing downloaded fixtures: activate only if dated events are present in the captured HTML.
5. WDK, kulturapodkarpacka, toRzeszow, MapaPrzygod, Co Jest Grane, Radio Rzeszow, FNT, ALOHA, LUKR, Grand, Sofa, Eatbu pages and Lord Jack: discover/fetch fixtures first, then activate only if they pass the activation bar.

Jazz Club Gramofon gets special caution: the current fixture looks like generic SEO/blog content rather than a real event feed. It should not become an active event source unless a separate event-specific page or feed is found.

## Data Mapping

All active group 2 adapters map to `RawEvent` with:

- `externalId`: source id plus stable page id, slug, or normalized date/title.
- `title`: cleaned event title without ticket button text or venue boilerplate.
- `date`, `startHour`, `endHour`: parsed with existing Polish date helpers where possible.
- `venueName`: extracted from page details, otherwise official venue default for venue-owned nightlife sources.
- `city`: Rzeszow or the parsed venue city when the source is regional.
- `country`: `PL`.
- `categories`: conservative tags such as `music`, `nightlife`, `sport`, `family`, `theatre`, `culture`.
- `sourceUrl`: event detail URL when present, otherwise canonical source page.
- `imageUrl`: event image when present and absolute or safely absolutized.

Regional aggregators must filter to the Rzeszow region by city, venue registry match, or bounding-box-safe venue resolution. They should not emit broad Podkarpackie events with unknown location.

## Error Handling

- Network errors remain source-local so one failed group 2 source does not stop the whole region run.
- Empty pages are valid and return no events, with tests covering the empty fixture when useful.
- Ambiguous or undated items are skipped.
- Social-only pages stay out of the active scraper unless a public non-login endpoint is found.
- Sources with heavy overlap are still acceptable if their stable ids and titles let the existing dedupe layer collapse duplicates.

## Testing

Implementation must follow TDD:

1. Write parser tests against saved fixtures and watch them fail.
2. Add minimal parser code to pass.
3. Add the source class and region wiring after parser behavior is covered.
4. Run targeted tests for the touched source files.
5. Run `npm test` and `npm run typecheck:scraper` before claiming completion.
6. If active sources are added, run `npm run event-sync -- --region=rzeszow` and summarize counts plus dropped/no-venue-match items.

## Documentation

Update `docs/event-sources-rzeszow.md` after discovery and after integration:

- mark newly integrated sources as `INTEGRATED`;
- mark failed candidates with a concrete reason;
- add Lord Jack to the nightlife table;
- update the active source count and recommended next steps.

## Non-Goals

- No scraping behind Facebook or Instagram login.
- No broad headless-browser dependency unless a source is high-value and cannot be fetched otherwise.
- No parser for daily cinema showtimes or pure menu/profile pages.
- No unrelated refactor of event sync architecture.
