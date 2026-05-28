-- ============================================================
-- Input length constraints to prevent DoS via large payloads
-- Idempotent — safe to run multiple times
-- ============================================================

ALTER TABLE events
  ADD CONSTRAINT IF NOT EXISTS check_title_length        CHECK (char_length(title) <= 200),
  ADD CONSTRAINT IF NOT EXISTS check_description_length  CHECK (char_length(description) <= 5000);

ALTER TABLE messages
  ADD CONSTRAINT IF NOT EXISTS check_message_text_length CHECK (char_length(text) <= 500);

ALTER TABLE event_tags
  ADD CONSTRAINT IF NOT EXISTS check_tag_length          CHECK (char_length(tag) <= 100);
