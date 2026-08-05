-- Weekly digest: when each profile last received one.
--
-- push-weekly-digest (edge function) selects profiles whose last_digest_at is
-- NULL or older than 6 days and stamps it after each send batch, so an hourly
-- cron can never send twice in one week, and a run that dies halfway resumes
-- where it stopped instead of resending.
--
-- Grants: 20260702_profiles_hide_location.sql replaced the table-level SELECT
-- with a column list, so this new column is NOT readable by anon/authenticated
-- (fail-closed) — which is right: only the service role (edge function) reads
-- and writes it. No grant follow-up needed.
--
-- NOTE: run manually in the SQL Editor on staging first, then PROD. The
-- migration history table on PROD is empty, so `supabase db push` is unsafe.

alter table public.profiles
  add column if not exists last_digest_at timestamptz;
