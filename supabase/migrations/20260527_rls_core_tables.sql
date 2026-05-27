-- ============================================================
-- RLS policies for: events, profiles, event_tags, event_messages
-- Apply in Supabase Dashboard → SQL Editor → Run
-- Idempotent: safe to run multiple times (drops existing policies first)
-- ============================================================

-- ── events ──────────────────────────────────────────────────

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select"
  ON events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "events_insert" ON events;
CREATE POLICY "events_insert"
  ON events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "events_update" ON events;
CREATE POLICY "events_update"
  ON events FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "events_delete" ON events;
CREATE POLICY "events_delete"
  ON events FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

-- ── profiles ────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── event_tags ───────────────────────────────────────────────

ALTER TABLE event_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_tags_select" ON event_tags;
CREATE POLICY "event_tags_select"
  ON event_tags FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "event_tags_insert" ON event_tags;
CREATE POLICY "event_tags_insert"
  ON event_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE id = event_tags.event_id
        AND creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_tags_delete" ON event_tags;
CREATE POLICY "event_tags_delete"
  ON event_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE id = event_tags.event_id
        AND creator_id = auth.uid()
    )
  );

-- ── event_messages ───────────────────────────────────────────

ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_messages_select" ON event_messages;
CREATE POLICY "event_messages_select"
  ON event_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "event_messages_insert" ON event_messages;
CREATE POLICY "event_messages_insert"
  ON event_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "event_messages_delete" ON event_messages;
CREATE POLICY "event_messages_delete"
  ON event_messages FOR DELETE to authenticated
  USING (auth.uid() = author_id);
