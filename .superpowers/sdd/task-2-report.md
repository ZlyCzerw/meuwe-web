# Task 2 Report: Strefa 57 and Underground Venue-Owned Parsers

## Status

DONE

## Files changed

- `scripts/event-sync/sources/nightlife-rzeszow.test.ts`
- `scripts/event-sync/sources/nightlife-rzeszow.ts`
- `.superpowers/sdd/task-2-report.md`

## RED evidence

Command:

```bash
npm test -- scripts/event-sync/sources/nightlife-rzeszow.test.ts
```

Result:

- Exit code: `1`
- Failure mode: Vitest could not resolve `./nightlife-rzeszow.ts` from `nightlife-rzeszow.test.ts`
- This confirmed the new parser module did not exist yet and the test was genuinely exercising missing behavior

## GREEN evidence

Command:

```bash
npm test -- scripts/event-sync/sources/nightlife-rzeszow.test.ts
```

Result:

- Exit code: `0`
- `Test Files  1 passed (1)`
- `Tests  3 passed (3)`

## Implementation summary

- Added `parseStrefa57(html)` for dated Strefa 57 event cards
- Added `parseUnderground(html)` for Underground Pub calendar items
- Added `Strefa57Source` and `UndergroundPubSource` with venue-owned fetch/scrape behavior
- Kept scope limited to parser/source code only; no region wiring and no venue registry edits

## Self-review

- Matched the export surface and expectations from the brief exactly
- Deduplicates repeated Strefa 57 items by post ID
- Normalizes Underground title dashes to satisfy fixture expectations
- Uses shared helpers: `venueOwnedRaw`, `absoluteUrl`, `cleanText`, `inDateWindow`
- Did not touch `regions/rzeszow.ts` or any registry/config wiring reserved for Task 3

## Concerns

- No additional concerns in parser scope
