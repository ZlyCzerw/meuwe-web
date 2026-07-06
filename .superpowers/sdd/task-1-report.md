# Task 1 Report: Discovery Fixtures And Classification Baseline

## What changed

- Fetched new canonical group 2 fixtures that were missing from `scripts/event-sync/__fixtures__/`:
  - `wdk_rzeszow.html`
  - `kulturapodkarpacka_home.html`
  - `torzeszow_wydarzenia.html`
  - `cojestgrane_rzeszow.html`
  - `radio_rzeszow_kalendarz.html`
  - `fnt_rzeszow_wydarzenia.html`
  - `mapaprzygod_rzeszow.html`
  - `aloha_home.html`
  - `lukr_home.html`
  - `grandclub_rezerwacje.html`
  - `lordjack_home.html`
- Updated `docs/event-sources-rzeszow.md` to:
  - normalize group 2 statuses to the required set
  - add the missing `Lord Jack` classification row
  - replace the earlier Jazz Gramofon assumption with a blocked/low-value classification based on the current fixture
  - promote fixture-backed sources with concrete dated blocks to `READY` where justified (`WDK`, `kulturapodkarpacka`, `toRzeszow`, `Co Jest Grane`, `FNT`)
  - mark venue-only or empty-currently sources from fixture evidence (`ALOHA`, `LUKR`, `Lord Jack`, `MapaPrzygód`)
  - document the `clubsofa.pl` TLS failure on the canonical URL
  - refresh verification/fixture dates to `2026-07-06`

## Commands and checks run

- Read task brief:
  - `sed -n '1,260p' .superpowers/sdd/task-1-brief.md`
- Fetched canonical fixtures with the required browser UA and `Accept-Language: pl`:
  - `curl -L -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' -H 'Accept-Language: pl' -o ...`
- Fixture marker scan from the brief:
  - `rg -n "Event|event|wydarzen|wydarzenia|kalendarium|koncert|imprez|repertuar|2026|lip|sie|wrz|paź|paz|lis|gru|date|data" scripts/event-sync/__fixtures__`
- Targeted inspections:
  - `rg -n ... scripts/event-sync/__fixtures__/...`
  - `sed -n ... scripts/event-sync/__fixtures__/...`
- Status vocabulary verification:
  - `rg -n "⚠️ (DUPLICATE|DIRECTORY|LOW-VALUE|HTML/API-DISCOVERY)|⛔ BLOCKED \|" docs/event-sources-rzeszow.md`

## Files changed

- `docs/event-sources-rzeszow.md`
- `scripts/event-sync/__fixtures__/wdk_rzeszow.html`
- `scripts/event-sync/__fixtures__/kulturapodkarpacka_home.html`
- `scripts/event-sync/__fixtures__/torzeszow_wydarzenia.html`
- `scripts/event-sync/__fixtures__/cojestgrane_rzeszow.html`
- `scripts/event-sync/__fixtures__/radio_rzeszow_kalendarz.html`
- `scripts/event-sync/__fixtures__/fnt_rzeszow_wydarzenia.html`
- `scripts/event-sync/__fixtures__/mapaprzygod_rzeszow.html`
- `scripts/event-sync/__fixtures__/aloha_home.html`
- `scripts/event-sync/__fixtures__/lukr_home.html`
- `scripts/event-sync/__fixtures__/grandclub_rezerwacje.html`
- `scripts/event-sync/__fixtures__/lordjack_home.html`

## Self-review

- Stayed inside task scope: fixtures and docs only, no parser work.
- Did not stage or modify unrelated dirty files outside Task 1.
- Used current fixture evidence to classify sources instead of relying on earlier notes.
- Confirmed the third-pass group 2 table now uses only the allowed status set.

## Concerns

- `clubsofa.pl` could not be fetched from the canonical URL because the required `curl` command failed with:
  - `curl: (60) SSL certificate problem: unable to get local issuer certificate`
- `mapaprzygod.pl/wydarzenia/miasto/rzeszow` currently returns a branded `404` page, so the `EMPTY-CURRENTLY` classification is based on the canonical URL being non-empty but not usable as an event listing.
- Several previously existing group 2 fixtures were already untracked in the workspace before this task (`czasdzieci`, `nightlife_*`, `rosir`, `stalrzeszow`, `teatr*`, `visitrzeszow`). I inspected them where useful for classification, but they should not be staged as part of this task unless explicitly intended.
