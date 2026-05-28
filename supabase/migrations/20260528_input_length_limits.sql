-- ============================================================
-- Input length constraints to prevent DoS via large payloads
-- Idempotent — safe to run multiple times
-- ============================================================

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS check_title_length,
  DROP CONSTRAINT IF EXISTS check_description_length;

ALTER TABLE events
  ADD CONSTRAINT check_title_length        CHECK (char_length(title) <= 200),
  ADD CONSTRAINT check_description_length  CHECK (char_length(description) <= 5000);

ALTER TABLE event_messages
  DROP CONSTRAINT IF EXISTS check_message_text_length;

ALTER TABLE event_messages
  ADD CONSTRAINT check_message_text_length CHECK (char_length(text) <= 500);

ALTER TABLE event_tags
  DROP CONSTRAINT IF EXISTS check_tag_length;

ALTER TABLE event_tags
  ADD CONSTRAINT check_tag_length          CHECK (char_length(tag) <= 100);
