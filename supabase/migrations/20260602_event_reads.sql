-- In-app unread-message tracking.
-- Run manually in Supabase Dashboard → SQL Editor.

-- 1. Per-user "last read" marker per event
CREATE TABLE IF NOT EXISTS event_reads (
  user_id      uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  event_id     uuid REFERENCES events     ON DELETE CASCADE NOT NULL,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE event_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can manage own reads"
  ON event_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_event_reads_user ON event_reads (user_id);

-- 2. Unread events for the current user: followed (event_follows is the single
--    source of truth — creators auto-follow), not ended, with a message from
--    someone else newer than the user's last_read_at. Mutes are intentionally
--    ignored (the dot is independent of push muting / push_enabled).
CREATE OR REPLACE FUNCTION get_unread_event_ids()
RETURNS TABLE(event_id uuid, is_owner boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT e.id, (e.creator_id = auth.uid()) AS is_owner
  FROM event_follows f
  JOIN events e ON e.id = f.event_id
  WHERE f.user_id = auth.uid()
    AND e.status <> 'ended'
    AND e.end_time + interval '1 hour' > now()
    AND EXISTS (
      SELECT 1 FROM event_messages m
      WHERE m.event_id = e.id
        AND m.author_id <> auth.uid()
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM event_reads r
           WHERE r.user_id = auth.uid() AND r.event_id = e.id),
          'epoch'::timestamptz)
    );
$$;

GRANT EXECUTE ON FUNCTION get_unread_event_ids() TO authenticated;
