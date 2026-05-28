-- ============================================================
-- Input length constraints to prevent DoS via large payloads
-- Idempotent — drop existing constraint before re-adding
-- ============================================================

-- events.title (max 200 chars)
ALTER TABLE events DROP CONSTRAINT IF EXISTS check_title_length;
ALTER TABLE events ADD CONSTRAINT check_title_length CHECK (char_length(title) <= 200);

-- events.description (max 5000 chars)
ALTER TABLE events DROP CONSTRAINT IF EXISTS check_description_length;
ALTER TABLE events ADD CONSTRAINT check_description_length CHECK (char_length(description) <= 5000);

-- event_messages.text (max 500 chars)
ALTER TABLE event_messages DROP CONSTRAINT IF EXISTS check_message_text_length;
ALTER TABLE event_messages ADD CONSTRAINT check_message_text_length CHECK (char_length(text) <= 500);

-- event_tags.tag (max 100 chars)
ALTER TABLE event_tags DROP CONSTRAINT IF EXISTS check_tag_length;
ALTER TABLE event_tags ADD CONSTRAINT check_tag_length CHECK (char_length(tag) <= 100);
