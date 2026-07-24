-- Friends (nickname-gated) + short kid-safe chat
CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  child_lo TEXT NOT NULL,
  child_hi TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  accepted_at INTEGER,
  UNIQUE(child_lo, child_hi)
);

CREATE INDEX IF NOT EXISTS idx_friend_lo ON friendships(child_lo, status);
CREATE INDEX IF NOT EXISTS idx_friend_hi ON friendships(child_hi, status);
CREATE INDEX IF NOT EXISTS idx_friend_status ON friendships(status, created_at);

CREATE TABLE IF NOT EXISTS friend_messages (
  id TEXT PRIMARY KEY,
  friendship_id TEXT NOT NULL,
  from_child_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_msg_friend ON friend_messages(friendship_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_from ON friend_messages(from_child_id, created_at);
