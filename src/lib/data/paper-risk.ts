import type { OpportunitySignal } from "./market-sources";

export const PAPER_STARTING_CASH = 500;
export const MAX_PAPER_POSITIONS = 3;
export const MAX_IDEA_EXPOSURE = 0.05;
export const MAX_PORTFOLIO_EXPOSURE = 0.15;
export const MIN_OPPORTUNITY_SCORE = 70;
export const MIN_LIQUIDITY_USD = 10_000;
export const MAX_QUOTE_AGE_MS = 60_000;
export const MAX_SECURITY_AGE_MS = 5 * 60_000;
export const HARD_REJECT_FLAGS = ["HONEYPOT", "LP-UNLOCKED", "MINT-AUTHORITY", "FREEZE-AUTHORITY", "HIGH-TAX"] as const;

export type ExitReason = "SCALE_OUT" | "STOP" | "TRAILING_STOP" | "TIME_STOP" | "LIQUIDITY_DROP" | "MANUAL";
export type GateCheck = { id: string; label: string; pass: boolean; detail: string };
export type RiskVerdict = {
  id: string; tokenId: string; symbol: string; score: number; allowed: boolean;
  decidedAt: number; plannedNotionalUsd: number; checks: GateCheck[];
};
export type PaperPosition = {
  id: string; tokenId: string; symbol: string; name: string; chain: string; address: string;
  qty: number; initialQty: number; entryPrice: number; currentPrice: number;
  stopPrice: number; scaleOutPrice: number; highWaterPrice: number; peakLiquidityUsd: number;
  initialNotionalUsd: number; realizedPnlUsd: number; openedAt: number; lastUpdatedAt: number;
  scaledOut: boolean; score: number;
};
export type PaperTrade = {
  id: string; tokenId: string; symbol: string; chain: string; address: string;
  qty: number; entryPrice: number; exitPrice: number; pnlUsd: number;
  reason: ExitReason; openedAt: number; closedAt: number; score: number; partial: boolean;
};
export type PaperPortfolio = {
  version: 1; cashUsd: number; positions: PaperPosition[];
  trades: PaperTrade[]; decisions: RiskVerdict[];
};
export type MarketUpdate = { tokenId: string; priceUsd: number | null; liquidityUsd: number | null; fetchedAt?: number };

