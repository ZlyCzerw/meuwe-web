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
