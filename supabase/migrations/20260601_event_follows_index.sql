-- Index for push-new-message: queries event_follows by event_id alone
CREATE INDEX IF NOT EXISTS idx_event_follows_event_id ON event_follows (event_id);
