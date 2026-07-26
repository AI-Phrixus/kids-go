-- v0.8.0 coach pipeline: provider circuit-breaker state.
-- (coach_quota itself is created by 0002; the runtime DDL fallback that used to
--  run on every request has been removed — migrations own the schema now.)
CREATE TABLE IF NOT EXISTS coach_provider_state (
  slug TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  open_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
