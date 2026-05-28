-- Add push_enabled to profiles
-- Stores explicit push consent in DB, independent of browser PushManager state.
-- true  = user opted in (has or wants a push subscription)
-- false = user opted out
-- null  = not yet set (treated as false)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false;
