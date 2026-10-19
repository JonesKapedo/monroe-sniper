/**
 * Hard, pure guardrails every live order must clear before it reaches a venue.
 * Kept side-effect free so the desk can pre-check in the browser for UX while
 * the server re-checks authoritatively inside `placeLiveOrder`.
 */

export type LiveGuardrailsConfig = {
  /** Max USD notional per order. */
  maxNotionalUsd: number;
  /** Stop all live entries once realized P&L today reaches -this. */
  dailyLossLimitUsd: number;
  /** Max concurrent open live positions. */
  maxOpenPositions: number;
  /** Uppercase symbols allowed for live entries; empty = allow any. */
  allowlist: string[];
};

export const DEFAULT_LIVE_GUARDRAILS: LiveGuardrailsConfig = {
  maxNotionalUsd: 100,
  dailyLossLimitUsd: 50,
  maxOpenPositions: 4,
  allowlist: [],
};

export type LiveGuardrailInput = {
  symbol: string;
  side: "buy" | "sell";
  notionalUsd: number;
  priceUsd: number;
  /** Realized P&L so far today in USD; negative = net loss. */
  realizedTodayUsd: number;
  /** Current number of open live positions. */
  openPositions: number;
};

export type LiveGuardrailCode =
  | "BAD_NOTIONAL"
  | "BAD_PRICE"
  | "NOTIONAL_CAP"
  | "NOT_ALLOWED"
  | "DAILY_LOSS"
  | "MAX_POSITIONS";

export type LiveGuardrailVerdict =
  | { allowed: true }
  | { allowed: false; code: LiveGuardrailCode; reason: string };

export function checkLiveGuardrails(
  cfg: LiveGuardrailsConfig,
  input: LiveGuardrailInput,
): LiveGuardrailVerdict {
  const symbol = input.symbol.trim().toUpperCase();
  if (!Number.isFinite(input.notionalUsd) || input.notionalUsd <= 0) {
    return { allowed: false, code: "BAD_NOTIONAL", reason: "Order notional must be a positive number." };
  }
  if (!Number.isFinite(input.priceUsd) || input.priceUsd <= 0) {
    return { allowed: false, code: "BAD_PRICE", reason: "Order price must be a positive number." };
  }
  if (input.notionalUsd > cfg.maxNotionalUsd) {
    return {
      allowed: false,
      code: "NOTIONAL_CAP",
      reason: `Notional $${input.notionalUsd.toFixed(2)} exceeds the live cap of $${cfg.maxNotionalUsd.toFixed(2)} per order.`,
    };
  }
  if (cfg.allowlist.length > 0 && !cfg.allowlist.map((s) => s.trim().toUpperCase()).includes(symbol)) {
    return { allowed: false, code: "NOT_ALLOWED", reason: `${symbol || "This symbol"} is not on the live trading allowlist.` };
  }
  if (input.realizedTodayUsd <= -cfg.dailyLossLimitUsd) {
    return {
      allowed: false,
      code: "DAILY_LOSS",
      reason: `Daily loss limit of $${cfg.dailyLossLimitUsd.toFixed(2)} reached; live entries halted.`,
    };
  }
  if (input.side === "buy" && input.openPositions >= cfg.maxOpenPositions) {
    return {
      allowed: false,
      code: "MAX_POSITIONS",
      reason: `Open live positions (${input.openPositions}) are at the cap of ${cfg.maxOpenPositions}.`,
    };
  }
  return { allowed: true };
}

/** Build guardrails from server env, falling back to the conservative defaults. */
export function liveGuardrailsFromEnv(env: Record<string, string | undefined>): LiveGuardrailsConfig {
  const num = (raw: string | undefined, fallback: number): number => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    maxNotionalUsd: num(env.SNIPER_LIVE_MAX_NOTIONAL_USD, DEFAULT_LIVE_GUARDRAILS.maxNotionalUsd),
    dailyLossLimitUsd: num(env.SNIPER_LIVE_DAILY_LOSS_USD, DEFAULT_LIVE_GUARDRAILS.dailyLossLimitUsd),
    maxOpenPositions: num(env.SNIPER_LIVE_MAX_POSITIONS, DEFAULT_LIVE_GUARDRAILS.maxOpenPositions),
    allowlist: (env.SNIPER_LIVE_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  };
}
