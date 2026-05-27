-- Returns message counts per event — used by getMyEvents()
-- Apply in Supabase Dashboard → SQL Editor → Run
CREATE OR REPLACE FUNCTION get_event_message_counts(event_ids uuid[])
RETURNS TABLE(event_id uuid, msg_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT event_id, COUNT(*)::bigint AS msg_count
  FROM event_messages
  WHERE event_id = ANY(event_ids)
  GROUP BY event_id;
$$;
