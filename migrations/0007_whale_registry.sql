-- Whale Registry and Detailed Move Tracking
-- Tracks all whale wallet moves with strategy analysis and risk model evaluation

CREATE TABLE IF NOT EXISTS whale_registry (
  wallet TEXT PRIMARY KEY,
  label TEXT,
  chain TEXT DEFAULT 'solana',
  min_usd NUMERIC DEFAULT 25000,
  follow_mode TEXT DEFAULT 'analyze' CHECK (follow_mode IN ('analyze', 'auto-copy', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_analyzed TIMESTAMPTZ,
  total_moves_tracked INTEGER DEFAULT 0,
  qualifying_moves INTEGER DEFAULT 0,
  strategy_tag TEXT,
  confidence_score NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  avg_hold_minutes NUMERIC DEFAULT 0,
  preferred_venues TEXT[],
  preferred_chains TEXT[],
  astronomy_correlation NUMERIC DEFAULT 0
);

CREATE INDEX IF NOT EXISTS whale_registry_follow_mode_idx
  ON whale_registry (follow_mode);

-- Detailed move tracking (every single move, not just IN)
CREATE TABLE IF NOT EXISTS whale_moves_tracked (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL REFERENCES whale_registry(wallet) ON DELETE CASCADE,
  signature TEXT,
  mint TEXT,
  symbol TEXT,
  direction TEXT CHECK (direction IN ('IN', 'OUT', 'SWAP', 'STAKE', 'UNSTAKE', 'TRANSFER', 'UNKNOWN')),
  amount NUMERIC,
  usd_estimate NUMERIC,
  price_usd NUMERIC,
  venue TEXT,
  chain TEXT,
  block_time TIMESTAMPTZ NOT NULL,
  -- Analysis fields (filled by intelligence engine)
  strategy_inference TEXT CHECK (strategy_inference IN ('accumulation', 'distribution', 'arb', 'yield', 'ipo-sniper', 'rotation', 'unknown')),
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 100),
  risk_model_score NUMERIC,
  risk_model_verdict TEXT CHECK (risk_model_verdict IN ('PASS', 'FAIL', 'PENDING')),
  astronomy_phase TEXT,
  astronomy_correlation NUMERIC,
  predicted_outcome TEXT CHECK (predicted_outcome IN ('HIGH_PROB_PROFIT', 'HIGH_PROB_LOSS', 'UNCERTAIN')),
  actual_outcome TEXT CHECK (actual_outcome IN ('PROFIT', 'LOSS', 'UNCERTAIN', 'PENDING')),
  pnl_if_copied NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whale_moves_wallet_time_idx
  ON whale_moves_tracked (wallet, block_time DESC);

CREATE INDEX IF NOT EXISTS whale_moves_signature_idx
  ON whale_moves_tracked (signature) WHERE signature IS NOT NULL;

CREATE INDEX IF NOT EXISTS whale_moves_strategy_idx
  ON whale_moves_tracked (strategy_inference);

CREATE INDEX IF NOT EXISTS whale_moves_verdict_idx
  ON whale_moves_tracked (risk_model_verdict);

-- Whale astronomy correlation tracking
CREATE TABLE IF NOT EXISTS whale_astronomy_correlation (
  wallet TEXT NOT NULL REFERENCES whale_registry(wallet) ON DELETE CASCADE,
  lunar_phase TEXT NOT NULL CHECK (lunar_phase IN ('new', 'waxing_crescent', 'first_quarter', 'waxing_gibbous', 'full', 'waning_gibbous', 'last_quarter', 'waning_crescent')),
  planetary_aspect TEXT NOT NULL,
  zodiac_sign TEXT,
  total_moves INTEGER DEFAULT 0,
  winning_moves INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  avg_pnl NUMERIC DEFAULT 0,
  correlation_strength NUMERIC DEFAULT 0,
  p_value NUMERIC,
  last_updated TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (wallet, lunar_phase, planetary_aspect)
);

CREATE INDEX IF NOT EXISTS whale_astro_wallet_idx
  ON whale_astronomy_correlation (wallet);

-- Whale profile snapshots (for backtesting)
CREATE TABLE IF NOT EXISTS whale_profile_snapshots (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL REFERENCES whale_registry(wallet) ON DELETE CASCADE,
  profile_json JSONB NOT NULL,
  snapshot_type TEXT DEFAULT 'periodic' CHECK (snapshot_type IN ('periodic', 'after_analysis', 'manual')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whale_profile_wallet_time_idx
  ON whale_profile_snapshots (wallet, created_at DESC);