function id(prefix: string, at: number): string {
  return `${prefix}-${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const hardRejected = (signal: OpportunitySignal) =>
  signal.flags.some(flag => (HARD_REJECT_FLAGS as readonly string[]).includes(flag));

export function createPaperPortfolio(cashUsd = PAPER_STARTING_CASH): PaperPortfolio {
  return { version: 1, cashUsd: Math.max(0, Number.isFinite(cashUsd) ? cashUsd : PAPER_STARTING_CASH), positions: [], trades: [], decisions: [] };
}
export function paperExposureUsd(portfolio: PaperPortfolio): number {
  return portfolio.positions.reduce((sum, p) => sum + p.qty * p.currentPrice, 0);
}
export function paperEquityUsd(portfolio: PaperPortfolio): number {
  return portfolio.cashUsd + paperExposureUsd(portfolio);
}
export function positionTokenId(position: Pick<PaperPosition, "chain" | "address">): string {
  return `${position.chain}:${position.address.toLowerCase()}`;
}
function appendDecision(portfolio: PaperPortfolio, verdict: RiskVerdict): PaperPortfolio {
  return { ...portfolio, decisions: [verdict, ...portfolio.decisions].slice(0, 150) };
}

export function evaluateRiskGate(signal: OpportunitySignal, portfolio: PaperPortfolio, now = Date.now()): RiskVerdict {
  const m = signal.metrics;
  const equity = paperEquityUsd(portfolio);
  const exposure = paperExposureUsd(portfolio);
  const quoteAge = now - m.fetchedAt;
  const securityAge = signal.security ? now - signal.security.checkedAt : Number.POSITIVE_INFINITY;
  const notional = Math.max(0, Math.min(equity * MAX_IDEA_EXPOSURE, portfolio.cashUsd, equity * MAX_PORTFOLIO_EXPOSURE - exposure));
  const sameToken = portfolio.positions.some(p => p.tokenId === signal.id);
  const report = signal.security;
  const securityClean = Boolean(
    signal.securityVerified && report?.verified === true &&
    report.honeypot === false && report.lpLocked === true &&
    report.ownerCanMint === false && report.ownerCanFreeze === false &&
    report.buyTax !== null && report.buyTax <= 0.15 &&
    report.sellTax !== null && report.sellTax <= 0.15
  );
  const checks: GateCheck[] = [
    { id: "score", label: "Composite score ≥ 70", pass: signal.score >= MIN_OPPORTUNITY_SCORE, detail: `${signal.score}/100; minimum ${MIN_OPPORTUNITY_SCORE}` },
    { id: "security", label: "Verified clean security", pass: securityClean, detail: securityClean ? "Both security sources returned a clean report" : "Missing, stale, incomplete, or adverse security report" },
    { id: "hard-reject", label: "No hard-reject flags", pass: !hardRejected(signal), detail: hardRejected(signal) ? signal.flags.filter(f => (HARD_REJECT_FLAGS as readonly string[]).includes(f)).join(", ") : "No hard-reject flags" },
    { id: "liquidity", label: "Liquidity ≥ $10,000", pass: (m.liquidityUsd ?? 0) >= MIN_LIQUIDITY_USD, detail: `${usd(m.liquidityUsd ?? 0)}; minimum ${usd(MIN_LIQUIDITY_USD)}` },
    { id: "quote", label: "Fresh, usable market quote", pass: m.priceUsd !== null && Number.isFinite(m.priceUsd) && m.priceUsd > 0 && quoteAge >= 0 && quoteAge <= MAX_QUOTE_AGE_MS, detail: m.priceUsd === null ? "No price" : `${usd(m.priceUsd)}; quote age ${Math.round(quoteAge / 1000)}s` },
    { id: "security-age", label: "Security check ≤ 5 minutes", pass: Boolean(report && securityAge >= 0 && securityAge <= MAX_SECURITY_AGE_MS), detail: report ? `Security evidence age ${Math.round(securityAge / 1000)}s` : "No security report" },
    { id: "slots", label: `Position slots available (max ${MAX_PAPER_POSITIONS})`, pass: portfolio.positions.length < MAX_PAPER_POSITIONS, detail: `${portfolio.positions.length}/${MAX_PAPER_POSITIONS} open` },
    { id: "duplicate", label: "No duplicate open position", pass: !sameToken, detail: sameToken ? "A demo position for this token is already open" : "No duplicate token position" },
    { id: "idea-budget", label: "Idea exposure ≤ 5% of equity", pass: equity > 0 && notional > 0 && notional <= equity * MAX_IDEA_EXPOSURE + 0.01, detail: `Planned notional ${usd(notional)}; equity ${usd(equity)}` },
    { id: "portfolio-budget", label: "Aggregate exposure ≤ 15% of equity", pass: equity > 0 && exposure + notional <= equity * MAX_PORTFOLIO_EXPOSURE + 0.01, detail: `Current ${usd(exposure)}; after trade ${usd(exposure + notional)}` },
    { id: "cash", label: "Demo cash available", pass: portfolio.cashUsd > 0 && notional > 0, detail: `${usd(portfolio.cashUsd)} available` },
  ];
  return {
    id: id("gate", now), tokenId: signal.id, symbol: signal.symbol, score: signal.score,
    allowed: checks.every(check => check.pass), decidedAt: now, plannedNotionalUsd: notional, checks,
  };
}

export function auditScan(portfolio: PaperPortfolio, signals: OpportunitySignal[], now = Date.now()): PaperPortfolio {
  const decisions = signals.map(signal => evaluateRiskGate(signal, portfolio, now));
  return { ...portfolio, decisions: [...decisions, ...portfolio.decisions].slice(0, 150) };
}

export function enterPaperPosition(
  portfolio: PaperPortfolio, signal: OpportunitySignal, now = Date.now(),
): { portfolio: PaperPortfolio; verdict: RiskVerdict; entered: boolean } {
  const verdict = evaluateRiskGate(signal, portfolio, now);
  let next = appendDecision(portfolio, verdict);
  if (!verdict.allowed || !signal.metrics.priceUsd || verdict.plannedNotionalUsd <= 0) {
    return { portfolio: next, verdict, entered: false };
  }
  const entry = signal.metrics.priceUsd;
  const qty = verdict.plannedNotionalUsd / entry;
  const position: PaperPosition = {
    id: id("paper", now), tokenId: signal.id, symbol: signal.symbol, name: signal.metrics.name,
    chain: signal.chain, address: signal.address, qty, initialQty: qty, entryPrice: entry, currentPrice: entry,
    stopPrice: entry * 0.92, scaleOutPrice: entry * 1.20, highWaterPrice: entry,
    peakLiquidityUsd: signal.metrics.liquidityUsd ?? 0, initialNotionalUsd: verdict.plannedNotionalUsd,
    realizedPnlUsd: 0, openedAt: now, lastUpdatedAt: now, scaledOut: false, score: signal.score,
  };
  next = { ...next, cashUsd: Math.max(0, next.cashUsd - verdict.plannedNotionalUsd), positions: [...next.positions, position] };
  return { portfolio: next, verdict, entered: true };
}

function recordTrade(position: PaperPosition, qty: number, price: number, reason: ExitReason, now: number, partial: boolean): PaperTrade {
  return {
    id: id("trade", now), tokenId: position.tokenId, symbol: position.symbol, chain: position.chain,
    address: position.address, qty, entryPrice: position.entryPrice, exitPrice: price,
    pnlUsd: (price - position.entryPrice) * qty, reason, openedAt: position.openedAt,
    closedAt: now, score: position.score, partial,
  };
}
function closePosition(portfolio: PaperPortfolio, position: PaperPosition, price: number, reason: ExitReason, now: number): PaperPortfolio {
  const trade = recordTrade(position, position.qty, price, reason, now, false);
  return {
    ...portfolio, cashUsd: portfolio.cashUsd + position.qty * price,
    positions: portfolio.positions.filter(p => p.id !== position.id),
    trades: [trade, ...portfolio.trades].slice(0, 250),
  };
}

/** Apply fresh market marks and the guide's hard stop, scale-out, trailing, time and liquidity exits. */
export function applyPaperMarketUpdates(portfolio: PaperPortfolio, updates: MarketUpdate[], now = Date.now()): PaperPortfolio {
  const byToken = new Map<string, MarketUpdate>(updates.map(update => [update.tokenId, update] as const));
  let next = portfolio;
  for (const original of [...portfolio.positions]) {
    let position = next.positions.find(p => p.id === original.id);
    if (!position) continue;
    const update = byToken.get(position.tokenId);
    const quoteFresh = Boolean(update && update.fetchedAt !== undefined && now - update.fetchedAt >= 0 && now - update.fetchedAt <= MAX_QUOTE_AGE_MS);
    const updatedPrice = update?.priceUsd;
    const price = quoteFresh && typeof updatedPrice === "number" && Number.isFinite(updatedPrice) && updatedPrice > 0
      ? updatedPrice : position.currentPrice;
    const updatedLiquidity = update?.liquidityUsd;
    const liquidity = quoteFresh && typeof updatedLiquidity === "number" && updatedLiquidity > 0
      ? updatedLiquidity : position.peakLiquidityUsd;
    const highWater = Math.max(position.highWaterPrice, price);
    const peakLiquidity = Math.max(position.peakLiquidityUsd, liquidity);
    position = { ...position, currentPrice: price, highWaterPrice: highWater, peakLiquidityUsd: peakLiquidity, lastUpdatedAt: quoteFresh ? now : position.lastUpdatedAt };
    next = { ...next, positions: next.positions.map(p => p.id === position?.id ? position! : p) };

    let reason: ExitReason | null = null;
    if (now - position.openedAt >= 6 * 60 * 60 * 1000) reason = "TIME_STOP";
    else if (peakLiquidity > 0 && liquidity < peakLiquidity * 0.70) reason = "LIQUIDITY_DROP";
    else if (price <= position.stopPrice) reason = "STOP";
    if (reason) {
      next = closePosition(next, position, price, reason, now);
      continue;
    }

    if (!position.scaledOut && price >= position.scaleOutPrice) {
      const sellQty = position.qty * 0.5;
      const trade = recordTrade(position, sellQty, price, "SCALE_OUT", now, true);
      const remaining = { ...position, qty: position.qty - sellQty, scaledOut: true, realizedPnlUsd: position.realizedPnlUsd + trade.pnlUsd };
      next = {
        ...next, cashUsd: next.cashUsd + sellQty * price,
        positions: next.positions.map(p => p.id === position!.id ? remaining : p),
        trades: [trade, ...next.trades].slice(0, 250),
      };
      position = remaining;
    }
    if (position.scaledOut && price <= position.highWaterPrice * 0.90) {
      next = closePosition(next, position, price, "TRAILING_STOP", now);
    }
  }
  return next;
}

export function closePaperPosition(portfolio: PaperPortfolio, positionId: string, now = Date.now()): PaperPortfolio {
  const position = portfolio.positions.find(p => p.id === positionId);
  return position ? closePosition(portfolio, position, position.currentPrice, "MANUAL", now) : portfolio;
}

export function resetPaperPortfolio(): PaperPortfolio { return createPaperPortfolio(); }

export function gateStatusText(verdict: RiskVerdict): string {
  const failed = verdict.checks.filter(check => !check.pass).map(check => check.label);
  return verdict.allowed ? "All risk gates passed; eligible for simulated execution only." : `Blocked by ${failed.length} gate(s): ${failed.join(", ")}.`;
}
