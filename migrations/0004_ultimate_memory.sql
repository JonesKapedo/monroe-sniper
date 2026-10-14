-- Ultimate-trader memory: corporate events, whale watchlist, observed whale moves.

CREATE TABLE IF NOT EXISTS corp_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  symbols TEXT NOT NULL DEFAULT '[]',
  stance TEXT NOT NULL DEFAULT 'WATCH',
  published_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE INDEX IF NOT EXISTS corp_events_published_idx
  ON corp_events (published_at DESC);
CREATE INDEX IF NOT EXISTS corp_events_kind_idx
  ON corp_events (kind);

CREATE TABLE IF NOT EXISTS whale_watches (
  wallet TEXT PRIMARY KEY,
  chain TEXT NOT NULL DEFAULT 'solana',
  label TEXT NOT NULL DEFAULT '',
  follow BOOLEAN NOT NULL DEFAULT TRUE,
  min_usd DOUBLE PRECISION NOT NULL DEFAULT 25000,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE IF NOT EXISTS whale_moves (
  signature TEXT PRIMARY KEY,
  wallet TEXT NOT NULL REFERENCES whale_watches (wallet) ON DELETE CASCADE,
  mint TEXT NOT NULL DEFAULT '',
  symbol TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  usd_estimate DOUBLE PRECISION NOT NULL DEFAULT 0,
  acted BOOLEAN NOT NULL DEFAULT FALSE,
  observed_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE INDEX IF NOT EXISTS whale_moves_wallet_time_idx
  ON whale_moves (wallet, observed_at DESC);
