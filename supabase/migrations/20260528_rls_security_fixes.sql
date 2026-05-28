-- ============================================================
-- Security hardening: require authentication for all SELECT policies
-- Previously USING (true) allowed anonymous reads; now restricted to
-- the authenticated role. Idempotent — safe to run multiple times.
-- ============================================================

-- ── events ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select"
  ON events FOR SELECT TO authenticated
  USING (true);

-- ── event_tags ───────────────────────────────────────────────
DROP POLICY IF EXISTS "event_tags_select" ON event_tags;
CREATE POLICY "event_tags_select"
  ON event_tags FOR SELECT TO authenticated
  USING (true);

-- ── event_messages ───────────────────────────────────────────
DROP POLICY IF EXISTS "event_messages_select" ON event_messages;
CREATE POLICY "event_messages_select"
  ON event_messages FOR SELECT TO authenticated
  USING (true);

-- ── profiles ────────────────────────────────────────────────
-- Restrict to authenticated. Sensitive columns (last_lat, last_lng,
-- last_seen_at, push_enabled) are not selected by the frontend for
-- other users — the event join only fetches display_name+avatar_color.
-- Column-level protection would require a separate view (future improvement).
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated
  USING (true);
