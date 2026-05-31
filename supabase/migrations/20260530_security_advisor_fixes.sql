-- Security Advisor fixes — run in Supabase Dashboard → SQL Editor
-- Addresses 5 of 7 warnings (2 require Dashboard UI: storage listing + leaked password protection)

-- ── 1. tags RLS: explicit roles instead of implicit "everyone" ────────────────
DROP POLICY IF EXISTS "tags_select" ON public.tags;
CREATE POLICY "tags_select" ON public.tags
  FOR SELECT TO anon, authenticated USING (true);

-- ── 2. handle_new_user() — trigger function, must not be callable directly ───
-- Wrapped in DO block because the function may not exist in all deployments.
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ── 3. get_event_message_counts — remove anon access ─────────────────────────
REVOKE EXECUTE ON FUNCTION public.get_event_message_counts(uuid[]) FROM anon;

-- ── 4. get_event_message_counts — switch to SECURITY INVOKER ─────────────────
-- Safe because event_messages SELECT policy is USING (true), so the calling
-- user's role can already read the rows — no need to run as owner.
CREATE OR REPLACE FUNCTION public.get_event_message_counts(event_ids uuid[])
RETURNS TABLE(event_id uuid, msg_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp AS $$
  SELECT event_id, COUNT(*)::bigint AS msg_count
  FROM event_messages
  WHERE event_id = ANY(event_ids)
  GROUP BY event_id;
$$;
