# Profiles Location Privacy Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the `anon`/`authenticated` Supabase roles from reading `profiles.last_lat/last_lng/last_seen_at`, closing a live user-location leak, without breaking public profile reads, location writes, or edge functions.

**Architecture:** RLS is row-level only, so the fix is at the column-privilege layer: revoke the table-level `SELECT` grant on `public.profiles` from `anon`/`authenticated`, then grant column-level `SELECT` on every column *except* the three location columns. A dynamic `DO` block enumerates the safe columns at apply time, so nothing needs to be hardcoded. `service_role` (edge functions) bypasses grants and is unaffected.

**Tech Stack:** Supabase Postgres, PostgREST, supabase CLI 2.101.0.

**Spec:** `docs/superpowers/specs/2026-07-02-profiles-location-privacy-design.md`

---

## File Structure

- **Create** `supabase/migrations/20260702_profiles_hide_location.sql` — the single migration: revoke table-level SELECT, grant column-level SELECT on all non-location columns via a dynamic `DO` block. Self-contained; no other files change.

No client/TypeScript changes: the client only writes location (`updateProfileLocation` upsert without `.select()`) and reads only public fields.

---

### Task 1: Create the migration

**Files:**
- Create: `supabase/migrations/20260702_profiles_hide_location.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260702_profiles_hide_location.sql`:

```sql
-- Security fix: profiles.last_lat/last_lng/last_seen_at were readable by anon.
--
-- RLS is row-level, so the permissive `profiles_select USING (true)` policy plus
-- the table-level SELECT grant exposed every column — including location — to the
-- public anon key. Postgres can restrict columns only via privileges, not RLS, so
-- we replace the table-level SELECT grant with a column-level grant that omits the
-- three location columns. The DO block enumerates the current non-location columns
-- at apply time, so the safe-column list never has to be hardcoded.
--
-- service_role bypasses grants and is unaffected (edge functions still read
-- location for "nearby" filtering). Writes are unaffected: REVOKE SELECT does not
-- touch INSERT/UPDATE, and updateProfileLocation upserts without RETURNING.
--
-- NOTE: columns added to profiles in the FUTURE are not granted by this migration
-- (fail-closed). Any new *public* column must be added to the anon/authenticated
-- grant in a follow-up migration.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

DO $$
DECLARE
  safe_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO safe_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name NOT IN ('last_lat', 'last_lng', 'last_seen_at');

  IF safe_cols IS NULL THEN
    RAISE EXCEPTION 'profiles has no non-location columns to grant — aborting';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON public.profiles TO anon, authenticated',
    safe_cols
  );
END $$;
```

- [ ] **Step 2: Sanity-check the SQL parses (no DB write)**

If `psql` is available, do a dry parse. Otherwise skip — Task 2 applies against staging where errors surface immediately.

Run: `psql --version` (informational). No local Postgres is required for this repo; do not attempt to run the migration locally.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260702_profiles_hide_location.sql
git commit -m "fix(security): hide profiles location columns from anon/authenticated"
```

---

### Task 2: Apply to staging, verify, then production

**Files:** none (deployment + verification only)

> Applying requires access to the Supabase project (linked CLI or dashboard SQL editor). Use the same mechanism previous migrations used. If unsure, run the SQL from the migration in the Supabase **staging** project's SQL editor first.

- [ ] **Step 1: Apply the migration to staging**

Preferred (linked CLI): `npx supabase db push` against the staging project.
Alternative: paste the contents of `supabase/migrations/20260702_profiles_hide_location.sql` into the staging project's SQL editor and run it.

Expected: success, no error. (If it raises `profiles has no non-location columns`, stop — the table name/schema assumption is wrong; re-check.)

- [ ] **Step 2: Verify location is now blocked for anon (staging)**

Using the staging URL + anon key (from the staging `.env` / Supabase dashboard):

```bash
curl -s -o /dev/null -I -w "last_lat → %{http_code}\n" \
  "$STAGING_URL/rest/v1/profiles?select=last_lat&limit=1" \
  -H "apikey: $STAGING_ANON" -H "Authorization: Bearer $STAGING_ANON"
```
Expected: **4xx** (e.g. 403/400) — previously 200.

- [ ] **Step 3: Verify public fields still readable (staging)**

```bash
curl -s -o /dev/null -I -w "display_name → %{http_code}\n" \
  "$STAGING_URL/rest/v1/profiles?select=display_name&limit=1" \
  -H "apikey: $STAGING_ANON" -H "Authorization: Bearer $STAGING_ANON"
```
Expected: **200**.

- [ ] **Step 4: Verify a location write still works (staging)**

As a logged-in user in the staging app (or with an authenticated JWT), trigger a location update (open the map so `updateProfileLocation` runs, or run the equivalent upsert). Expected: the upsert succeeds with no `permission denied for column last_lat` error, and the map still shows event-creator `display_name`/`avatar_color`.

- [ ] **Step 5: Apply to production**

Once staging checks 2–4 pass, apply the same migration to the **production** Supabase project (`npx supabase db push` against prod, or the prod SQL editor).

- [ ] **Step 6: Re-verify on production**

Repeat Steps 2 and 3 against the production URL + anon key:
- `select=last_lat` → **4xx**
- `select=display_name` → **200**

- [ ] **Step 7: Confirm edge functions unaffected (production)**

Trigger (or wait for) a push function that reads location via `service_role` (e.g. `push-event-start`), or inspect its logs: it should still read rows and send notifications. `service_role` bypasses grants, so no change is expected — this is a confirmation, not a fix.

---

## Rollback

Emergency only (this re-opens the leak):

```sql
GRANT SELECT ON public.profiles TO anon, authenticated;
```

## Notes for the Implementer

- **No client code changes.** If a future change adds `.select()` to `updateProfileLocation`'s upsert, the writer would need SELECT on the returned columns — keep that upsert returning minimal.
- **New public columns** added to `profiles` later are not auto-granted (fail-closed). Add them to the anon/authenticated grant in a follow-up migration when introduced.
- Staging-first is mandatory: this changes a live production access-control rule.
