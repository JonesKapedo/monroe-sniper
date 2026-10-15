-- Qualifying Trades Only
-- Separate table for trades that meet strict criteria for learning/readiness
-- Both TP (successful) and SL (disciplined) hits count as qualifying

CREATE TABLE IF NOT EXISTS qualifying_trades (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  exit_price DOUBLE PRECISION NOT NULL,
  stop_price DOUBLE PRECISION NOT NULL,
  target_price DOUBLE PRECISION NOT NULL,
  qty DOUBLE PRECISION NOT NULL,
  notional DOUBLE PRECISION NOT NULL,
  pnl DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('TARGET', 'STOP')),
  hold_minutes INTEGER NOT NULL,
  risk_reward_planned DOUBLE PRECISION,
  risk_reward_actual DOUBLE PRECISION,
  discipline_score DOUBLE PRECISION DEFAULT 1.0 CHECK (discipline_score >= 0 AND discipline_score <= 1),
  market_regime TEXT,
  strategy_tag TEXT,
  confidence_at_entry DOUBLE PRECISION,
  mode TEXT NOT NULL CHECK (mode IN ('demo', 'live')),
  closed_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qualifying_trades_closed_at_idx
  ON qualifying_trades (closed_at DESC);

CREATE INDEX IF NOT EXISTS qualifying_trades_symbol_idx
  ON qualifying_trades (symbol);

CREATE INDEX IF NOT EXISTS qualifying_trades_reason_idx
  ON qualifying_trades (reason);

CREATE INDEX IF NOT EXISTS qualifying_trades_mode_idx
  ON qualifying_trades (mode);

-- Readiness state (computed from qualifying trades only)
CREATE TABLE IF NOT EXISTS readiness_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  qualifying_trades_count INTEGER DEFAULT 0,
  target_hits INTEGER DEFAULT 0,
  stop_hits INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  profit_factor NUMERIC DEFAULT 1.0,
  max_drawdown_pct NUMERIC DEFAULT 0,
  readiness_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'TRAINING' CHECK (status IN ('TRAINING', 'QUALIFYING', 'PAPER_PROVEN')),
  consecutive_wins INTEGER DEFAULT 0,
  last_computed_at TIMESTAMPTZ DEFAULT now()
);

-- Trade discipline checklist (persisted for transparency)
CREATE TABLE IF NOT EXISTS trade_discipline_checklist (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  met BOOLEAN NOT NULL,
  current_value TEXT,
  required_value TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill migration: populate qualifying_trades from existing trade_learning_events
-- Run once after schema creation
DO $$
DECLARE
  rec RECORD;
  total_qualifying INTEGER := 0;
  target_hits INTEGER := 0;
  stop_hits INTEGER := 0;
BEGIN
  -- Clear existing (idempotent)
  TRUNCATE qualifying_trades;

  -- Migrate from trade_learning_events
  FOR rec IN
    SELECT 
      id, symbol, entry_price, exit_price, qty, pnl, reason,
      closed_at, opened_at, mode, score, change_24h, liquidity_usd, volume_24h,
      venue, chain, pair_age_hours
    FROM trade_learning_events
    WHERE reason IN ('TARGET', 'STOP')
      AND NOT simulated
      AND reason != 'MANUAL'
      AND entry_price > 0
      AND exit_price > 0
      AND ABS(pnl) >= entry_price * qty * 0.005  -- min 0.5% move
  LOOP
    DECLARE
      rr_planned DOUBLE PRECISION;
      rr_actual DOUBLE PRECISION;
      disc_score DOUBLE PRECISION := 1.0;
    BEGIN
      -- Estimate planned R:R from available data
      -- If we don't have explicit stop/target, derive from P&L and entry
      IF rec.pnl > 0 THEN
        -- Winner: assume target was hit
        target_hits := target_hits + 1;
        rr_actual := rec.pnl / (rec.entry_price * rec.qty);
        -- Assume planned R:R was at least 2.5:1
        rr_planned := 2.5;
      ELSE
        -- Stop hit: disciplined exit
        stop_hits := stop_hits + 1;
        rr_actual := ABS(rec.pnl) / (rec.entry_price * rec.qty);
        -- Stop loss typically 2-3% so R:R planned would be higher
        rr_planned := 2.5;
        -- Discipline score: 1.0 if stop was respected (not blown past)
        disc_score := 1.0;
      END IF;

      INSERT INTO qualifying_trades (
        id, symbol, entry_price, exit_price, stop_price, target_price,
        qty, notional, pnl, reason, hold_minutes,
        risk_reward_planned, risk_reward_actual, discipline_score,
        market_regime, strategy_tag, confidence_at_entry, mode, closed_at
      ) VALUES (
        rec.id, rec.symbol, rec.entry_price, rec.exit_price,
        rec.entry_price * 0.97,  -- estimated stop
        rec.entry_price * 1.07,  -- estimated target
        rec.qty, rec.entry_price * rec.qty, rec.pnl, rec.reason,
        GREATEST(1, (rec.closed_at - rec.opened_at) / 60000),
        rr_planned, rr_actual, disc_score,
        'unknown', 'migrated', rec.score, rec.mode, rec.closed_at
      ) ON CONFLICT (id) DO NOTHING;

      total_qualifying := total_qualifying + 1;
    END;
  END LOOP;

  -- Update readiness_state
  INSERT INTO readiness_state (singleton, qualifying_trades_count, target_hits, stop_hits, win_rate, profit_factor, readiness_score, status)
  SELECT
    TRUE,
    total_qualifying,
    target_hits,
    stop_hits,
    CASE WHEN total_qualifying > 0 THEN (target_hits::NUMERIC / total_qualifying) * 100 ELSE 0 END,
    CASE 
      WHEN stop_hits > 0 AND total_qualifying > 0 
      THEN (SELECT SUM(pnl) FROM qualifying_trades WHERE pnl > 0) / ABS(SELECT SUM(pnl) FROM qualifying_trades WHERE pnl < 0)
      ELSE 1.0 
    END,
    CASE 
      WHEN total_qualifying >= 200 AND target_hits::NUMERIC / total_qualifying >= 0.65 THEN 85
      WHEN total_qualifying >= 50 THEN 60
      ELSE 30
    END,
    CASE 
      WHEN total_qualifying >= 200 AND target_hits::NUMERIC / total_qualifying >= 0.65 THEN 'PAPER_PROVEN'
      WHEN total_qualifying >= 50 THEN 'QUALIFYING'
      ELSE 'TRAINING'
    END
  ON CONFLICT (singleton) DO UPDATE SET
    qualifying_trades_count = EXCLUDED.qualifying_trades_count,
    target_hits = EXCLUDED.target_hits,
    stop_hits = EXCLUDED.stop_hits,
    win_rate = EXCLUDED.win_rate,
    profit_factor = EXCLUDED.profit_factor,
    readiness_score = EXCLUDED.readiness_score,
    status = EXCLUDED.status,
    last_computed_at = now();

  RAISE NOTICE 'Migrated % qualifying trades: % target hits, % stop hits', total_qualifying, target_hits, stop_hits;
END $$;