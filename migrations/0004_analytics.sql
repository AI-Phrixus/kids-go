-- Usage analytics for summer observation (no PII beyond child_id)
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  child_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_child ON usage_events(child_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_type ON usage_events(event_type, created_at);
