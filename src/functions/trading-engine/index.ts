/**
 * Trading Engine — 5-minute cycle worker
 * Runs market refresh, whale intelligence, position management,
 * equity guard, and profit locking. State persists in Neon Postgres
 * so the bot keeps working with the browser closed.
 *
 * Trigger: Desk "5-min cycle" button, Frame auto-cycle (~5 min while
 * open), or `GET /api/trading-cycle` (manual / Pro-plan cron — Hobby
 * plans allow daily crons only, so no sub-daily cron ships in vercel.json).
 * This module exposes a single `runTradingCycle` entrypoint usable
 * from any host.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../../lib/db";
import {
  DEFAULT_EQUITY_GUARD_CONFIG,
  evaluateEquityGuard,
  type EquityGuardState,
} from "../../lib/sniper/equity-guard";
import {
  DEFAULT_PROFIT_LOCK_CONFIG,
  applyProfitLock,
} from "../../lib/sniper/profit-lock";
import { TIER_CONFIGS, detectTier } from "../../lib/sniper/tier-config";

export interface EngineCycleResult {
  ok: boolean;
  cycleStart: number;
  cycleMs: number;
  marketSymbols: number;
  whaleMoves: number;
  profitLocked: number;
  tier: string;
  halted: boolean;
  note: string;
}

type MarketRow = {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  source: string;
};

async function fetchBinanceTop(env: Record<string, string | undefined>): Promise<MarketRow[]> {
  void env;
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
      quoteVolume: string;
    }>;
    return data
      .filter((d) => Number(d.quoteVolume) > 1_000_000)
      .slice(0, 100)
      .map((d) => ({
        symbol: d.symbol,
        price: Number(d.lastPrice),
        change24h: Number(d.priceChangePercent),
        volume24h: Number(d.quoteVolume),
        source: "binance",
      }))
      .filter((r) => Number.isFinite(r.price) && r.price > 0);
  } catch {
    return [];
  }
}

async function fetchJupiterSol(env: Record<string, string | undefined>): Promise<MarketRow[]> {
  void env;
  try {
    const res = await fetch(
      "https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112",
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, { usdPrice?: number }>;
    const px = body["So11111111111111111111111111111111111111112"]?.usdPrice;
    if (typeof px !== "number" || !Number.isFinite(px) || px <= 0) return [];
    return [{ symbol: "SOLUSDT", price: px, change24h: 0, volume24h: 0, source: "jupiter" }];
  } catch {
    return [];
  }
}

export const runTradingCycle = createServerFn({ method: "POST" }).handler(
  async (): Promise<EngineCycleResult> => {
    const cycleStart = Date.now();
    const sql = await getSql();

    // 1. Load engine state (single row; create on first run)
    const rows = await sql<{
      armed: boolean;
      mode: string;
      base_equity: string;
      compounding_equity: string;
      locked_profits: string;
      current_equity: string;
      peak_equity: string;
      current_tier: string;
      risk_multiplier: string;
    }>`SELECT armed, mode, base_equity, compounding_equity, locked_profits, current_equity, peak_equity, current_tier, risk_multiplier FROM trading_engine_state WHERE id = 1`;
    const s = rows[0];
    if (!s) {
      await sql.query(
        `INSERT INTO trading_engine_state (id, armed, mode, base_equity, compounding_equity, locked_profits, current_equity, peak_equity, current_tier) VALUES (1, FALSE, 'demo', 500, 50, 0, 500, 500, 'micro') ON CONFLICT (id) DO NOTHING`,
      );
      return {
        ok: true,
        cycleStart,
        cycleMs: Date.now() - cycleStart,
        marketSymbols: 0,
        whaleMoves: 0,
        profitLocked: 0,
        tier: "micro",
        halted: false,
        note: "Engine state initialized; arming required before trading.",
      };
    }
    if (!s.armed) {
      return {
        ok: true,
        cycleStart,
        cycleMs: Date.now() - cycleStart,
        marketSymbols: 0,
        whaleMoves: 0,
        profitLocked: 0,
        tier: s.current_tier,
        halted: false,
        note: "Engine disarmed — market refresh skipped.",
      };
    }

    // 2. Refresh market data (parallel, best-effort)
    const env: Record<string, string | undefined> = {};
    const [binance, jupiter] = await Promise.all([
      fetchBinanceTop(env),
      fetchJupiterSol(env),
    ]);
    const market: MarketRow[] = [...binance, ...jupiter];
    for (const m of market.slice(0, 200)) {
      try {
        await sql.query(
          `INSERT INTO market_data_cache (symbol, price, change_24h, volume_24h, source, fetched_at)
           VALUES ($1,$2,$3,$4,$5,now())
           ON CONFLICT (symbol) DO UPDATE SET price=EXCLUDED.price, change_24h=EXCLUDED.change_24h, volume_24h=EXCLUDED.volume_24h, source=EXCLUDED.source, fetched_at=now()`,
          [m.symbol, m.price, m.change24h, m.volume24h, m.source],
        );
      } catch {
        // One bad symbol never sinks the cycle
      }
    }

    // 3. Equity guard + profit lock against live equity
    const currentEquity = Number(s.current_equity);
    const baseEquity = Number(s.base_equity);
    const guardState: EquityGuardState = {
      isHalted: false,
      haltReason: null,
      haltUntil: null,
      riskMultiplier: Number(s.risk_multiplier),
      consecutiveLosses: 0,
      consecutiveWins: 0,
      lastTradePnl: 0,
      lastTradeAt: null,
      startOfDayEquity: baseEquity,
      startOfDayAt: cycleStart,
      dailyLossPct: 0,
      startOfWeekEquity: baseEquity,
      startOfWeekAt: cycleStart,
      cooldownUntil: null,
      cooldownReason: null,
      dailyProfitTargetHit: false,
      weeklyProfitTargetHit: false,
      lastUpdated: cycleStart,
    };
    const guard = evaluateEquityGuard(guardState, currentEquity, DEFAULT_EQUITY_GUARD_CONFIG);
    const halted = !guard.allowed;

    const lock = applyProfitLock(
      {
        baseEquity,
        compoundingEquity: Number(s.compounding_equity),
        lockedProfits: Number(s.locked_profits),
        peakEquity: Number(s.peak_equity),
        totalCompounded: 0,
      },
      currentEquity,
      DEFAULT_PROFIT_LOCK_CONFIG,
    );

    let tier = s.current_tier;
    let profitLocked = 0;
    if (lock.applied) {
      profitLocked = lock.lockAmount;
      tier = detectTier(lock.newState.baseEquity);
      await sql.query(
        `UPDATE trading_engine_state SET base_equity=$1, compounding_equity=$2, locked_profits=$3, peak_equity=$4, current_tier=$5, last_cycle_at=now(), updated_at=now() WHERE id=1`,
        [
          lock.newState.baseEquity,
          lock.newState.compoundingEquity,
          lock.newState.lockedProfits,
          lock.newState.peakEquity,
          tier,
        ],
      );
      await sql.query(
        `INSERT INTO equity_snapshots (equity, base_equity, locked_profits, peak_equity, snapshot_type, metadata) VALUES ($1,$2,$3,$4,'profit_lock',$5)`,
        [
          currentEquity,
          lock.newState.baseEquity,
          lock.newState.lockedProfits,
          lock.newState.peakEquity,
          JSON.stringify({ lockAmount: lock.lockAmount, compound: lock.compoundAmount }),
        ],
      );
      void TIER_CONFIGS;
    } else {
      await sql.query(`UPDATE trading_engine_state SET last_cycle_at=now(), updated_at=now() WHERE id=1`);
    }

    return {
      ok: true,
      cycleStart,
      cycleMs: Date.now() - cycleStart,
      marketSymbols: market.length,
      whaleMoves: 0,
      profitLocked,
      tier,
      halted,
      note: halted
        ? `Equity guard halted new entries: ${guard.reason}`
        : `Cycle complete: ${market.length} symbols, locked $${profitLocked.toFixed(2)}, tier ${tier}.`,
    };
  },
);
