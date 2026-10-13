CREATE TABLE IF NOT EXISTS trade_learning_events (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  chain TEXT NOT NULL,
  venue TEXT NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  exit_price DOUBLE PRECISION NOT NULL,
  qty DOUBLE PRECISION NOT NULL,
  pnl DOUBLE PRECISION NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  change_24h DOUBLE PRECISION NOT NULL,
  liquidity_usd DOUBLE PRECISION NOT NULL,
  volume_24h DOUBLE PRECISION NOT NULL,
  pair_age_hours DOUBLE PRECISION,
  mode TEXT NOT NULL,
  reason TEXT NOT NULL,
  opened_at BIGINT NOT NULL,
  closed_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS trade_learning_events_closed_at_idx
  ON trade_learning_events (closed_at DESC);
CREATE INDEX IF NOT EXISTS trade_learning_events_symbol_idx
  ON trade_learning_events (symbol);

CREATE TABLE IF NOT EXISTS trade_learning_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  seen INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  realized DOUBLE PRECISION NOT NULL DEFAULT 0,
  min_score DOUBLE PRECISION NOT NULL DEFAULT 62
);

DO $$
BEGIN
  IF to_regclass('public.winning_trades') IS NOT NULL THEN
    INSERT INTO trade_learning_events (
      id, symbol, chain, venue, entry_price, exit_price, qty, pnl, score,
      change_24h, liquidity_usd, volume_24h, pair_age_hours, mode, reason,
      opened_at, closed_at
    )
    SELECT
      id, symbol, chain, venue, entry_price, exit_price, qty, pnl, score,
      0, 0, 0, NULL, mode, reason, closed_at, closed_at
    FROM public.winning_trades
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

INSERT INTO trade_learning_state (singleton, seen, wins, losses, realized, min_score)
SELECT
  TRUE,
  COUNT(*)::INTEGER,
  COUNT(*) FILTER (WHERE pnl > 0)::INTEGER,
  COUNT(*) FILTER (WHERE pnl < 0)::INTEGER,
  COALESCE(SUM(pnl), 0),
  62
FROM trade_learning_events
ON CONFLICT (singleton) DO NOTHING;
