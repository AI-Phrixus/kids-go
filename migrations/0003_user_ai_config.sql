-- Per-account third-party (BYOK) coach config: base URL, key, model
ALTER TABLE users ADD COLUMN ai_config_json TEXT;
