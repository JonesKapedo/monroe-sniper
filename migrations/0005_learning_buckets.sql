-- Learning buckets: per (venue, reason) and per-symbol accumulators, demo/live split.

CREATE TABLE IF NOT EXISTS learning_buckets (
  key TEXT NOT NULL,
  min_score INTEGER NOT NULL DEFAULT 62,
  seen INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  realized DOUBLE PRECISION NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'demo',
  PRIMARY KEY (key, mode)
);

CREATE INDEX IF NOT EXISTS learning_buckets_key_idx
  ON learning_buckets (key, mode DESC);