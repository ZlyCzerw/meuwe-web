-- ============================================================
-- Push Notifications Infrastructure
-- Wklej całość do Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Push subscriptions (per device — jeden user może mieć wiele)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth_key   text NOT NULL,   -- "auth" jest reserved word w SQL
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can read own push subs"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user can insert own push subs"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user can delete own push subs"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Edge Functions muszą mieć dostęp do wszystkich subskrypcji
-- (service_role key omija RLS, więc nie trzeba osobnej polityki)

-- 2. Wyciszenie powiadomień o wiadomościach per event
CREATE TABLE IF NOT EXISTS notification_mutes (
  user_id   uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  event_id  uuid REFERENCES events ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE notification_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can manage own mutes"
  ON notification_mutes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Lokalizacja usera w profilu (do filtrowania "w okolicy" gdy apka zamknięta)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_lat float8,
  ADD COLUMN IF NOT EXISTS last_lng float8,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- 4. Flaga żeby nie wysyłać powiadomienia o starcie dwa razy
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS start_notified_at timestamptz;

-- 5. Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_notif_mutes_user_event ON notification_mutes (user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_events_start_notified ON events (start_time, start_notified_at)
  WHERE start_notified_at IS NULL;
