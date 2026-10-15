-- Profit Lock, Tiers, and Equity Guard State
-- Extends the trading engine state with profit protection and dynamic tier system

CREATE TABLE IF NOT EXISTS trading_engine_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  armed BOOLEAN DEFAULT FALSE,
  mode TEXT DEFAULT 'demo',
  base_equity NUMERIC DEFAULT 500,
  compounding_equity NUMERIC DEFAULT 50,
  locked_profits NUMERIC DEFAULT 0,
  current_equity NUMERIC DEFAULT 500,
  peak_equity NUMERIC DEFAULT 500,
  current_tier TEXT DEFAULT 'micro',
  tier_updated_at TIMESTAMPTZ,
  total_compounded NUMERIC DEFAULT 0,
  config JSONB DEFAULT '{
    "profitLock": {"compoundingRate": 0.2, "compoundingCap": 100},
    "trailingStopPct": 0.10,
    "dailyLossLimitPct": 0.03,
    "maxConsecutiveLosses": 2,
    "winStreakTrigger": 3,
    "winStreakRiskMult": 0.5
  }',
  last_cycle_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Equity snapshots for trailing stop calculation
CREATE TABLE IF NOT EXISTS equity_snapshots (
  id BIGSERIAL PRIMARY KEY,
  equity NUMERIC NOT NULL,
  base_equity NUMERIC NOT NULL,
  locked_profits NUMERIC NOT NULL,
  peak_equity NUMERIC NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('cycle', 'profit_lock', 'halt', 'manual', 'tier_change')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equity_snapshots_created_at_idx
  ON equity_snapshots (created_at DESC);

-- Risk guard events for audit trail
CREATE TABLE IF NOT EXISTS risk_guard_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('trailing_stop', 'daily_dd', 'consecutive_loss', 'win_streak', 'profit_lock', 'tier_change', 'halt', 'resume')),
  equity_before NUMERIC NOT NULL,
  equity_after NUMERIC,
  trigger_value NUMERIC,
  config_snapshot JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS risk_guard_events_created_at_idx
  ON risk_guard_events (created_at DESC);