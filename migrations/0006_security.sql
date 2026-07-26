-- v0.8.0 security hardening: indexes + PIN/parent login lockout columns
CREATE INDEX IF NOT EXISTS idx_sessions_expires   ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);
CREATE INDEX IF NOT EXISTS idx_children_nickname  ON children(nickname);
CREATE INDEX IF NOT EXISTS idx_games_child        ON games(child_id);

-- Failed-login lockout (applies to quick PIN logins and parent password logins)
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN login_locked_until    INTEGER NOT NULL DEFAULT 0;
