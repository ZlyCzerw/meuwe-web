-- Add is_private column (false = public, default)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Replace permissive SELECT policy with one that hides private events
-- from users who are neither the creator nor a follower.
DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select" ON events FOR SELECT
  USING (
    NOT is_private
    OR auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM event_follows
      WHERE event_id = events.id
        AND user_id = auth.uid()
    )
  );

-- SECURITY DEFINER RPC: fetch any event by ID, bypassing RLS.
-- Used exclusively for deep-link opens — possessing the UUID equals
-- possessing the share link, which is treated as authorization.
CREATE OR REPLACE FUNCTION get_event_by_id(p_event_id uuid)
RETURNS SETOF events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM events WHERE id = p_event_id;
$$;

GRANT EXECUTE ON FUNCTION get_event_by_id(uuid) TO anon, authenticated;
