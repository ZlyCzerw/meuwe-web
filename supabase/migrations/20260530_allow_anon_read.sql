-- Allow anonymous (guest) users to read events, tags, messages and profiles.
-- Write operations remain restricted to authenticated users only.
-- Idempotent — safe to run multiple times.

-- ── events ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select"
  ON events FOR SELECT
  USING (true);

-- ── event_tags ───────────────────────────────────────────────
DROP POLICY IF EXISTS "event_tags_select" ON event_tags;
CREATE POLICY "event_tags_select"
  ON event_tags FOR SELECT
  USING (true);

-- ── event_messages ───────────────────────────────────────────
DROP POLICY IF EXISTS "event_messages_select" ON event_messages;
CREATE POLICY "event_messages_select"
  ON event_messages FOR SELECT
  USING (true);

-- ── profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  USING (true);
