-- Click analytics: tracks button clicks from the welcome screen.
-- Intentionally lightweight — one row per click, no PII stored.
-- Query counts: SELECT action, COUNT(*) FROM analytics_clicks GROUP BY action ORDER BY count DESC;

CREATE TABLE IF NOT EXISTS analytics_clicks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action     text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analytics_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests) can insert a click — no auth required.
CREATE POLICY "anyone can insert click"
  ON analytics_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Nobody can read via client — only service_role (dashboard/admin) can.
-- No SELECT policy = SELECT is blocked for anon + authenticated.

CREATE INDEX IF NOT EXISTS idx_analytics_clicks_action ON analytics_clicks (action);
CREATE INDEX IF NOT EXISTS idx_analytics_clicks_created ON analytics_clicks (created_at);
