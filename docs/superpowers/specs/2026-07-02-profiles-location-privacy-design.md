# Fix: Profiles Location Exposed to Anonymous Clients

**Status:** Planned (not yet implemented)
**Date:** 2026-07-02
**Stack:** Supabase Postgres (RLS + column privileges), PostgREST

---

## Problem

The `profiles` table stores each logged-in user's last known location — `last_lat`, `last_lng`, `last_seen_at` — written every ~5 minutes by `db.updateProfileLocation` (`src/lib/supabase.ts`).

Its RLS SELECT policy is currently permissive with no role restriction (final definition in `supabase/migrations/20260530_allow_anon_read.sql`):

```sql
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
```

RLS in Postgres is **row-level, not column-level**. A `USING (true)` SELECT policy combined with the table-level `SELECT` privilege that Supabase grants to the `anon` and `authenticated` roles exposes **every column** — including the location columns — to anyone holding the public `anon` key (which is embedded in the client bundle).

**Confirmed live** (HEAD requests, no row data retrieved):

```
GET /rest/v1/profiles?select=last_lat      → HTTP 200   (anon can read location)
GET /rest/v1/profiles?select=display_name  → HTTP 200
```

**Impact:** any unauthenticated party can query `select last_lat,last_lng,last_seen_at from profiles` and obtain the near-real-time location of every user. This is a serious privacy breach and a GDPR concern (`docs/legal/compliance-requirements.md`). The app's own queries requesting only `display_name,avatar_color` do not mitigate this — a malicious client requests whatever columns it wants.

## Goals

1. Prevent `anon` and `authenticated` roles from reading `last_lat`, `last_lng`, `last_seen_at` on `profiles`.
2. Keep the public profile fields (`display_name`, `avatar_color`, etc.) readable, so the guest map and event views keep working.
3. Do not break location writes (`updateProfileLocation`) or the edge functions that read location via `service_role`.
4. Minimal change — no client code changes, no schema/data migration.

## Non-Goals

- Private events (verified separately — already correctly hidden from anon by the `events_select` policy in `20260608_private_events.sql`; the `get_event_by_id` SECURITY DEFINER RPC is an intentional share-link/capability model). No change.
- npm dependency vulnerabilities and Android `allowBackup` hardening (out of scope for this spec).
- Column-level protection for any table other than `profiles`.

---

## Approach: column-level SELECT grants

RLS cannot restrict columns, so restrict them at the **privilege** layer. Replace the table-level `SELECT` grant to `anon`/`authenticated` with a column-level grant that omits the location columns. PostgREST enforces column privileges, so a request for `last_lat` from those roles returns an error.

Chosen over:
- **Public view** (`public_profiles`): cleaner separation but requires changing the PostgREST embed `profiles(display_name,avatar_color)` in the events query — client changes, more surface.
- **Separate `user_locations` table**: cleanest long-term but the most work (schema + data migration + rewire writes and edge-function reads). Overkill for closing this leak.

Column grants are the smallest change that fully closes the exposure with zero client changes.

## Implementation

New migration `supabase/migrations/<timestamp>_profiles_hide_location.sql`:

```sql
-- Table-level SELECT exposes every column regardless of the row-level RLS policy.
-- Replace it with a column-level grant that omits the location columns, so anon /
-- authenticated can read public profile fields but never last_lat/last_lng/last_seen_at.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT  SELECT (<every profiles column EXCEPT last_lat, last_lng, last_seen_at>)
  ON public.profiles TO anon, authenticated;
```

The exact safe-column list is enumerated at implementation time from the live schema:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name NOT IN ('last_lat', 'last_lng', 'last_seen_at')
ORDER BY ordinal_position;
```

Notes:
- RLS policy `profiles_select USING (true)` is left unchanged — the fix is purely at the column-privilege layer.
- `service_role` is unaffected (it bypasses RLS and grants); edge functions that read location for "nearby" filtering keep working.
- Writes are unaffected: `REVOKE SELECT` does not touch INSERT/UPDATE privileges. `updateProfileLocation` calls `.upsert(...)` **without** `.select()`, so supabase-js sends `Prefer: return=minimal` — no RETURNING, so no SELECT privilege on location columns is needed. **Guard:** if a future change adds `.select()` to that upsert, the writer would need SELECT on the returned columns; keep it minimal.
- New columns added to `profiles` later are NOT granted by default (fail-closed) — a safe default, but any new *public* column must be added to the grant. Document this next to the migration.

## Testing / Verification

After applying the migration (against staging first):

1. **Location blocked for anon:**
   `GET /rest/v1/profiles?select=last_lat&limit=1` with the anon key → expect **4xx** (was 200).
2. **Public fields still readable:**
   `GET /rest/v1/profiles?select=display_name&limit=1` → expect **200**.
3. **Writes still work:** a logged-in client `updateProfileLocation` upsert succeeds (no privilege error).
4. **App smoke:** guest map still renders event-creator `display_name` / `avatar_color`.
5. **Edge functions:** a push function that reads location via `service_role` still returns rows (service_role unaffected).

## Rollout

- Apply to the Supabase **staging** project/branch first, run checks 1–5, then apply to production.
- Rollback if needed: `GRANT SELECT ON public.profiles TO anon, authenticated;` restores prior behavior (re-opens the leak — only as an emergency revert).
