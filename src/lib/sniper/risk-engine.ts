import type { Book, Candidate } from "../paper";
import { equity, exposure } from "../paper";
import { auditAcademicSafeguards } from "./investopedia-mistakes-guard";
import { fibExtensions, snapToFib } from "../math/fib";
import { isCorrelatedDuplicate, setupVector, winnerResemblance, type SetupVector } from "../math/vectors";

export type SizingModel = "VOLATILITY_PARITY" | "FRACTIONAL_KELLY" | "FIXED_FRACTION";
export type SizingProfile = "CONSERVATIVE" | "OPTIMUM_SWEET_SPOT" | "AGGRESSIVE" | "TURBO";
export type VolatilityRegime = "LOW" | "NORMAL" | "ELEVATED" | "EXTREME";

/** Optional geometric overlays — absent means classic evaluation. */
export type RiskMathOverlays = {
  /** Feature vectors of past winning closes for resemblance scoring. */
  winnerVectors?: SetupVector[];
  /** Feature vectors of open positions for the correlation guard. */
  openVectors?: SetupVector[];
};

export type RiskEngineSettings = {
  sizingModel: SizingModel;
  sizingProfile: SizingProfile;
  riskPerTrade: number; // Fraction, e.g. 0.025 (2.5% risk of equity per trade)
  atrMultiplier: number; // e.g. 1.8 to 3.0x ATR for stop placement
  rewardMultiple: number; // e.g. 2.5x to 4.0x R:R ratio
  maxPositions: number; // e.g. 3-4
  maxBookExposure: number; // e.g. 0.75 (75% equity cap)
  maxIdeaExposure: number; // e.g. 0.28 (28% equity cap per trade)
  maxDrawdownBreaker: number; // e.g. 0.08 (8% max drawdown before halt)
  minLiquidity: number; // e.g. $10,000
  minTicket: number; // e.g. $15.00
  maxSlippageBps: number; // e.g. 40 bps
  maxPerChain: number; // e.g. max 2 positions in same chain
  useTrailingStop: boolean;
  dynamicCompounding: boolean;
};

export const defaultRiskSettings: RiskEngineSettings = {
  sizingModel: "VOLATILITY_PARITY",
  sizingProfile: "OPTIMUM_SWEET_SPOT",
  riskPerTrade: 0.025,
  atrMultiplier: 2.0,
  rewardMultiple: 3.0,
  maxPositions: 4,
  maxBookExposure: 0.75,
  maxIdeaExposure: 0.28,
  maxDrawdownBreaker: 0.08,
  minLiquidity: 10_000,
  minTicket: 15.0,
  maxSlippageBps: 40,
  maxPerChain: 2,
  useTrailingStop: true,
  dynamicCompounding: true,
};

export type RiskCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

export type SizingVerdict = {
  allowed: boolean;
  notional: number;
  qty: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  stopLossPct: number;
  takeProfitPct: number;
  riskRewardRatio: number;
  atr: number;
  volatility: number;
  volatilityRegime: VolatilityRegime;
  riskAmount: number;
  valueAtRisk95: number;
  checks: RiskCheck[];
  reasons: string[];
};

/**
 * Estimates real-time volatility based on candidate's 24h price swing,
 * venue characteristics, and liquidity-to-volume ratio.
 */
export function estimateVolatility(c: Candidate): {
  volatility: number;
  atr: number;
  regime: VolatilityRegime;
} {
  const absChange = Math.abs(c.change24h || 0) / 100;
  let baseVol = 0.035; // Default 3.5% daily volatility

  if (c.venue === "binance") {
    // Large cap / CEX pairs: standard volatility baseline
    baseVol = Math.max(0.015, Math.min(0.08, 0.02 + absChange * 0.4));
  } else {
    // On-chain DEX pairs: higher dispersion and liquidity tail risks
    const liqRatio = c.liquidityUsd > 0 ? c.volume24h / c.liquidityUsd : 1;
    baseVol = Math.max(0.04, Math.min(0.25, 0.05 + absChange * 0.6 + Math.min(0.08, liqRatio * 0.02)));
  }

  // ATR estimate over 1-day normalized to current price
  const atr = c.priceUsd * baseVol;

  let regime: VolatilityRegime = "NORMAL";
  if (baseVol < 0.025) regime = "LOW";
  else if (baseVol < 0.06) regime = "NORMAL";
  else if (baseVol < 0.12) regime = "ELEVATED";
  else regime = "EXTREME";

  return { volatility: baseVol, atr, regime };
}

