-- Engine cycle support: risk multiplier + market cache
ALTER TABLE trading_engine_state ADD COLUMN IF NOT EXISTS risk_multiplier NUMERIC DEFAULT 1.0;

CREATE TABLE IF NOT EXISTS market_data_cache (
  symbol TEXT PRIMARY KEY,
  price NUMERIC NOT NULL,
  change_24h NUMERIC DEFAULT 0,
  volume_24h NUMERIC DEFAULT 0,
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_data_cache_fetched_at_idx
  ON market_data_cache (fetched_at DESC);