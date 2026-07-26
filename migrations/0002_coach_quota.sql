-- Soft-budget tracking for Cloudflare Workers AI free tier (UTC day)
CREATE TABLE IF NOT EXISTS coach_quota (
  day TEXT PRIMARY KEY,
  cf_success INTEGER NOT NULL DEFAULT 0,
  cf_fail_quota INTEGER NOT NULL DEFAULT 0,
  byok_success INTEGER NOT NULL DEFAULT 0,
  static_fallback INTEGER NOT NULL DEFAULT 0,
  cf_blocked_soft INTEGER NOT NULL DEFAULT 0,
  last_alert TEXT
);
