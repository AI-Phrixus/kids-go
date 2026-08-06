-- Persistent safety limits for login and write-heavy endpoints.
CREATE TABLE IF NOT EXISTS login_throttle (
  subject TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_quota (
  scope TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, day)
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(user_id, created_at);
