-- Event follows — users subscribe to notifications for specific events
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS event_follows (
  user_id  uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events     ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE event_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can manage own follows"
  ON event_follows FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- anon can't read follows (privacy)
-- service_role (edge functions) bypasses RLS
