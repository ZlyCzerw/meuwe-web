-- Returns total interactions (messages + follows) per event.
-- Used to scale map pins: more interactions → larger marker.
-- Granted to anon so guest map view also gets scaled pins.
-- (anon gets 0 follows via RLS — no error, just empty result from event_follows)
CREATE OR REPLACE FUNCTION get_event_interactions(event_ids uuid[])
RETURNS TABLE(event_id uuid, interaction_count bigint)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    e,
    COALESCE(msg.cnt, 0) + COALESCE(fol.cnt, 0) AS interaction_count
  FROM unnest(event_ids) AS e
  LEFT JOIN (
    SELECT event_id, COUNT(*) AS cnt
    FROM event_messages
    WHERE event_id = ANY(event_ids)
    GROUP BY event_id
  ) msg ON msg.event_id = e
  LEFT JOIN (
    SELECT event_id, COUNT(*) AS cnt
    FROM event_follows
    WHERE event_id = ANY(event_ids)
    GROUP BY event_id
  ) fol ON fol.event_id = e;
$$;

GRANT EXECUTE ON FUNCTION get_event_interactions(uuid[]) TO anon, authenticated;
