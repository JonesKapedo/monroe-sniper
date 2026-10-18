import type { Book, Candidate } from "../paper";
import { equity, exposure } from "../paper";
import { auditAcademicSafeguards } from "./investopedia-mistakes-guard";
import { fibExtensions, snapToFib } from "../math/fib";
import { isCorrelatedDuplicate, setupVector, winnerResemblance, type SetupVector } from "../math/vectors";
import { MODELS, selectModel, type RiskModelProfile } from "./risk-models";
import { TIER_CONFIGS, applyStakeBudget, detectTier } from "./tier-config";
import { resolveConcurrentSlots, viableConcurrentSlots } from "./slots";

export type SizingModel = "VOLATILITY_PARITY" | "FRACTIONAL_KELLY" | "FIXED_FRACTION";
export type SizingProfile = "CONSERVATIVE" | "OPTIMUM_SWEET_SPOT" | "AGGRESSIVE" | "TURBO" | "[paranoid]" | "[elvis]" | "gradient" | "[degen]";
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
  riskPerTrade: number;
  atrMultiplier: number;
  rewardMultiple: number;
  maxPositions: number;
  maxBookExposure: number;
  maxIdeaExposure: number;
  maxDrawdownBreaker: number;
  minLiquidity: number;
  minTicket: number;
  maxSlippageBps: number;
  maxPerChain: number;
  useTrailingStop: boolean;
  dynamicCompounding: boolean;
  blockStablecoins: boolean;
};