/**
 * Core Quantitative Risk Engine
 * Calculates real-time position sizing based on market volatility and current portfolio balance.
 * Functions IDENTICALLY in both Live and Demo/Paper modes by accepting the active Book.
 */
export function evaluateRiskAndSize(
  book: Book,
  candidate: Candidate,
  settings: RiskEngineSettings = defaultRiskSettings,
  minScore = 62,
  now = Date.now(),
  math?: RiskMathOverlays,
): SizingVerdict {
  const checks: RiskCheck[] = [];
  const reasons: string[] = [];

  const currentEquity = equity(book);
  const currentExposure = exposure(book);
  const peak = Math.max(book.peakEquity, currentEquity);
  const drawdown = peak > 0 ? (peak - currentEquity) / peak : 0;
  const isDuplicate = book.positions.some((p) => p.tokenId === candidate.id);
  const cooling = book.cooldownUntil !== null && now < book.cooldownUntil;

  // 1. Estimate asset-specific volatility and ATR
  const { volatility, atr, regime } = estimateVolatility(candidate);

  // 2. Calculate volatility-adjusted Stop Loss & Take Profit
  // Dynamic Stop distance: ATR * atrMultiplier, clamped between 2% and 12%
  const calculatedStopPct = Math.max(
    0.02,
    Math.min(0.12, (atr * settings.atrMultiplier) / candidate.priceUsd),
  );
  const calculatedTargetPct = Math.max(
    0.04,
    calculatedStopPct * settings.rewardMultiple,
  );
  const rrRatio = calculatedTargetPct / calculatedStopPct;

  const entryPrice = candidate.priceUsd;
  let stopPrice = entryPrice * (1 - calculatedStopPct);
  let targetPrice = entryPrice * (1 + calculatedTargetPct);

  // Turbo brackets snap to Fibonacci geometry: stops sit on the nearest
  // retracement of the ±2ATR swing and targets extend 1.618× stop distance.
  let fibNote: string | null = null;
  if (settings.sizingProfile === "TURBO") {
    const swingHigh = entryPrice * (1 + 2 * calculatedStopPct);
    const swingLow = Math.max(0.000001, entryPrice * (1 - 2 * calculatedStopPct));
    const snappedStop = snapToFib(stopPrice, swingHigh, swingLow);
    if (snappedStop !== stopPrice) {
      stopPrice = snappedStop;
      fibNote = "Stop snapped to fib retracement";
    }
    const stopDistance = Math.max(0.000001, entryPrice - stopPrice);
    const fibTarget = fibExtensions(entryPrice, stopDistance)[1]?.price ?? targetPrice;
    if (fibTarget > targetPrice) {
      targetPrice = fibTarget;
      fibNote = fibNote ? `${fibNote} · target at 1.618 extension` : "Target at 1.618 extension";
    }
  }

  // 3. Position Sizing based on selected model & Dynamic Sweet Spot Allocation
  const candidateVector = setupVector({
    change24h: candidate.change24h,
    volume24h: candidate.volume24h,
    liquidityUsd: candidate.liquidityUsd,
    score: candidate.score,
  });
  // Winner resemblance tunes conviction: proven shapes size up slightly,
  // alien shapes size down — never a veto, never a pass.
  const resemblance = winnerResemblance(candidateVector, math?.winnerVectors ?? []);
  const conviction = Math.min(1.35, Math.max(0.65, (candidate.score / 75) * (0.9 + 0.2 * resemblance)));
  const openSlots = Math.max(1, settings.maxPositions - book.positions.length);
  const cashPerSlot = book.cash / openSlots;

  // Dynamic max idea ceiling tuned to optimum compounding corridor
  const profileMaxIdea =
    settings.sizingProfile === "TURBO" ? 0.45 :
    settings.sizingProfile === "AGGRESSIVE" ? 0.35 :
    settings.sizingProfile === "CONSERVATIVE" ? 0.18 : 0.28;
  const maxIdeaCash = Math.max(
    currentEquity <= 250 ? Math.min(book.cash, 35) : 0,
    currentEquity * profileMaxIdea * conviction,
  );
  const maxBookExposure =
    settings.sizingProfile === "TURBO" ? 0.9 :
    settings.sizingProfile === "AGGRESSIVE" ? 0.85 :
    settings.sizingProfile === "CONSERVATIVE" ? 0.50 : 0.75;
  const bookCapRemaining = Math.max(0, currentEquity * maxBookExposure - currentExposure);

  let rawSize = 0;

  if (settings.sizingModel === "VOLATILITY_PARITY") {
    // Risk exactly `riskPerTrade` of equity if stop loss is hit
    const riskFraction =
      settings.sizingProfile === "TURBO" ? 0.05 :
      settings.sizingProfile === "AGGRESSIVE" ? 0.035 :
      settings.sizingProfile === "CONSERVATIVE" ? 0.015 : settings.riskPerTrade;
    const dollarRiskBudget = Math.max(
      currentEquity <= 250 ? 1.5 : 0,
      currentEquity * riskFraction * conviction,
    );
    rawSize = dollarRiskBudget / calculatedStopPct;
  } else if (settings.sizingModel === "FRACTIONAL_KELLY") {
    // Half/Quarter Kelly based on candidate score as win probability proxy
    const winProb = Math.min(0.85, Math.max(0.48, candidate.score / 100));
    const lossProb = 1 - winProb;
    const b = settings.rewardMultiple; // payoff ratio
    const fullKelly = (winProb * b - lossProb) / b;
    const quarterKelly = Math.max(0.08, Math.min(0.32, fullKelly * 0.25 * conviction));
    rawSize = currentEquity * quarterKelly;
  } else {
    // Fixed fraction with conviction scaling
    rawSize = currentEquity * settings.riskPerTrade * 5 * conviction;
  }

  // Ensure minimum viable sizing on small balances so user is not starved in micro pennies
  if (currentEquity <= 250 && book.cash >= 25) {
    rawSize = Math.max(rawSize, Math.min(35, book.cash));
  }

  // Apply binding risk ceilings
  const bindingNotional = Math.max(
    0,
    Math.min(rawSize, maxIdeaCash, cashPerSlot, bookCapRemaining, book.cash),
  );

  const roundedNotional = Math.round(bindingNotional * 100) / 100;
  const qty = roundedNotional > 0 && entryPrice > 0 ? roundedNotional / entryPrice : 0;

  // 95% 1-day Value at Risk (parametric normal VaR = 1.645 * volatility * notional)
  const valueAtRisk95 = Math.round(roundedNotional * volatility * 1.645 * 100) / 100;

  // 4. Academic & Professional Safeguards Audit (Investopedia, ResearchGate, Binance, AML Watcher)
  const academicAudit = auditAcademicSafeguards(candidate, roundedNotional, currentEquity);
  academicAudit.audits.forEach((audit) => {
    checks.push({
      id: audit.rule.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 24),
      label: audit.rule,
      pass: audit.passed,
      detail: `${audit.source}: ${audit.metric}`,
    });
    if (!audit.passed) {
      reasons.push(`[${audit.source}] ${audit.description}`);
    }
  });

  // 5. Portfolio Level Gate Verifications
  // Gate: Kill Switch
  checks.push({
    id: "kill",
    label: "Kill switch inactive",
    pass: !book.kill,
    detail: book.kill ? (book.killReason ?? "Halted") : "Armed",
  });
  if (book.kill) reasons.push("Portfolio kill switch is active");

  // Gate: Cooldown
  checks.push({
    id: "cooldown",
    label: "Consecutive loss cooldown",
    pass: !cooling,
    detail: cooling ? "Cooling down" : "Clear",
  });
  if (cooling) reasons.push("Waiting out loss cooldown period");

  // Gate: Max Drawdown Circuit Breaker
  const ddPass = drawdown <= settings.maxDrawdownBreaker;
  checks.push({
    id: "drawdown",
    label: `Max drawdown breaker (<${(settings.maxDrawdownBreaker * 100).toFixed(0)}%)`,
    pass: ddPass,
    detail: `Current drawdown ${(drawdown * 100).toFixed(1)}%`,
  });
  if (!ddPass) reasons.push(`Portfolio drawdown ${(drawdown * 100).toFixed(1)}% breached safety limit`);

  // Gate: Open Slots
  const slotPass = book.positions.length < settings.maxPositions;
  checks.push({
    id: "slots",
    label: `Max positions (${settings.maxPositions})`,
    pass: slotPass,
    detail: `${book.positions.length}/${settings.maxPositions} held`,
  });
  if (!slotPass) reasons.push("Maximum concurrent positions reached");

  // Gate: Duplicate check
  checks.push({
    id: "dup",
    label: "Not already held",
    pass: !isDuplicate,
    detail: isDuplicate ? "Held" : "New entry",
  });
  if (isDuplicate) reasons.push("Candidate asset is already held in book");

  // Gate: Chain Concentration
  const chainCount = book.positions.filter((p) => p.chain === candidate.chain).length;
  const chainPass = chainCount < settings.maxPerChain;
  checks.push({
    id: "chain",
    label: `Chain concentration (<${settings.maxPerChain})`,
    pass: chainPass,
    detail: `${chainCount}/${settings.maxPerChain} in ${candidate.chain}`,
  });
  if (!chainPass) reasons.push(`Too many open positions in ${candidate.chain}`);

  // Gate: Score Floor
  const scorePass = candidate.score >= minScore;
  checks.push({
    id: "score",
    label: `Adaptive score floor (≥${minScore})`,
    pass: scorePass,
    detail: `${candidate.score}/100`,
  });
  if (!scorePass) reasons.push(`Score ${candidate.score} below adaptive floor ${minScore}`);

  // Geometric overlays (informational unless stated)
  checks.push({
    id: "fib-geometry",
    label: "Fib bracket geometry",
    pass: true,
    detail: fibNote ?? (settings.sizingProfile === "TURBO" ? "Raw ATR brackets (no level within snap)" : "Classic ATR brackets"),
  });
  checks.push({
    id: "winner-resemblance",
    label: "Resembles past winners",
    pass: true,
    detail: `${Math.round(resemblance * 100)}% vector similarity over ${math?.winnerVectors?.length ?? 0} wins`,
  });
  if (math?.openVectors && math.openVectors.length > 0) {
    const stacked = isCorrelatedDuplicate(candidateVector, math.openVectors);
    checks.push({
      id: "correlation",
      label: "Uncorrelated with open risk",
      pass: !stacked,
      detail: stacked ? "Near-duplicate of an open position" : "Distinct market character",
    });
    if (stacked) reasons.push("Candidate duplicates the character of an open position");
  }

  // Gate: Minimum Liquidity
  const liqPass = candidate.liquidityUsd >= settings.minLiquidity;
  checks.push({
    id: "liq",
    label: `Pool liquidity (≥$${(settings.minLiquidity / 1000).toFixed(0)}k)`,
    pass: liqPass,
    detail: `$${Math.round(candidate.liquidityUsd).toLocaleString()}`,
  });
  if (!liqPass) reasons.push(`Liquidity $${Math.round(candidate.liquidityUsd)} is below safe threshold`);

  // Gate: Cash and Ticket Floor
  const effectiveMinTicket = currentEquity <= 250 ? Math.min(25, book.cash) : settings.minTicket;
  const cashPass = roundedNotional >= effectiveMinTicket && roundedNotional <= book.cash;
  checks.push({
    id: "ticket",
    label: `Ticket size allows execution (≥$${effectiveMinTicket.toFixed(0)})`,
    pass: cashPass,
    detail: `Sized $${roundedNotional.toFixed(2)} (Cash: $${book.cash.toFixed(2)})`,
  });
  if (!cashPass) reasons.push(`Calculated ticket $${roundedNotional.toFixed(2)} below minimum viable size`);

  const allowed = checks.every((c) => c.pass);

  const finalStopPct = entryPrice > 0 ? Math.max(0, (entryPrice - stopPrice) / entryPrice) : calculatedStopPct;
  const finalTargetPct = entryPrice > 0 ? Math.max(0, (targetPrice - entryPrice) / entryPrice) : calculatedTargetPct;

  return {
    allowed,
    notional: allowed ? roundedNotional : 0,
    qty: allowed ? qty : 0,
    entryPrice,
    stopPrice,
    targetPrice,
    stopLossPct: finalStopPct,
    takeProfitPct: finalTargetPct,
    riskRewardRatio: Math.round(((finalStopPct > 0 ? finalTargetPct / finalStopPct : rrRatio) ) * 10) / 10,
    riskAmount: Math.round(roundedNotional * finalStopPct * 100) / 100,
    atr: Math.round(atr * 10000) / 10000,
    volatility: Math.round(volatility * 1000) / 10, // In percent
    volatilityRegime: regime,
    valueAtRisk95,
    checks,
    reasons,
  };
}
