-- Kids Igo D1 schema v0.0.1

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('parent', 'quick')),
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  pin_hash TEXT,
  preferred_locale TEXT NOT NULL DEFAULT 'ja',
  created_at INTEGER NOT NULL
);

CREATE TABLE children (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  nickname TEXT NOT NULL,
  avatar_id TEXT,
  preferred_locale TEXT NOT NULL DEFAULT 'ja',
  eyecare_json TEXT NOT NULL DEFAULT '{"breakEveryMin":20,"breakSec":20,"dailyCapMin":60,"enforce":false}',
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_children_user ON children(user_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  child_id TEXT REFERENCES children(id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE lesson_progress (
  child_id TEXT NOT NULL REFERENCES children(id),
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('locked', 'in_progress', 'completed')),
  stars INTEGER NOT NULL DEFAULT 0,
  best_score TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (child_id, lesson_id)
);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  lesson_id TEXT,
  board_size INTEGER NOT NULL DEFAULT 9,
  result TEXT,
  moves_json TEXT,
  ai_level INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE badges (
  child_id TEXT NOT NULL REFERENCES children(id),
  badge_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (child_id, badge_id)
);
