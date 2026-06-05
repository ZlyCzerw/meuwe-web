-- Returns avatar_color and display_name for followers of an event, bypassing RLS.
-- Used to render social-proof avatars in EventSheet without exposing follow rows.
CREATE OR REPLACE FUNCTION get_event_follower_colors(p_event_id uuid)
RETURNS TABLE (avatar_color text, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.avatar_color, p.display_name
  FROM event_follows ef
  LEFT JOIN profiles p ON p.id = ef.user_id
  WHERE ef.event_id = p_event_id
  LIMIT 10;
$$;
