-- Add external_id column for tracking events imported from external sources.
-- 'lagenda:41994' = event ID 41994 from lagenda.org
-- Unique index prevents duplicate imports on re-runs.
-- Run manually in Supabase Dashboard → SQL Editor

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS events_external_id_idx
  ON events (external_id)
  WHERE external_id IS NOT NULL;