export const defaultRiskSettings: RiskEngineSettings = {
  sizingModel: "VOLATILITY_PARITY",
  sizingProfile: "OPTIMUM_SWEET_SPOT",
  riskPerTrade: 0.025,
  atrMultiplier: 2.0,
  rewardMultiple: 3.0,
  maxPositions: 6,
  maxBookExposure: 0.75,
  maxIdeaExposure: 0.28,
  maxDrawdownBreaker: 0.08,
  minLiquidity: 5_000,
  minTicket: 10.0,
  maxSlippageBps: 40,
  maxPerChain: 3,
  useTrailingStop: true,
  dynamicCompounding: true,
  blockStablecoins: true,
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

export function estimateVolatility(c: Candidate): {
  volatility: number;
  atr: number;
  regime: VolatilityRegime;
} {
  const absChange = Math.abs(c.change24h || 0) / 100;
  let baseVol = 0.035;
  if (c.venue === "binance" || c.venue === "hyperliquid") {
    baseVol = Math.max(0.015, Math.min(0.08, 0.02 + absChange * 0.4));
  } else {
    const liqRatio = c.liquidityUsd > 0 ? c.volume24h / c.liquidityUsd : 1;
    baseVol = Math.max(0.04, Math.min(0.25, 0.05 + absChange * 0.6 + Math.min(0.08, liqRatio * 0.02)));
  }
  const atr = c.priceUsd * baseVol;
  let regime: VolatilityRegime = "NORMAL";
  if (baseVol < 0.025) regime = "LOW";
  else if (baseVol < 0.06) regime = "NORMAL";
  else if (baseVol < 0.12) regime = "ELEVATED";
  else regime = "EXTREME";
  return { volatility: baseVol, atr, regime };
}

export function evaluateRiskAndSize(
  book: Book,
  candidate: Candidate,
  settings: RiskEngineSettings = defaultRiskSettings,
  minScore = 52,
  now = Date.now(),
  math?: RiskMathOverlays,
  modelId: RiskModelProfile["id"] = "gradient",
  /** Equity-guard risk multiplier (0-1): scales the dollar risk budget before all caps. */
  riskMultiplier = 1.0,
): SizingVerdict {
  const profile: RiskModelProfile =
    selectModel(modelId) ?? selectModel("gradient") ?? MODELS["gradient"];
  const convictionForModel = (gradientEdge: number, seen: number): number => {
    const clamped = Math.max(-1, Math.min(1, gradientEdge / 12));
    const confidence = Math.min(1, seen / profile.confidenceRamp);
    return 1.0 + clamped * profile.convictionScale * confidence;
  };
  const checks: RiskCheck[] = [];
  const reasons: string[] = [];
  const currentEquity = equity(book);
  const currentExposure = exposure(book);
  const peak = Math.max(book.peakEquity, currentEquity);
  const drawdown = peak > 0 ? (peak - currentEquity) / peak : 0;
  const dailyLossLimit =
    profile.id === "[degen]" ? 0.15 : profile.id === "[elvis]" ? 0.1 : 0.08;
  // Settings are the sole concurrent-slot authority, but a small book cannot
  // viably carry the full count: cap slots so each ticket clears the fee floor.
  const stakeTierForSlots = TIER_CONFIGS[detectTier(currentEquity)];
  const maxSlots = viableConcurrentSlots(
    resolveConcurrentSlots(settings.maxPositions),
    currentEquity * stakeTierForSlots.maxPortfolioExposure,
  );
  const isDuplicate = book.positions.some((p) => p.tokenId === candidate.id);
  const cooling = book.cooldownUntil !== null && now < book.cooldownUntil;
  const { volatility, atr, regime } = estimateVolatility(candidate);
  const failVerdict = (id: string, label: string, detail: string, reason: string): SizingVerdict => ({
    allowed: false, notional: 0, qty: 0, entryPrice: candidate.priceUsd, stopPrice: candidate.priceUsd,
    targetPrice: candidate.priceUsd, stopLossPct: 0, takeProfitPct: 0, riskRewardRatio: 0, atr, volatility,
    volatilityRegime: regime, riskAmount: 0, valueAtRisk95: 0,
    checks: [{ id, label, pass: false, detail }], reasons: [reason],
  });
  const STABLE_BASES = new Set(["USDT","USDC","DAI","FDUSD","TUSD","USDE","PYUSD","GUSD","USDD","LUSD","FRAX","SUSD"]);
  const tradeBase = candidate.symbol.toUpperCase().split(/[/:_\- ]/)[0].replace(/USDT$|USDC$|USD$/, "");
  if (settings.blockStablecoins && (STABLE_BASES.has(tradeBase) || STABLE_BASES.has(candidate.symbol.toUpperCase().split(/[/:_\- ]/)[0]))) {
    return failVerdict("stablecoin", "Stablecoins carry no tradable edge", `${candidate.symbol} is a pegged stable — excluded from entries`, "stablecoin-no-edge");
  }
  const peakForDaily = book.peakEquity > 0 ? book.peakEquity : currentEquity;
  const dailyPnL = peakForDaily > 0 ? (peakForDaily - currentEquity) / peakForDaily : 0;
  if (dailyPnL > dailyLossLimit) {
    return failVerdict("circuit-breaker", "Daily loss circuit breaker", `Daily loss ${(dailyPnL * 100).toFixed(1)}% > ${(dailyLossLimit * 100).toFixed(0)}% (${profile.id})`, `daily-loss-exceeds-${profile.id}`);
  }
  if (book.positions.length >= maxSlots) {
    return failVerdict("max-positions", `Max positions (${maxSlots})`, `${book.positions.length}/${maxSlots} held`, `max-positions-reached-${maxSlots}`);
  }
  const effectiveEdge = Math.max(-1, Math.min(1, (candidate.score - 50) / 50));
  if (effectiveEdge < profile.minEdge) {
    return { allowed: false, notional: 0, qty: 0, entryPrice: candidate.priceUsd, stopPrice: candidate.priceUsd, targetPrice: candidate.priceUsd, stopLossPct: 0, takeProfitPct: 0, riskRewardRatio: 0, atr, volatility, volatilityRegime: regime, riskAmount: 0, valueAtRisk95: 0, checks: [], reasons: [`edge-below-${profile.id}`] };
  }
  const calculatedStopPct = Math.max(0.02, Math.min(0.12, (atr * settings.atrMultiplier) / candidate.priceUsd));
  const calculatedTargetPct = Math.max(0.04, calculatedStopPct * settings.rewardMultiple);
  const rrRatio = calculatedTargetPct / calculatedStopPct;
  const entryPrice = candidate.priceUsd;
  let stopPrice = entryPrice * (1 - calculatedStopPct);
  let targetPrice = entryPrice * (1 + calculatedTargetPct);
  let fibNote: string | null = null;
  if (settings.sizingProfile === "TURBO") {
    const swingHigh = entryPrice * (1 + 2 * calculatedStopPct);
    const swingLow = Math.max(0.000001, entryPrice * (1 - 2 * calculatedStopPct));
    const snappedStop = snapToFib(stopPrice, swingHigh, swingLow);
    if (snappedStop !== stopPrice) { stopPrice = snappedStop; fibNote = "Stop snapped to fib retracement"; }
    const stopDistance = Math.max(0.000001, entryPrice - stopPrice);
    const fibTarget = fibExtensions(entryPrice, stopDistance)[1]?.price ?? targetPrice;
    if (fibTarget > targetPrice) { targetPrice = fibTarget; fibNote = fibNote ? `${fibNote} · target at 1.618 extension` : "Target at 1.618 extension"; }
  }
  const candidateVector = setupVector({ change24h: candidate.change24h, volume24h: candidate.volume24h, liquidityUsd: candidate.liquidityUsd, score: candidate.score });
  const resemblance = winnerResemblance(candidateVector, math?.winnerVectors ?? []);
  const rawConviction = Math.min(1.35, Math.max(0.65, (candidate.score / 75) * (0.9 + 0.2 * resemblance)));
  const modelConviction = convictionForModel(effectiveEdge * 12, 20);
  const conviction = Math.min(1.35, Math.max(0.65, rawConviction * modelConviction));
  // maxSlots already from Settings (fee-viability capped above)
  const openSlots = Math.max(1, maxSlots - book.positions.length);
  const cashPerSlot = book.cash / openSlots;
  const stakeBudgetTotalPreview = Math.round(currentEquity * stakeTierForSlots.maxPortfolioExposure * 100) / 100;
  const stakeRemainingPreview = Math.max(0, stakeBudgetTotalPreview - currentExposure);
  const stakePerSlot = stakeRemainingPreview / openSlots;
  const profileMaxIdea = profile.id === "[degen]" ? 0.55 : profile.id === "[elvis]" ? 0.40 : profile.id === "[paranoid]" ? 0.15 : 0.30;
  const maxIdeaCash = Math.max(currentEquity <= 250 ? Math.min(book.cash, 35) : 0, currentEquity * profileMaxIdea * conviction);
  const maxBookExposure = profile.id === "[degen]" ? 0.85 : profile.id === "[elvis]" ? 0.70 : profile.id === "[paranoid]" ? 0.40 : 0.65;
  const bookCapRemaining = Math.max(0, currentEquity * maxBookExposure - currentExposure);
  let rawSize = 0;
  if (settings.sizingModel === "VOLATILITY_PARITY") {
    const riskFraction = profile.id === "[degen]" ? 0.05 : profile.id === "[elvis]" ? 0.035 : profile.id === "[paranoid]" ? 0.015 : settings.riskPerTrade;
    const guardMult = Math.max(0, Math.min(1, riskMultiplier));
    const dollarRiskBudget = Math.max(currentEquity <= 250 ? 1.5 : 0, currentEquity * riskFraction * conviction) * guardMult;
    rawSize = dollarRiskBudget / calculatedStopPct;
  } else if (settings.sizingModel === "FRACTIONAL_KELLY") {
    const winProb = Math.min(0.85, Math.max(0.48, candidate.score / 100));
    const lossProb = 1 - winProb;
    const b = settings.rewardMultiple;
    const fullKelly = (winProb * b - lossProb) / b;
    const quarterKelly = Math.max(0.08, Math.min(0.32, fullKelly * 0.25 * conviction));
    rawSize = currentEquity * quarterKelly;
  } else {
    const baseRiskFraction = profile.id === "[degen]" ? 0.05 : profile.id === "[elvis]" ? 0.035 : profile.id === "[paranoid]" ? 0.015 : settings.riskPerTrade;
    rawSize = currentEquity * baseRiskFraction * 5 * conviction;
  }
  const stakeTier = TIER_CONFIGS[detectTier(currentEquity)];
  const stakeBudgetTotal = Math.round(currentEquity * stakeTier.maxPortfolioExposure * 100) / 100;
  const stakeRemaining = Math.max(0, Math.round((stakeBudgetTotal - currentExposure) * 100) / 100);
  // Small-book floor removed: inflating rawSize toward $35 forced tickets
  // ~2.6x the intended risk just to clear minNotional. The stake guard and
  // minTicket gate handle viability without distorting the risk budget.
  const bindingNotional = Math.max(0, Math.min(rawSize, maxIdeaCash, cashPerSlot, bookCapRemaining, stakeRemaining, stakePerSlot, book.cash));
  const stakeSplit = applyStakeBudget({ equity: currentEquity, tier: stakeTier, currentExposure, riskNotional: bindingNotional, targetPct: calculatedTargetPct, openPositionCount: book.positions.length, maxConcurrentPositions: maxSlots });
  const roundedNotional = stakeSplit.blocked ? 0 : Math.round(stakeSplit.notional * 100) / 100;
  const qty = roundedNotional > 0 && entryPrice > 0 ? roundedNotional / entryPrice : 0;
  const valueAtRisk95 = Math.round(roundedNotional * volatility * 1.645 * 100) / 100;
  const academicAudit = auditAcademicSafeguards(candidate, roundedNotional, currentEquity);
  academicAudit.audits.forEach((audit) => {
    checks.push({ id: audit.rule.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 24), label: audit.rule, pass: audit.passed, detail: `${audit.source}: ${audit.metric}` });
    if (!audit.passed) reasons.push(`[${audit.source}] ${audit.description}`);
  });
  checks.push({ id: "kill", label: "Kill switch inactive", pass: !book.kill, detail: book.kill ? (book.killReason ?? "Halted") : "Armed" });
  if (book.kill) reasons.push("Portfolio kill switch is active");
  checks.push({ id: "cooldown", label: "Consecutive loss cooldown", pass: !cooling, detail: cooling ? "Cooling down" : "Clear" });
  if (cooling) reasons.push("Waiting out loss cooldown period");
  const ddPass = drawdown <= settings.maxDrawdownBreaker;
  checks.push({ id: "drawdown", label: `Max drawdown breaker (<${(settings.maxDrawdownBreaker * 100).toFixed(0)}%)`, pass: ddPass, detail: `Current drawdown ${(drawdown * 100).toFixed(1)}%` });
  if (!ddPass) reasons.push(`Portfolio drawdown ${(drawdown * 100).toFixed(1)}% breached safety limit`);
  const slotPass = book.positions.length < maxSlots;
  checks.push({ id: "slots", label: `Max positions (${maxSlots})`, pass: slotPass, detail: `${book.positions.length}/${maxSlots} held` });
  if (!slotPass) reasons.push("Maximum concurrent positions reached");
  const stakePass = !stakeSplit.blocked;
  checks.push({ id: "stake", label: `Stake budget ($${currentExposure.toFixed(0)} of $${stakeBudgetTotal.toFixed(0)} staked)`, pass: stakePass, detail: stakePass ? `Share $${roundedNotional.toFixed(2)} at ${(stakeSplit.targetScale * 100).toFixed(0)}% target weight` : stakeSplit.reason });
  if (!stakePass) reasons.push(stakeSplit.reason);
  checks.push({ id: "dup", label: "Not already held", pass: !isDuplicate, detail: isDuplicate ? "Held" : "New entry" });
  if (isDuplicate) reasons.push("Candidate asset is already held in book");
  const chainCount = book.positions.filter((p) => p.chain === candidate.chain).length;
  const chainPass = chainCount < settings.maxPerChain;
  checks.push({ id: "chain", label: `Chain concentration (<${settings.maxPerChain})`, pass: chainPass, detail: `${chainCount}/${settings.maxPerChain} in ${candidate.chain}` });
  if (!chainPass) reasons.push(`Too many open positions in ${candidate.chain}`);
  const scorePass = candidate.score >= minScore;
  checks.push({ id: "score", label: `Adaptive score floor (≥${minScore})`, pass: scorePass, detail: `${candidate.score}/100` });
  if (!scorePass) reasons.push(`Score ${candidate.score} below adaptive floor ${minScore}`);
  checks.push({ id: "fib-geometry", label: "Fib bracket geometry", pass: true, detail: fibNote ?? (settings.sizingProfile === "TURBO" ? "Raw ATR brackets (no level within snap)" : "Classic ATR brackets") });
  checks.push({ id: "winner-resemblance", label: "Resembles past winners", pass: true, detail: `${Math.round(resemblance * 100)}% vector similarity over ${math?.winnerVectors?.length ?? 0} wins` });
  if (math?.openVectors && math.openVectors.length > 0) {
    const stacked = isCorrelatedDuplicate(candidateVector, math.openVectors);
    checks.push({ id: "correlation", label: "Uncorrelated with open risk", pass: !stacked, detail: stacked ? "Near-duplicate of an open position" : "Distinct market character" });
    if (stacked) reasons.push("Candidate duplicates the character of an open position");
  }
  const liqUnknownCex = candidate.liquidityUnknown === true && candidate.venue === "binance";
  const liqPass = liqUnknownCex || candidate.liquidityUsd >= settings.minLiquidity;
  checks.push({ id: "liq", label: liqUnknownCex ? "CEX spot depth (unpublished, majors only)" : `Pool liquidity (≥$${(settings.minLiquidity / 1000).toFixed(0)}k)`, pass: liqPass, detail: liqUnknownCex ? "CEX depth unpublished" : `$${Math.round(candidate.liquidityUsd).toLocaleString()}` });
  if (!liqPass) reasons.push(`Liquidity $${Math.round(candidate.liquidityUsd)} is below safe threshold`);
  const effectiveMinTicket = currentEquity <= 250 ? Math.min(25, book.cash) : settings.minTicket;
  const cashPass = roundedNotional >= effectiveMinTicket && roundedNotional <= book.cash;
  checks.push({ id: "ticket", label: `Ticket size allows execution (≥$${effectiveMinTicket.toFixed(0)})`, pass: cashPass, detail: `Sized $${roundedNotional.toFixed(2)} (Cash: $${book.cash.toFixed(2)})` });
  if (!cashPass) reasons.push(`Calculated ticket $${roundedNotional.toFixed(2)} below minimum viable size`);
  const allowed = checks.every((c) => c.pass);
  const finalStopPct = entryPrice > 0 ? Math.max(0, (entryPrice - stopPrice) / entryPrice) : calculatedStopPct;
  const finalTargetPct = entryPrice > 0 ? Math.max(0, (targetPrice - entryPrice) / entryPrice) : calculatedTargetPct;
  return {
    allowed, notional: allowed ? roundedNotional : 0, qty: allowed ? qty : 0, entryPrice, stopPrice, targetPrice,
    stopLossPct: finalStopPct, takeProfitPct: finalTargetPct,
    riskRewardRatio: Math.round(((finalStopPct > 0 ? finalTargetPct / finalStopPct : rrRatio)) * 10) / 10,
    riskAmount: Math.round(roundedNotional * finalStopPct * 100) / 100,
    atr: Math.round(atr * 10000) / 10000, volatility: Math.round(volatility * 1000) / 10,
    volatilityRegime: regime, valueAtRisk95, checks, reasons,
  };
}
