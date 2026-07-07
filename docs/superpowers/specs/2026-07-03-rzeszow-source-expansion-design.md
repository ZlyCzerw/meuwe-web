# Rzeszow source expansion

**Date:** 2026-07-03
**Status:** Approved

## Goal

Integrate the useful Rzeszow-region event sources from the audit into
`scripts/event-sync/` while keeping the scraper maintainable. The first
implementation scope includes:

- high-value sources ready to add now,
- useful sources that need parser work,
- club and nightlife sources that can produce dated public events.

This excludes social-only sources, blocked sources, and ticketing/API-discovery
platforms that need a separate browser/API research pass.

## Source Groups In Scope

### High-value first wave

- Koncerty w Rzeszowie
- Klub Pod Palma
- RESinet kalendarium
- Miasto Rzeszow / erzeszow.pl
- Visit Rzeszow
- Teatr Maska
- Czas Dzieci

### Useful parser/dopracowanie group

- WDK Rzeszow
- Podkarpacki Informator Kulturalny
- Teatr im. Wandy Siemaszkowej
- ROSiR
- Stal Rzeszow football
- H69 / Stal Rzeszow speedway
- Co Jest Grane Rzeszow
- MapaPrzygod
- Atrakcje.pl
- Radio Rzeszow
- FNT Rzeszow
- toRzeszow.pl

### Nightlife and venue group

- Jazz Club Gramofon
- Strefa 57
- Underground Pub
- ALOHA Food, Bowling & Club
- LUKR Club
- Grand Club
- Sofa Club
- Czarny Kot
- Jameson Pub
- Bue Bue Klubokawiarnia

Grand Club and Sofa Club had generic fetch failures in the audit; they remain in
scope as "attempt if public fetch/headless-free access is found". Czarny Kot,
Jameson, and Bue Bue are useful only if dated event content exists; otherwise
they are venue/backlog entries rather than active sources.

## Out Of Scope

- Facebook and Instagram scraping.
- Social groups as direct scraper inputs.
- Nasze Miasto, Bilety24, Going, and other blocked/shell-only sources.
- Ticketing/API-discovery platforms such as KupBilecik, Biletomat, PanBilet,
  Biletor, GoOut, Adria Art, and Krajownik.
- Full browser/headless scraping.
- Automated DB insertion or scheduler changes.

## Architecture

Use a layered source strategy instead of writing one large bespoke adapter per
site.

1. **Configured Tribe sources**
   Add high-confidence WordPress The Events Calendar sites to the existing
   `TribeEventsSource` configuration:

   - `koncertywrzeszowie` (`https://koncertywrzeszowie.pl`)
   - `podpalma` (`https://www.podpalma.pl`)

   This should require little or no new parser code. Empty results are valid for
   Pod Palma when the API has no events in the active date range.

2. **Reusable HTML/RSS helpers**
   Add small shared helpers for Polish listing pages:

   - date extraction via existing `pl-dates.ts`,
   - hour extraction (`HH:MM`, `godz. HH:MM`),
   - absolute URL resolution,
   - text cleanup,
   - default venue fallback for venue-owned sources.

   The helpers should stay source-neutral; source files still own selectors and
   site-specific rules.

3. **High-yield custom parsers**
   Implement custom source adapters for event-rich sites whose structure is
   known to differ:

   - `resinet`
   - `erzeszow`
   - `visitrzeszow`

   These should get fixtures and parser tests first.

4. **Topic-specific parsers**
   Add smaller adapters for family/culture/sport/nightlife sites only when a
   fixture proves dated events can be extracted. Good candidates:

   - family/theatre: `teatrmaska`, `czasdzieci`, `teatr-rzeszow`
   - sport: `stalrzeszow`, `h69`, `rosir`
   - nightlife: `gramofon`, `strefa57`, `underground`, `aloha`, `lukr`

5. **Attempt-but-do-not-force sources**
   `grandclub`, `sofa`, `czarnykot`, `jameson`, and `buebue` should be probed
   during implementation. Add active sources only if they produce dated public
   events without login or headless browser. Otherwise document them as venue
   backlog and skip runtime integration.

## Club Venue Rule

For official club/bar/disco pages, if an extracted event has no separate venue,
default it to the source venue. That means:

- `venueName` is the club's canonical name,
- `city` is `Rzeszow`,
- `address` should be provided when known or recoverable from the venue registry,
- the event is allowed to pass strict geocoding through the curated venue entry.

This rule applies only when the source is the official site of the venue and the
event is plausibly on-site. It must not apply to aggregators or city calendars.

## Data Flow

Each new source must output `RawEvent` only. The existing pipeline remains
responsible for:

- normalization,
- timezone conversion,
- geocoding,
- category mapping,
- cross-source dedup,
- SQL generation.

No new source should write directly to SQL or bypass `normalizeEvent`.

## Acceptance Criteria

- `RZESZOW.sources` includes the new integrated sources that have proven parser
  tests or valid empty-source tests.
- Each custom parser has at least one fixture-backed test.
- Sources that cannot produce dated public events are not added as active runtime
  sources.
- Club-owned sources use the venue fallback rule where appropriate.
- Social-only and blocked sources remain excluded from runtime scraping.
- `npm test` and `npm run typecheck:scraper` pass.
- The existing Tenerife sources and tests keep passing.

## Verification Strategy

- Unit tests for every parser helper and custom parser.
- Existing `TribeEventsSource` tests remain valid; add coverage only if the
  Rzeszow configuration requires new behavior.
- Region config tests assert that expected new source IDs are present.
- Run a live `npm run event-sync -- --region=rzeszow` only after parser tests and
  typecheck pass, then inspect summary counts and `no-venue-match` output.

## Implementation Order

1. Add configured Tribe sources (`koncertywrzeszowie`, `podpalma`).
2. Add shared source helper utilities for Polish HTML listings and venue-owned
   defaults.
3. Implement `resinet`, `erzeszow`, and `visitrzeszow`.
4. Implement family/culture parsers (`teatrmaska`, `czasdzieci`,
   `teatr-rzeszow`) and choose additional culture parsers based on fixture
   quality.
5. Implement sport parsers (`stalrzeszow`, `h69`, optionally `rosir`) with
   home-event filtering.
6. Implement nightlife parsers for sources with dated public event content.
7. Update `docs/event-sources-rzeszow.md` with final integration statuses.

## Risk Controls

- Do not add a source just because the website exists.
- Do not parse daily cinema showtimes or shopping promotions as events.
- Do not ingest away matches as local events.
- Do not let regional portals add events outside the Rzeszow bbox.
- Do not use headless browser or social scraping in this implementation pass.
