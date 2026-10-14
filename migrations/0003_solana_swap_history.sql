CREATE TABLE IF NOT EXISTS solana_swap_events (
  signature TEXT NOT NULL,
  pair_address TEXT NOT NULL,
  block_time_ms BIGINT NOT NULL,
  dex_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  price_usd DOUBLE PRECISION NOT NULL CHECK (price_usd > 0),
  base_amount DOUBLE PRECISION NOT NULL CHECK (base_amount > 0),
  quote_amount DOUBLE PRECISION NOT NULL CHECK (quote_amount > 0),
  PRIMARY KEY (signature, pair_address)
);

CREATE INDEX IF NOT EXISTS solana_swap_events_time_idx
  ON solana_swap_events (block_time_ms DESC);

CREATE INDEX IF NOT EXISTS solana_swap_events_pair_time_idx
  ON solana_swap_events (pair_address, block_time_ms DESC);
