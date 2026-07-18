# Pin Exclusivity Zone (3x3 m) - Design

**Date:** 2026-07-14
**Status:** Approved (brainstorming)

## Problem

Every pin (an `events` row) should own a 3x3 m exclusivity area for the whole
duration of its time window (`start_time` -> `end_time`). If a user tries to
create (or edit) a pin whose zone overlaps an existing pin's zone during an
overlapping time window, the write must be rejected and the user shown a styled
meuwe modal telling them to change the time or move the location. The message
must be localized in all four supported languages (pl / en / es / de).

## Collision Rule

Two pins collide when **all** of the following hold:

1. **Spatial** - their 3x3 m squares (centre +/- 1.5 m, axis-aligned N/E)
   overlap. In local metres:
   - `d_lat_m = (lat_a - lat_b) * 111320`
   - `d_lng_m = (lng_a - lng_b) * 111320 * cos(radians(lat_a))`
   - overlap when `abs(d_lat_m) < 3 AND abs(d_lng_m) < 3` (centres within 3 m on
     each axis; strict `<`, so squares merely touching at 3 m do not collide).
2. **Temporal** - the time intervals overlap: `new.start < existing.end AND
   existing.start < new.end`. Strict `<`, so back-to-back events at the same
   spot (one ends exactly when the next begins) are allowed.
3. **Eligibility** - only **public** (`is_private = false`) rows participate:
   a private pin neither blocks others nor is blocked. Ended events are excluded
   naturally by the temporal test (their `end_time` is in the past). The row
   being written excludes **itself** by `id` (matters for edit).

No PostGIS: `lat`/`lng` are plain float columns, so the metre conversion above
is done inline in SQL and in TS.

## Database Layer (source of truth) - Supabase migration

New migration file: `supabase/migrations/20260714_pin_exclusivity_zone.sql`.

- **`_event_zone_conflict(p_lat, p_lng, p_start, p_end, p_exclude_id)`** -
  internal SQL function returning the first conflicting public, non-self event
  row (or NULL). Encapsulates the collision rule so it is defined once.
- **Trigger `BEFORE INSERT OR UPDATE ON events`** - calls
  `_event_zone_conflict(NEW.lat, NEW.lng, NEW.start_time, NEW.end_time, NEW.id)`.
  Skips the check entirely when `NEW.is_private = true`. On conflict:
  `RAISE EXCEPTION 'zone occupied' USING ERRCODE = 'MW001'`. This is the atomic
  guarantee - it fires for every write path (client insert/update, edit,
  future imports), immune to races and direct API calls.
- **RPC `event_zone_conflict(p_lat, p_lng, p_start, p_end, p_exclude_id)`**
  (SECURITY DEFINER, granted to `anon`/`authenticated`) - thin public wrapper
  over the internal function, returns a boolean (or the conflicting id).
  Used by the client for a fast pre-check before uploading photos.

Both the trigger and the RPC call the same `_event_zone_conflict`, so the rule
lives in exactly one place.

**Deploy note:** repo `.env` points at PROD Supabase (`bcfhsbnbvsuxsiwmeway`).
Apply and verify on **staging** first; PROD only via the `main` branch per the
deploy-branch rule.

## Client Layer

- **`src/lib/zoneConflict.ts`** - pure, unit-testable TS mirror of the collision
  rule (`zonesCollide(a, b)` + interval/space helpers). Keeps geometry logic
  testable without a DB round-trip. (The DB remains the source of truth; this is
  for the fast pre-check + tests.)
- **`src/components/ConflictModal.tsx`** - new modal styled like existing meuwe
  modals: fixed backdrop `rgba(45,43,42,0.45)` + fadeIn, and a **centred card**
  (rounded 32, white, `C`/`INK`/`F` tokens, subtle pop-in) - a short alert reads
  better centred than as a full bottom sheet. Contents: title, body, single
  full-width "close" button (primary style, like `TagPickerModal`'s done
  button). Props: `{ onClose }`. Copy comes from i18n.
- **`CreateSheet.submit()`** ([src/screens/CreateSheet.tsx](../../../src/screens/CreateSheet.tsx)):
  after `normalizeTimes`, and **before** photo upload, call
  `db.eventZoneConflict({ lat, lng, start, end, excludeId })` (`excludeId` set to
  `editEvent.id` in edit mode; skip the call when the event is private). On
  conflict -> open `ConflictModal`, stop (no upload, no insert). As a safety net
  for the race window, also map a Postgres error carrying `ERRCODE MW001` from
  `createEvent`/`updateEvent` to the same modal.
- **`src/lib/supabase.ts`** - add `db.eventZoneConflict(...)` calling the RPC;
  keep `createEvent`/`updateEvent` inserts/updates unchanged (the trigger guards
  them).

## i18n (all four languages)

New `conflict` block in `src/locales/{pl,en,es,de}.ts`. No long dashes in copy
(plain hyphen only).

| key   | pl | en | es | de |
|-------|----|----|----|----|
| title | Miejsce zajete | Spot taken | Lugar ocupado | Platz belegt |
| body  | Wydarzenie w tym miejscu i czasie juz istnieje, popraw czas wydarzenia lub zmien miejsce | An event already exists at this place and time - adjust the time or move the location. | Ya existe un evento en este lugar y horario: ajusta la hora o cambia la ubicacion. | An diesem Ort und zu dieser Zeit existiert bereits ein Event - passe die Zeit an oder aendere den Ort. |
| ok    | Zamknij | Close | Cerrar | Schliessen |

(Polish/German diacritics written normally in the actual locale files; the table
above is ASCII-flattened only for this doc.)

## Testing

- `src/lib/zoneConflict.test.ts` (vitest) covering:
  - spatial overlap vs disjoint (just inside / just outside 3 m on each axis);
  - temporal overlap vs disjoint vs exactly touching endpoints (allowed);
  - private event ignored on both sides;
  - self-exclusion by id (edit case);
  - combined: same place + overlapping time = collide; same place + disjoint
    time = ok; overlapping time + far apart = ok.
- Manual verification on staging: create two overlapping public pins -> modal;
  move one > 3 m or shift time -> succeeds; private pin over a public one ->
  succeeds; edit an event onto another's zone -> modal.

## Out of Scope

- Visualising the 3x3 m zone on the map.
- Any change to how private events are stored or shared.
- Backfilling / de-duplicating existing overlapping rows.
