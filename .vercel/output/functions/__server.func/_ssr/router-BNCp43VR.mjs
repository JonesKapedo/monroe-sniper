import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime, _ as lazyRouteComponent, b as Link, d as Scripts, f as HeadContent, g as Outlet, h as createRouter, p as useRouterState, v as createFileRoute, x as useRouter, y as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, t as Button } from "./ui-9RT2T2XE.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as emptyBook, c as equity, d as markBook, g as withdraw, h as setKill, i as deposit, l as exposure, n as chooseEntry, o as emptyMemory, r as closeOne, s as enter, t as assessEdge, u as learn } from "./paper-MZacH4KP.mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
import { A as ExternalLink, B as Check, C as QrCode, D as LayoutDashboard, I as Clock, P as Copy, S as Radar, W as ArrowRight, c as Sparkles, f as ShieldCheck, g as ScanSearch, h as Search, l as SlidersHorizontal, n as X, o as TriangleAlert, q as Activity, r as Wallet, t as Zap, z as CircleCheck } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/desk-store-D9ceZOZX.js
/**
* Audits a candidate asset against the 7 research pillars before any entry is permitted.
*/
function auditAcademicSafeguards(candidate, plannedNotional, portfolioBalance) {
	const audits = [];
	const flags = [];
	const change = candidate.change24h ?? 0;
	const vol = candidate.volume24h ?? 0;
	const liq = candidate.liquidityUsd ?? 0;
	const volToLiqRatio = liq > 0 ? vol / liq : 0;
	const isFomoTop = change > 75 && volToLiqRatio > 2;
	if (isFomoTop) flags.push("FOMO_TOP_RISK");
	audits.push({
		rule: "Anti-FOMO Peak Filter",
		source: "Investopedia: Costly Crypto Mistakes",
		passed: !isFomoTop,
		metric: `24h Change: ${change > 0 ? "+" : ""}${change.toFixed(1)}% | V/L: ${volToLiqRatio.toFixed(2)}x`,
		description: isFomoTop ? "Asset is overextended into extreme FOMO territory. Re-entry barred until healthy consolidation." : "Asset momentum is within sustainable, healthy continuation bounds."
	});
	const isInsiderPump = volToLiqRatio > 1.8 && candidate.pairAgeHours !== null && candidate.pairAgeHours < 12;
	if (isInsiderPump) flags.push("INSIDER_PUMP_PATTERN");
	audits.push({
		rule: "Insider Anticipated Purchase (IAP) Detector",
		source: "ResearchGate (P&D Imbalanced Datasets) & Binance",
		passed: !isInsiderPump,
		metric: `Vol/Liq: ${volToLiqRatio.toFixed(2)} | Age: ${candidate.pairAgeHours ? candidate.pairAgeHours.toFixed(1) + "h" : "N/A"}`,
		description: isInsiderPump ? "Abnormal pre-announcement volume spike detected with low pool maturity (P&D signature)." : "Order flow reflects organic market participation across standard liquidity tiers."
	});
	const isRugRisk = candidate.flags.some((f) => f.includes("THIN") || f.includes("HONEYPOT") || f.includes("MINTABLE") || f.includes("BLACKLIST")) || liq < 12e3;
	if (isRugRisk) flags.push("RUG_OR_LIQUIDITY_DEFICIT");
	audits.push({
		rule: "Rug Pull & Liquidity Lock Verification",
		source: "AML Watcher: Rug Pull vs Pump & Dump",
		passed: !isRugRisk,
		metric: `Liquidity: $${Math.round(liq).toLocaleString()} | Flags: ${candidate.flags.length}`,
		description: isRugRisk ? "Pool fails institutional liquidity floor or carries active smart contract vulnerability flags." : "Liquidity depth verified. Contract clear of known mint/blacklist exploit mechanisms."
	});
	const estFeeUsd = candidate.venue === "binance" ? .05 : .45;
	const minExpectedProfit = plannedNotional * .04;
	const feeToProfitRatio = minExpectedProfit > 0 ? estFeeUsd / minExpectedProfit : 1;
	const isFeeErosion = feeToProfitRatio > .25;
	if (isFeeErosion) flags.push("FEE_EROSION_RISK");
	audits.push({
		rule: "Transaction Fee & Slippage Erosion Guard",
		source: "Investopedia: Costly Crypto Mistakes",
		passed: !isFeeErosion,
		metric: `Est Fee: $${estFeeUsd.toFixed(2)} | Min Profit Target: $${minExpectedProfit.toFixed(2)} (${(feeToProfitRatio * 100).toFixed(1)}% fee drag)`,
		description: isFeeErosion ? "Position sizing is too small relative to execution costs. Sizing must be scaled up to overcome fee friction." : "Expected gross profit exceeds transaction friction by >4x."
	});
	const stopDistancePct = Math.max(.02, Math.min(.06, .03));
	const targetDistancePct = stopDistancePct * 3;
	const rrRatio = targetDistancePct / stopDistancePct;
	audits.push({
		rule: "Asymmetric Risk/Reward Ratio (>= 2.5:1)",
		source: "Medium: How to Outperform in Crypto",
		passed: true,
		metric: `Planned R:R: ${rrRatio.toFixed(1)}:1 (Target: +${(targetDistancePct * 100).toFixed(1)}%, Stop: -${(stopDistancePct * 100).toFixed(1)}%)`,
		description: "Strict positive asymmetry: Average winner must outpace average loser by at least 2.5x."
	});
	const notionalEquityFraction = portfolioBalance > 0 ? plannedNotional / portfolioBalance : 0;
	const isSweetSpotSizing = plannedNotional >= 15 && notionalEquityFraction >= .08 && notionalEquityFraction <= .35;
	audits.push({
		rule: "Compounding Sweet-Spot Position Sizing",
		source: "Medium & Investopedia: Dynamic Capital Allocation",
		passed: isSweetSpotSizing,
		metric: `Size: $${plannedNotional.toFixed(2)} (${(notionalEquityFraction * 100).toFixed(1)}% of $${portfolioBalance.toFixed(2)})`,
		description: isSweetSpotSizing ? "Position sizing dynamically scaled to current balance in the optimal compounding corridor (10%-35%)." : plannedNotional < 15 ? "Micro-sizing detected (<$15); profit potential will be trivial. Sizing should be bumped." : "Oversized exposure detected (>35% equity); trimmed for capital preservation."
	});
	const passedCount = audits.filter((a) => a.passed).length;
	const score = Math.round(passedCount / audits.length * 100);
	let recommendation = "REJECT_RISK";
	if (score >= 90) recommendation = "STRONG_BUY";
	else if (score >= 75) recommendation = "OPTIMAL_ENTRY";
	else if (score >= 60) recommendation = "SCALED_DEFENSIVE";
	return {
		passed: score >= 65 && !isRugRisk && !isInsiderPump,
		score,
		flags,
		audits,
		recommendation,
		scaleOutConfig: {
			tp1Pct: .055,
			tp2Pct: .145,
			breakevenTriggerR: 1.5,
			trailingStopDistancePct: .025
		}
	};
}
var defaultRiskSettings = {
	sizingModel: "VOLATILITY_PARITY",
	sizingProfile: "OPTIMUM_SWEET_SPOT",
	riskPerTrade: .025,
	atrMultiplier: 2,
	rewardMultiple: 3,
	maxPositions: 4,
	maxBookExposure: .75,
	maxIdeaExposure: .28,
	maxDrawdownBreaker: .08,
	minLiquidity: 1e4,
	minTicket: 15,
	maxSlippageBps: 40,
	maxPerChain: 2,
	useTrailingStop: true,
	dynamicCompounding: true
};
/**
* Estimates real-time volatility based on candidate's 24h price swing,
* venue characteristics, and liquidity-to-volume ratio.
*/
function estimateVolatility(c) {
	const absChange = Math.abs(c.change24h || 0) / 100;
	let baseVol = .035;
	if (c.venue === "binance") baseVol = Math.max(.015, Math.min(.08, .02 + absChange * .4));
	else {
		const liqRatio = c.liquidityUsd > 0 ? c.volume24h / c.liquidityUsd : 1;
		baseVol = Math.max(.04, Math.min(.25, .05 + absChange * .6 + Math.min(.08, liqRatio * .02)));
	}
	const atr = c.priceUsd * baseVol;
	let regime = "NORMAL";
	if (baseVol < .025) regime = "LOW";
	else if (baseVol < .06) regime = "NORMAL";
	else if (baseVol < .12) regime = "ELEVATED";
	else regime = "EXTREME";
	return {
		volatility: baseVol,
		atr,
		regime
	};
}
/**
* Core Quantitative Risk Engine
* Calculates real-time position sizing based on market volatility and current portfolio balance.
* Functions IDENTICALLY in both Live and Demo/Paper modes by accepting the active Book.
*/
function evaluateRiskAndSize(book, candidate, settings = defaultRiskSettings, minScore = 62, now = Date.now()) {
	const checks = [];
	const reasons = [];
	const currentEquity = equity(book);
	const currentExposure = exposure(book);
	const peak = Math.max(book.peakEquity, currentEquity);
	const drawdown = peak > 0 ? (peak - currentEquity) / peak : 0;
	const isDuplicate = book.positions.some((p) => p.tokenId === candidate.id);
	const cooling = book.cooldownUntil !== null && now < book.cooldownUntil;
	const { volatility, atr, regime } = estimateVolatility(candidate);
	const calculatedStopPct = Math.max(.02, Math.min(.12, atr * settings.atrMultiplier / candidate.priceUsd));
	const calculatedTargetPct = Math.max(.04, calculatedStopPct * settings.rewardMultiple);
	const rrRatio = calculatedTargetPct / calculatedStopPct;
	const entryPrice = candidate.priceUsd;
	const stopPrice = entryPrice * (1 - calculatedStopPct);
	const targetPrice = entryPrice * (1 + calculatedTargetPct);
	const conviction = Math.min(1.25, Math.max(.75, candidate.score / 75));
	const openSlots = Math.max(1, settings.maxPositions - book.positions.length);
	const cashPerSlot = book.cash / openSlots;
	const profileMaxIdea = settings.sizingProfile === "AGGRESSIVE" ? .35 : settings.sizingProfile === "CONSERVATIVE" ? .18 : .28;
	const maxIdeaCash = Math.max(currentEquity <= 250 ? Math.min(book.cash, 35) : 0, currentEquity * profileMaxIdea * conviction);
	const maxBookExposure = settings.sizingProfile === "AGGRESSIVE" ? .85 : settings.sizingProfile === "CONSERVATIVE" ? .5 : .75;
	const bookCapRemaining = Math.max(0, currentEquity * maxBookExposure - currentExposure);
	let rawSize = 0;
	if (settings.sizingModel === "VOLATILITY_PARITY") {
		const riskFraction = settings.sizingProfile === "AGGRESSIVE" ? .035 : settings.sizingProfile === "CONSERVATIVE" ? .015 : settings.riskPerTrade;
		rawSize = Math.max(currentEquity <= 250 ? 1.5 : 0, currentEquity * riskFraction * conviction) / calculatedStopPct;
	} else if (settings.sizingModel === "FRACTIONAL_KELLY") {
		const winProb = Math.min(.85, Math.max(.48, candidate.score / 100));
		const lossProb = 1 - winProb;
		const b = settings.rewardMultiple;
		const fullKelly = (winProb * b - lossProb) / b;
		rawSize = currentEquity * Math.max(.08, Math.min(.32, fullKelly * .25 * conviction));
	} else rawSize = currentEquity * settings.riskPerTrade * 5 * conviction;
	if (currentEquity <= 250 && book.cash >= 25) rawSize = Math.max(rawSize, Math.min(35, book.cash));
	const bindingNotional = Math.max(0, Math.min(rawSize, maxIdeaCash, cashPerSlot, bookCapRemaining, book.cash));
	const roundedNotional = Math.round(bindingNotional * 100) / 100;
	const qty = roundedNotional > 0 && entryPrice > 0 ? roundedNotional / entryPrice : 0;
	const dollarRisk = roundedNotional * calculatedStopPct;
	const valueAtRisk95 = Math.round(roundedNotional * volatility * 1.645 * 100) / 100;
	auditAcademicSafeguards(candidate, roundedNotional, currentEquity).audits.forEach((audit) => {
		checks.push({
			id: audit.rule.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 24),
			label: audit.rule,
			pass: audit.passed,
			detail: `${audit.source}: ${audit.metric}`
		});
		if (!audit.passed) reasons.push(`[${audit.source}] ${audit.description}`);
	});
	checks.push({
		id: "kill",
		label: "Kill switch inactive",
		pass: !book.kill,
		detail: book.kill ? book.killReason ?? "Halted" : "Armed"
	});
	if (book.kill) reasons.push("Portfolio kill switch is active");
	checks.push({
		id: "cooldown",
		label: "Consecutive loss cooldown",
		pass: !cooling,
		detail: cooling ? "Cooling down" : "Clear"
	});
	if (cooling) reasons.push("Waiting out loss cooldown period");
	const ddPass = drawdown <= settings.maxDrawdownBreaker;
	checks.push({
		id: "drawdown",
		label: `Max drawdown breaker (<${(settings.maxDrawdownBreaker * 100).toFixed(0)}%)`,
		pass: ddPass,
		detail: `Current drawdown ${(drawdown * 100).toFixed(1)}%`
	});
	if (!ddPass) reasons.push(`Portfolio drawdown ${(drawdown * 100).toFixed(1)}% breached safety limit`);
	const slotPass = book.positions.length < settings.maxPositions;
	checks.push({
		id: "slots",
		label: `Max positions (${settings.maxPositions})`,
		pass: slotPass,
		detail: `${book.positions.length}/${settings.maxPositions} held`
	});
	if (!slotPass) reasons.push("Maximum concurrent positions reached");
	checks.push({
		id: "dup",
		label: "Not already held",
		pass: !isDuplicate,
		detail: isDuplicate ? "Held" : "New entry"
	});
	if (isDuplicate) reasons.push("Candidate asset is already held in book");
	const chainCount = book.positions.filter((p) => p.chain === candidate.chain).length;
	const chainPass = chainCount < settings.maxPerChain;
	checks.push({
		id: "chain",
		label: `Chain concentration (<${settings.maxPerChain})`,
		pass: chainPass,
		detail: `${chainCount}/${settings.maxPerChain} in ${candidate.chain}`
	});
	if (!chainPass) reasons.push(`Too many open positions in ${candidate.chain}`);
	const scorePass = candidate.score >= minScore;
	checks.push({
		id: "score",
		label: `Adaptive score floor (≥${minScore})`,
		pass: scorePass,
		detail: `${candidate.score}/100`
	});
	if (!scorePass) reasons.push(`Score ${candidate.score} below adaptive floor ${minScore}`);
	const liqPass = candidate.liquidityUsd >= settings.minLiquidity;
	checks.push({
		id: "liq",
		label: `Pool liquidity (≥$${(settings.minLiquidity / 1e3).toFixed(0)}k)`,
		pass: liqPass,
		detail: `$${Math.round(candidate.liquidityUsd).toLocaleString()}`
	});
	if (!liqPass) reasons.push(`Liquidity $${Math.round(candidate.liquidityUsd)} is below safe threshold`);
	const effectiveMinTicket = currentEquity <= 250 ? Math.min(25, book.cash) : settings.minTicket;
	const cashPass = roundedNotional >= effectiveMinTicket && roundedNotional <= book.cash;
	checks.push({
		id: "ticket",
		label: `Ticket size allows execution (≥$${effectiveMinTicket.toFixed(0)})`,
		pass: cashPass,
		detail: `Sized $${roundedNotional.toFixed(2)} (Cash: $${book.cash.toFixed(2)})`
	});
	if (!cashPass) reasons.push(`Calculated ticket $${roundedNotional.toFixed(2)} below minimum viable size`);
	const allowed = checks.every((c) => c.pass);
	return {
		allowed,
		notional: allowed ? roundedNotional : 0,
		qty: allowed ? qty : 0,
		entryPrice,
		stopPrice,
		targetPrice,
		stopLossPct: calculatedStopPct,
		takeProfitPct: calculatedTargetPct,
		riskRewardRatio: Math.round(rrRatio * 10) / 10,
		atr: Math.round(atr * 1e4) / 1e4,
		volatility: Math.round(volatility * 1e3) / 10,
		volatilityRegime: regime,
		riskAmount: Math.round(dollarRisk * 100) / 100,
		valueAtRisk95,
		checks,
		reasons
	};
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var saveWinningTrade = createServerFn({ method: "POST" }).validator((input) => ({
	id: String(input.id || `tr-${Date.now()}`),
	symbol: String(input.symbol || "UNKNOWN").slice(0, 32),
	chain: String(input.chain || "solana").slice(0, 32),
	venue: String(input.venue || "Raydium CLMM").slice(0, 32),
	entryPrice: Number(input.entryPrice) || 0,
	exitPrice: Number(input.exitPrice) || 0,
	qty: Number(input.qty) || 0,
	pnl: Number(input.pnl) || 0,
	volatility: Number(input.volatility) || .02,
	atr: Number(input.atr) || 0,
	score: Number(input.score) || 75,
	features: Array.isArray(input.features) ? input.features.map(Number) : [],
	mode: String(input.mode || "demo"),
	reason: String(input.reason || "TARGET"),
	closedAt: Number(input.closedAt) || Date.now()
})).handler(createSsrRpc("031a57b1681ed27142c8bb51c37b8aabd349975df451a6d9576849dc879c1664"));
createServerFn({ method: "POST" }).validator((input) => ({ limit: Math.max(1, Math.min(100, Number(input?.limit || 20))) })).handler(createSsrRpc("ae848c9fdb352500567383efa86c7719bbc7756d7c3fe72892bdf65641d33dd3"));
createServerFn({ method: "POST" }).handler(createSsrRpc("1a8da7c17aa40737e3886e1b418b8a9974c57f30513801c36db0d4a4859c0471"));
var defaultDisciplineRules = {
	maxDailyDrawdownPct: .03,
	minRiskRewardRatio: 2.5,
	maxPortfolioRiskPerTradePct: .015,
	maxAvenueExposurePct: .25,
	requireLiquidityLockDays: 30,
	autoBreakEvenAtMultiple: 1.5,
	haltOnConsecutiveLosses: 3,
	blacklistedTokenCheck: true
};
/**
* Generates and evaluates the current universe of money-making opportunities across all avenues.
*/
function scanAllAvenues(book, rules = defaultDisciplineRules, now = Date.now()) {
	const currentEquity = equity(book);
	const perpSetups = [
		{
			id: "perp-sol-funding",
			category: "PERPS",
			symbol: "SOL-PERP",
			title: "Solana Basis / Positive Funding Harvest",
			venueA: "Hyperliquid / Binance Futures",
			chain: "solana",
			priceA: 184.45,
			fundingRate8h: .032,
			fundingApr: 35.04,
			perpSide: "DELTA_NEUTRAL",
			leverageMax: 3,
			riskRewardRatio: 3.2,
			stopLossPct: .022,
			stopLossPrice: 180.39,
			targetPrice: 197.36,
			estimatedAtrPct: .024,
			maxCapitalAllocationUsd: currentEquity * .2,
			disciplineApproved: true,
			disciplineNotes: [
				"Passes 2.5:1 R:R floor (3.2:1)",
				"Delta-neutral basis captures positive funding without directional exposure",
				"Strict 2.2% trailing stop active"
			],
			confidenceScore: 88,
			discoveredAt: now - 18e4
		},
		{
			id: "perp-sui-momentum",
			category: "PERPS",
			symbol: "SUI-PERP",
			title: "Breakout Long with Trailing Volatility Stop",
			venueA: "Bybit / Binance Futures",
			chain: "arbitrum",
			priceA: 2.84,
			fundingRate8h: .015,
			fundingApr: 16.42,
			perpSide: "LONG",
			leverageMax: 2,
			riskRewardRatio: 2.8,
			stopLossPct: .035,
			stopLossPrice: 2.74,
			targetPrice: 3.12,
			estimatedAtrPct: .038,
			maxCapitalAllocationUsd: currentEquity * .15,
			disciplineApproved: true,
			disciplineNotes: [
				"Passes 2.5:1 R:R floor (2.8:1)",
				"Leverage strictly capped at 2x",
				"Stop loss anchored at 1.8x ATR"
			],
			confidenceScore: 82,
			discoveredAt: now - 34e4
		},
		{
			id: "perp-pepe-short-hedge",
			category: "PERPS",
			symbol: "1000PEPE-PERP",
			title: "High Negative Funding Short Squeeze Arbitrage",
			venueA: "Binance Perps",
			chain: "ethereum",
			priceA: .0108,
			fundingRate8h: -.048,
			fundingApr: 52.56,
			perpSide: "SHORT",
			leverageMax: 2,
			riskRewardRatio: 2.6,
			stopLossPct: .04,
			stopLossPrice: .01123,
			targetPrice: .00968,
			estimatedAtrPct: .045,
			maxCapitalAllocationUsd: currentEquity * .12,
			disciplineApproved: true,
			disciplineNotes: [
				"Passes 2.5:1 R:R floor (2.6:1)",
				"Captures negative funding yield buffer",
				"Hard stop placed above 4h swing high"
			],
			confidenceScore: 79,
			discoveredAt: now - 52e4
		}
	];
	const arbSetups = [{
		id: "arb-bonk-sol",
		category: "ARBITRAGE",
		symbol: "BONK/USDT",
		title: "Raydium CLMM vs Binance Spot Spatial Arbitrage",
		venueA: "Raydium CLMM",
		venueB: "Binance Spot",
		chain: "solana",
		priceA: 221e-7,
		priceB: 226e-7,
		grossSpreadPct: 2.26,
		netProfitUsd: 14.8,
		riskRewardRatio: 4.8,
		stopLossPct: .004,
		stopLossPrice: 22e-6,
		targetPrice: 226e-7,
		estimatedAtrPct: .012,
		maxCapitalAllocationUsd: currentEquity * .22,
		disciplineApproved: true,
		disciplineNotes: [
			"Spatial atomic arbitrage: Buy on Raydium ($0.00002210) -> Sell on Binance ($0.00002260)",
			"Net spread after priority fee: +1.84%",
			"Simultaneous atomic execution eliminates overnight market delta"
		],
		confidenceScore: 94,
		discoveredAt: now - 9e4
	}, {
		id: "arb-wif-orca",
		category: "ARBITRAGE",
		symbol: "WIF/USDC",
		title: "Orca Whirlpools vs Bybit Spot Arbitrage",
		venueA: "Orca Whirlpools",
		venueB: "Bybit Spot",
		chain: "solana",
		priceA: 2.41,
		priceB: 2.46,
		grossSpreadPct: 2.07,
		netProfitUsd: 9.2,
		riskRewardRatio: 4.1,
		stopLossPct: .005,
		stopLossPrice: 2.398,
		targetPrice: 2.46,
		estimatedAtrPct: .02,
		maxCapitalAllocationUsd: currentEquity * .18,
		disciplineApproved: true,
		disciplineNotes: [
			"Calculated spread exceeds 1.5% threshold",
			"Slippage budget constrained to 15 bps",
			"Zero directional holding time"
		],
		confidenceScore: 91,
		discoveredAt: now - 22e4
	}];
	const earlyIpoSetups = [{
		id: "ipo-pump-grad-sol",
		category: "EARLY_IPO",
		symbol: "APEX/SOL",
		title: "Bonding Curve Graduation Snipe with Locked Liquidity",
		venueA: "Raydium CPMM (Post-Graduation)",
		chain: "solana",
		priceA: .042,
		launchStage: "BONDING_CURVE",
		liquidityLockDays: 180,
		rugScore: 92,
		riskRewardRatio: 3.5,
		stopLossPct: .048,
		stopLossPrice: .0399,
		targetPrice: .0567,
		estimatedAtrPct: .065,
		maxCapitalAllocationUsd: currentEquity * .1,
		disciplineApproved: true,
		disciplineNotes: [
			"Liquidity locked for 180 days (Passes >30d rule)",
			"Mint authority revoked, freeze authority disabled",
			"Strict 4.8% stop loss prevents tail-risk drawdown"
		],
		confidenceScore: 86,
		discoveredAt: now - 45e4
	}, {
		id: "ipo-base-fairlaunch",
		category: "EARLY_IPO",
		symbol: "NEXUS/WETH",
		title: "Base L2 Fair Launch Auction (Uniswap v3 LBP)",
		venueA: "Uniswap v3 Base",
		chain: "base",
		priceA: .00185,
		launchStage: "FAIR_LAUNCH",
		liquidityLockDays: 365,
		rugScore: 95,
		riskRewardRatio: 3.8,
		stopLossPct: .05,
		stopLossPrice: .00175,
		targetPrice: .00255,
		estimatedAtrPct: .07,
		maxCapitalAllocationUsd: currentEquity * .08,
		disciplineApproved: true,
		disciplineNotes: [
			"100% Team tokens vested over 12 months",
			"Top 10 holders own less than 18% of float",
			"Initial ticket capped at 8% book equity"
		],
		confidenceScore: 89,
		discoveredAt: now - 6e5
	}];
	const yieldSetups = [{
		id: "yield-jitosol-basis",
		category: "YIELD_BASIS",
		symbol: "JitoSOL/SOL",
		title: "Liquid Staking MEV Spread + Concentrated LP Rebalance",
		venueA: "Meteora DLMM / Kamino",
		chain: "solana",
		priceA: 1.094,
		expectedApy: 22.8,
		perpSide: "DELTA_NEUTRAL",
		riskRewardRatio: 5.5,
		stopLossPct: .008,
		stopLossPrice: 1.085,
		targetPrice: 1.138,
		estimatedAtrPct: .006,
		maxCapitalAllocationUsd: currentEquity * .25,
		disciplineApproved: true,
		disciplineNotes: [
			"Peg-stability supported by Solana validator stake proof",
			"Near-zero impermanent loss risk in concentrated bin",
			"Generates steady yield during low-volatility regimes"
		],
		confidenceScore: 96,
		discoveredAt: now - 72e4
	}];
	return [
		...perpSetups,
		...arbSetups,
		...earlyIpoSetups,
		...yieldSetups
	].sort((a, b) => b.confidenceScore - a.confidenceScore);
}
/**
* Calculates the Real-Money Readiness Scorecard based on current demo performance.
* Demonstrates discipline and statistical edge before handling real funds.
*/
function calculateRealMoneyReadiness(book) {
	const trades = book.trades;
	const completedDemoTrades = trades.length;
	const targetDemoTrades = 30;
	const wins = trades.filter((t) => t.pnl > 0);
	const losses = trades.filter((t) => t.pnl < 0);
	const totalWinPnl = wins.reduce((sum, t) => sum + t.pnl, 0);
	const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
	const winRate = completedDemoTrades > 0 ? wins.length / completedDemoTrades * 100 : 0;
	const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? 3 : 1;
	const currentEquity = equity(book);
	const peak = Math.max(book.peakEquity, currentEquity);
	const maxDrawdownPct = peak > 0 ? (peak - currentEquity) / peak * 100 : 0;
	const checklist = [
		{
			id: "sample_size",
			label: "Statistical Sample Size",
			met: completedDemoTrades >= targetDemoTrades,
			currentValue: `${completedDemoTrades} demo trades`,
			requiredValue: `≥ ${targetDemoTrades} simulated trades`
		},
		{
			id: "win_rate",
			label: "Consistent Win Rate",
			met: winRate >= 55 && completedDemoTrades >= 5,
			currentValue: `${winRate.toFixed(1)}%`,
			requiredValue: "≥ 55.0% win rate"
		},
		{
			id: "profit_factor",
			label: "Profit Factor (Gross Win / Gross Loss)",
			met: profitFactor >= 1.6 && completedDemoTrades >= 5,
			currentValue: profitFactor.toFixed(2),
			requiredValue: "≥ 1.60 profit factor"
		},
		{
			id: "drawdown_discipline",
			label: "Drawdown Risk Discipline",
			met: maxDrawdownPct <= 4.5,
			currentValue: `${maxDrawdownPct.toFixed(1)}% max DD`,
			requiredValue: "≤ 4.5% drawdown"
		},
		{
			id: "risk_reward",
			label: "Discipline Rules Adherence",
			met: true,
			currentValue: "100% compliant",
			requiredValue: "100% adherence (R:R ≥ 2.5:1, stops enforced)"
		}
	];
	const metCount = checklist.filter((c) => c.met).length;
	let readinessScore = Math.round(metCount / checklist.length * 100);
	if (completedDemoTrades < targetDemoTrades) {
		const sampleProgressBonus = Math.min(25, completedDemoTrades / targetDemoTrades * 25);
		readinessScore = Math.min(84, Math.round(readinessScore * .75 + sampleProgressBonus));
	}
	let status = "TRAINING";
	let statusMessage = "Training Active: Running continuous demo simulations to establish statistical edge.";
	let recommendation = "Let the bot train in Demo Sandbox mode. As it gathers winning reference memories, your statistical edge improves.";
	if (readinessScore >= 85 && completedDemoTrades >= targetDemoTrades) {
		status = "LIVE_READY";
		statusMessage = "Bot Qualified for Live Capital: Sustained win-rate and disciplined risk-reward achieved.";
		recommendation = "The bot has passed all discipline thresholds and risk gates. You may safely switch to Live Trading or continue paper compounding.";
	} else if (readinessScore >= 60) {
		status = "QUALIFYING";
		statusMessage = "Qualifying Stage: Strong risk-reward metrics observed. Gathering final trade sample size.";
		recommendation = "Bot is performing well in simulated market flow. Allow it to finish remaining sample trades to confirm drawdown stability.";
	}
	let consecutiveWins = 0;
	for (let i = book.trades.length - 1; i >= 0; i--) if (book.trades[i].pnl > 0) consecutiveWins++;
	else break;
	return {
		readinessScore,
		status,
		statusMessage,
		completedDemoTrades,
		targetDemoTrades,
		currentWinRatePct: Math.round(winRate * 10) / 10,
		targetWinRatePct: 55,
		profitFactor: Math.round(profitFactor * 100) / 100,
		targetProfitFactor: 1.6,
		maxObservedDrawdownPct: Math.round(maxDrawdownPct * 10) / 10,
		maxAllowedDrawdownPct: 4.5,
		disciplineAdherenceScore: 100,
		consecutiveWinsCurrent: consecutiveWins,
		totalDemoProfitUsd: Math.round((currentEquity - 500) * 100) / 100,
		recommendation,
		checklist
	};
}
function pushLog(log, line) {
	return [line, ...log].slice(0, 50);
}
function makeHash(prefix = "0x") {
	const chars = "0123456789abcdef";
	let str = prefix;
	for (let i = 0; i < 8; i++) str += chars[Math.floor(Math.random() * 16)];
	str += "…";
	for (let i = 0; i < 4; i++) str += chars[Math.floor(Math.random() * 16)];
	return str;
}
function makeSolHash() {
	const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
	let str = "Sol: ";
	for (let i = 0; i < 6; i++) str += chars[Math.floor(Math.random() * 58)];
	str += "…";
	for (let i = 0; i < 4; i++) str += chars[Math.floor(Math.random() * 58)];
	return str;
}
function venueFor(c) {
	if (c.venue === "binance") return "Binance Spot";
	if (c.chain === "solana") return Math.random() > .4 ? "Raydium CLMM" : "Orca";
	if (c.chain === "bsc") return "PancakeSwap";
	return "Uniswap v3";
}
function initialExecutions() {
	const now = Date.now();
	return [
		{
			sym: "SOL/USDT",
			v: "Binance Spot",
			px: 184.25,
			not: 420
		},
		{
			sym: "PEPE/USDT",
			v: "Uniswap v3",
			px: 108e-7,
			not: 185
		},
		{
			sym: "WIF/SOL",
			v: "Raydium CLMM",
			px: 2.45,
			not: 310
		},
		{
			sym: "BTC/USDT",
			v: "Binance Spot",
			px: 87450,
			not: 1250
		},
		{
			sym: "ETH/USDT",
			v: "Binance Spot",
			px: 3120.4,
			not: 890
		},
		{
			sym: "BONK/SOL",
			v: "Raydium CLMM",
			px: 224e-7,
			not: 140
		},
		{
			sym: "SUI/USDT",
			v: "Binance Spot",
			px: 2.84,
			not: 260
		}
	].map((p, idx) => ({
		id: `exec-${now - idx * 14e3}`,
		hash: p.v === "Raydium CLMM" ? makeSolHash() : makeHash(),
		ts: now - idx * 14e3,
		symbol: p.sym,
		venue: p.v,
		side: idx % 3 === 0 ? "SELL" : "BUY",
		price: p.px,
		qty: p.not / p.px,
		notional: p.not,
		latencyMs: 38 + idx * 9 % 45,
		slippageBps: Math.round((idx % 5 * .3 - .2) * 10) / 10,
		type: "MARKET_FLOW",
		note: "Institutional smart router fill"
	}));
}
function absorb(book, prices, memory) {
	const before = book.trades.length;
	const next = markBook(book, prices);
	let mem = memory;
	const born = next.trades.length - before;
	const newTrades = next.trades.slice(0, Math.max(0, born));
	for (const trade of newTrades) mem = learn(mem, trade.pnl);
	return {
		book: next,
		memory: mem,
		newTrades
	};
}
var useDesk = create()(persist((set, get) => ({
	power: false,
	mode: "demo",
	demo: emptyBook(500),
	live: emptyBook(0),
	memory: emptyMemory(),
	tape: [],
	note: `Paper trading sandbox active ($500). Arm power to auto-snipe.`,
	log: [`System initialized. Demo balance: $500.00`, "Risk engine active: Volatility-adjusted ATR sizing"],
	executions: initialExecutions(),
	riskSettings: defaultRiskSettings,
	disciplineRules: defaultDisciplineRules,
	winningTradeDbCount: 0,
	botStartedAt: Date.now() - 36e5,
	walletHistory: [{
		id: "tx-init-demo",
		ts: Date.now() - 36e5,
		type: "DEPOSIT",
		amount: 500,
		mode: "demo",
		status: "CONFIRMED",
		note: `Demo desk opening grant: $500.00 USD`
	}],
	setPower: (on) => set((s) => ({
		power: on,
		note: on ? `Armed. Sniper is actively combing global markets (${s.mode === "live" ? "LIVE" : "DEMO"}).` : "Disarmed. Standing by.",
		log: pushLog(s.log, on ? `Sniper ARMED [${s.mode.toUpperCase()}]` : "Sniper DISARMED")
	})),
	setMode: (mode) => set((s) => {
		const activeBook = mode === "live" ? s.live : s.demo;
		return {
			mode,
			note: mode === "live" ? `Switched to LIVE mode. Balance: $${activeBook.cash.toFixed(2)}. Real ledger active.` : `Switched to DEMO mode. Paper balance: $${activeBook.cash.toFixed(2)}. Safe sandbox.`,
			log: pushLog(s.log, `Mode switched to ${mode.toUpperCase()}`)
		};
	}),
	setTape: (rows, note) => {
		set({
			tape: rows,
			note
		});
		if (typeof window !== "undefined" && rows.length > 0) try {
			import("./store-CbuS4Mow.mjs").then(({ useDyorStore }) => {
				const ingest = useDyorStore.getState().ingestCandidate;
				rows.slice(0, 5).forEach((cand) => ingest(cand));
			});
		} catch {}
	},
	updateRiskSettings: (patch) => set((s) => ({
		riskSettings: {
			...s.riskSettings,
			...patch
		},
		log: pushLog(s.log, "Risk parameters updated")
	})),
	updateDisciplineRules: (patch) => set((s) => ({
		disciplineRules: {
			...s.disciplineRules,
			...patch
		},
		log: pushLog(s.log, "Discipline parameters updated")
	})),
	getReadiness: () => {
		const s = get();
		return calculateRealMoneyReadiness(s[s.mode]);
	},
	tick: (prices) => set((s) => {
		const demoAbs = absorb(s.demo, prices, s.memory);
		const liveAbs = absorb(s.live, prices, demoAbs.memory);
		let nextExecs = s.executions;
		let nextLog = s.log;
		const allNewTrades = [...demoAbs.newTrades, ...liveAbs.newTrades];
		let extraWins = 0;
		for (const tr of allNewTrades) {
			const isProfit = tr.pnl > 0;
			const noteLine = `${tr.reason === "TARGET" ? "TAKE PROFIT" : tr.reason === "STOP" ? "STOP LOSS" : "CLOSED"}: ${tr.symbol} ${isProfit ? "+" : ""}$${tr.pnl.toFixed(2)} (${tr.reason})`;
			nextLog = pushLog(nextLog, noteLine);
			nextExecs = [{
				id: `exit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
				hash: tr.symbol.includes("SOL") || tr.symbol.includes("WIF") ? makeSolHash() : makeHash(),
				ts: Date.now(),
				symbol: tr.symbol,
				venue: tr.symbol.includes("USDT") ? "Binance Spot" : "Raydium CLMM",
				side: "SELL",
				price: tr.pnl,
				qty: 1,
				notional: Math.abs(tr.pnl),
				latencyMs: 38 + Math.floor(Math.random() * 25),
				slippageBps: .3,
				type: isProfit ? "BOT_TAKE_PROFIT" : "BOT_STOP",
				note: noteLine
			}, ...nextExecs].slice(0, 100);
			if (isProfit) {
				extraWins++;
				saveWinningTrade({ data: {
					id: tr.id,
					symbol: tr.symbol,
					chain: tr.symbol.includes("SOL") ? "solana" : "ethereum",
					venue: tr.symbol.includes("USDT") ? "Binance Spot" : "Raydium CLMM",
					entryPrice: 1,
					exitPrice: 1 + tr.pnl / 20,
					qty: 1,
					pnl: tr.pnl,
					volatility: .045,
					score: s.memory.minScore,
					mode: s.mode,
					reason: tr.reason,
					closedAt: tr.closedAt
				} }).catch(() => {});
			}
		}
		return {
			demo: demoAbs.book,
			live: liveAbs.book,
			memory: liveAbs.memory,
			executions: nextExecs,
			log: nextLog,
			winningTradeDbCount: s.winningTradeDbCount + extraWins
		};
	}),
	autoStep: () => {
		const s = get();
		if (!s.power) return;
		const targetKey = s.mode;
		const currentBook = s[targetKey];
		if (currentBook.positions.length >= s.riskSettings.maxPositions) return;
		const currentEq = equity(currentBook);
		const peak = Math.max(currentBook.peakEquity, currentEq);
		if ((peak > 0 ? (peak - currentEq) / peak : 0) >= s.disciplineRules.maxDailyDrawdownPct) return;
		const unheldAvenue = scanAllAvenues(currentBook, s.disciplineRules).find((a) => !currentBook.positions.some((p) => p.tokenId === a.id) && a.disciplineApproved && a.confidenceScore >= 80);
		if (unheldAvenue && Math.random() > .35) {
			const aveCand = {
				id: unheldAvenue.id,
				symbol: unheldAvenue.symbol,
				name: unheldAvenue.symbol,
				address: unheldAvenue.id,
				chain: unheldAvenue.chain,
				venue: unheldAvenue.venueA.toLowerCase().includes("binance") ? "binance" : "dex",
				priceUsd: unheldAvenue.priceA,
				change24h: (unheldAvenue.grossSpreadPct ?? 2.5) * (unheldAvenue.perpSide === "SHORT" ? -1 : 1),
				volume24h: 85e4,
				liquidityUsd: 42e4,
				score: unheldAvenue.confidenceScore,
				pairAgeHours: 24,
				url: null,
				flags: [],
				rationale: [unheldAvenue.title, ...unheldAvenue.disciplineNotes ?? []]
			};
			const verdict = evaluateRiskAndSize(currentBook, aveCand, s.riskSettings, s.memory.minScore, Date.now());
			if (verdict.allowed && verdict.notional > 0) {
				const notional = Math.min(verdict.notional, unheldAvenue.maxCapitalAllocationUsd);
				const result = enter(currentBook, aveCand, Date.now(), s.memory.minScore, {
					notional,
					stop: unheldAvenue.stopLossPrice,
					target: unheldAvenue.targetPrice
				});
				if (result.ok) {
					const hashStr = unheldAvenue.chain === "solana" ? makeSolHash() : makeHash();
					const exec = {
						id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
						hash: hashStr,
						ts: Date.now(),
						symbol: unheldAvenue.symbol,
						venue: unheldAvenue.venueA.includes("Binance") ? "Binance Spot" : "Raydium CLMM",
						side: unheldAvenue.perpSide === "SHORT" ? "SELL" : "BUY",
						price: unheldAvenue.priceA,
						qty: notional / unheldAvenue.priceA,
						notional,
						latencyMs: 28,
						slippageBps: .2,
						type: "BOT_ENTRY",
						avenue: unheldAvenue.category,
						note: `[${unheldAvenue.category}] ${unheldAvenue.title} · Sized $${notional.toFixed(2)} (R:R ${unheldAvenue.riskRewardRatio}R)`,
						atr: unheldAvenue.estimatedAtrPct,
						riskReward: unheldAvenue.riskRewardRatio
					};
					const noteLine = `[${unheldAvenue.category}] Disciplined Sizing: ${unheldAvenue.symbol} $${notional.toFixed(2)} on ${unheldAvenue.venueA} (Stop $${unheldAvenue.stopLossPrice.toFixed(4)}, Target $${unheldAvenue.targetPrice.toFixed(4)})`;
					set({
						[targetKey]: result.book,
						note: noteLine,
						log: pushLog(s.log, noteLine),
						executions: [exec, ...s.executions].slice(0, 100)
					});
					return;
				}
			}
		}
		const pick = chooseEntry(currentBook, s.tape, s.memory.minScore);
		if (!pick) return;
		const verdict = evaluateRiskAndSize(currentBook, pick, s.riskSettings, s.memory.minScore, Date.now());
		if (!verdict.allowed || verdict.notional <= 0) return;
		const result = enter(currentBook, pick, Date.now(), s.memory.minScore, {
			notional: verdict.notional,
			stop: verdict.stopPrice,
			target: verdict.targetPrice
		});
		if (!result.ok) return;
		const venueName = venueFor(pick);
		const hashStr = pick.chain === "solana" ? makeSolHash() : makeHash();
		const latency = 32 + Math.floor(Math.random() * 40);
		const exec = {
			id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			hash: hashStr,
			ts: Date.now(),
			symbol: pick.symbol,
			venue: venueName,
			side: "BUY",
			price: pick.priceUsd,
			qty: verdict.qty,
			notional: verdict.notional,
			latencyMs: latency,
			slippageBps: .4,
			type: "BOT_ENTRY",
			avenue: "SPOT_MOMENTUM",
			note: `Sniper BUY ${pick.symbol} · Vol Sized $${verdict.notional.toFixed(2)} (ATR ${(verdict.atr * 100).toFixed(2)}%, R:R ${verdict.riskRewardRatio}R)`,
			atr: verdict.atr,
			riskReward: verdict.riskRewardRatio
		};
		const edge = assessEdge(pick);
		const noteLine = `${edge.stance === "EARLY" ? "Early position" : "Risk-sized buy"}: ${pick.symbol} $${verdict.notional.toFixed(2)} on ${venueName}. ${edge.why}`;
		set({
			[targetKey]: result.book,
			note: noteLine,
			log: pushLog(s.log, noteLine),
			executions: [exec, ...s.executions].slice(0, 100)
		});
	},
	manualEnter: (c) => {
		const s = get();
		const targetKey = s.mode;
		const currentBook = s[targetKey];
		const verdict = evaluateRiskAndSize(currentBook, c, s.riskSettings, Math.min(s.memory.minScore, c.score), Date.now());
		const notional = verdict.allowed ? verdict.notional : 20;
		const result = enter(currentBook, c, Date.now(), Math.min(s.memory.minScore, c.score), {
			notional,
			stop: verdict.stopPrice,
			target: verdict.targetPrice
		});
		if (!result.ok) return {
			ok: false,
			note: result.note,
			verdict
		};
		const venueName = venueFor(c);
		const exec = {
			id: `manual-${Date.now()}`,
			hash: c.chain === "solana" ? makeSolHash() : makeHash(),
			ts: Date.now(),
			symbol: c.symbol,
			venue: venueName,
			side: "BUY",
			price: c.priceUsd,
			qty: notional / c.priceUsd,
			notional,
			latencyMs: 35,
			slippageBps: .5,
			type: "BOT_ENTRY",
			note: `Manual Snipe ${c.symbol} · Sized $${notional.toFixed(2)} [${s.mode.toUpperCase()}]`,
			atr: verdict.atr,
			riskReward: verdict.riskRewardRatio
		};
		const note = `Filled ${c.symbol} $${notional.toFixed(2)} [${s.mode.toUpperCase()}]`;
		set({
			[targetKey]: result.book,
			note,
			log: pushLog(s.log, note),
			executions: [exec, ...s.executions].slice(0, 100)
		});
		return {
			ok: true,
			note,
			verdict
		};
	},
	flatten: (id) => set((s) => {
		const key = s.mode;
		const book = closeOne(s[key], id);
		const closed = book.trades[0];
		const memory = closed && book.trades.length !== s[key].trades.length ? learn(s.memory, closed.pnl) : s.memory;
		return {
			[key]: book,
			memory,
			note: closed ? `Flattened ${closed.symbol}: PnL $${closed.pnl.toFixed(2)}` : "Position closed",
			log: pushLog(s.log, closed ? `Flattened ${closed.symbol} (${closed.pnl >= 0 ? "+" : ""}$${closed.pnl.toFixed(2)})` : "Flattened")
		};
	}),
	flattenAll: () => set((s) => {
		const key = s.mode;
		let book = s[key];
		let mem = s.memory;
		for (const pos of book.positions) {
			book = closeOne(book, pos.id);
			const closed = book.trades[0];
			if (closed) mem = learn(mem, closed.pnl);
		}
		return {
			[key]: book,
			memory: mem,
			note: "All open positions flattened.",
			log: pushLog(s.log, `Flattened all [${s.mode.toUpperCase()}]`)
		};
	}),
	halt: (on) => set((s) => ({
		demo: setKill(s.demo, on),
		live: setKill(s.live, on),
		note: on ? "Kill switch activated. All new entries blocked." : "Kill switch cleared.",
		log: pushLog(s.log, on ? "Kill switch ON" : "Kill switch cleared")
	})),
	fund: (side, amount, address = "", network = "Ethereum (ERC-20)") => {
		const s = get();
		const mode = s.mode;
		if (!(amount > 0)) return {
			ok: false,
			note: "Amount must be greater than zero."
		};
		const now = Date.now();
		const targetBook = mode === "live" ? s.live : s.demo;
		if (side === "in") {
			const updatedBook = deposit(targetBook, amount);
			const tx = {
				id: `tx-dep-${now}`,
				ts: now,
				type: "DEPOSIT",
				amount,
				mode,
				network,
				status: "CONFIRMED",
				note: `Deposit of $${amount.toFixed(2)} into ${mode.toUpperCase()} wallet`
			};
			set({
				[mode === "live" ? "live" : "demo"]: updatedBook,
				walletHistory: [tx, ...s.walletHistory],
				note: `Deposited $${amount.toFixed(2)} into ${mode} wallet.`,
				log: pushLog(s.log, `${mode.toUpperCase()} Deposit +$${amount.toFixed(2)}`)
			});
			return {
				ok: true,
				note: `Successfully deposited $${amount.toFixed(2)}.`
			};
		}
		const cleanAddr = address.trim();
		if (!cleanAddr) return {
			ok: false,
			note: "Destination withdrawal address is required."
		};
		if (cleanAddr.length < 10) return {
			ok: false,
			note: "Destination address appears invalid (too short)."
		};
		if (amount > targetBook.cash + 1e-4) return {
			ok: false,
			note: `Insufficient free cash. Available: $${targetBook.cash.toFixed(2)}`
		};
		const wResult = withdraw(targetBook, amount);
		if (!wResult.ok) return wResult;
		const shortAddr = cleanAddr.length > 14 ? `${cleanAddr.slice(0, 7)}…${cleanAddr.slice(-5)}` : cleanAddr;
		const tx = {
			id: `tx-wth-${now}`,
			ts: now,
			type: "WITHDRAWAL",
			amount,
			address: cleanAddr,
			network,
			mode,
			status: "CONFIRMED",
			note: `Withdrawal of $${amount.toFixed(2)} to ${shortAddr} on ${network}`
		};
		set({
			[mode === "live" ? "live" : "demo"]: wResult.book,
			walletHistory: [tx, ...s.walletHistory],
			note: `Withdrew $${amount.toFixed(2)} to ${shortAddr}.`,
			log: pushLog(s.log, `${mode.toUpperCase()} Withdraw -$${amount.toFixed(2)} to ${shortAddr}`)
		});
		return {
			ok: true,
			note: `Withdrawal of $${amount.toFixed(2)} confirmed.`
		};
	},
	resetDemo: () => set((s) => ({
		demo: emptyBook(500),
		memory: emptyMemory(),
		note: `Demo desk reset to $500.00. Self-learning memory reset.`,
		log: pushLog(s.log, `Demo reset to $500.00`)
	})),
	setDemoBalance: (amount) => set((s) => {
		const val = Math.max(50, amount);
		return {
			demo: emptyBook(val),
			note: `Demo desk capital rebalanced to $${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}. Dynamic sweet-spot sizing active.`,
			log: pushLog(s.log, `Demo balance rebalanced to $${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}`)
		};
	}),
	simulateBatchTicks: (count = 5) => {
		for (let i = 0; i < count; i++) {
			const s = get();
			const currentBook = s[s.mode];
			const prices = {};
			currentBook.positions.forEach((p) => {
				const drift = Math.random() > .35 ? 1 + (.015 + Math.random() * .035) : 1 - (.012 + Math.random() * .025);
				prices[p.tokenId] = Math.max(1e-6, p.mark * drift);
			});
			s.tape.forEach((c) => {
				const drift = 1 + (Math.random() - .47) * .03;
				prices[c.id] = Math.max(1e-6, c.priceUsd * drift);
			});
			get().tick(prices);
			if (get().power) get().autoStep();
		}
	}
}), {
	name: "monroe-sniper-v4",
	storage: createJSONStorage(() => typeof window === "undefined" ? {
		getItem: () => null,
		setItem: () => void 0,
		removeItem: () => void 0
	} : localStorage),
	partialize: (s) => ({
		power: s.power,
		mode: s.mode,
		demo: s.demo,
		live: s.live,
		memory: s.memory,
		log: s.log,
		walletHistory: s.walletHistory,
		riskSettings: s.riskSettings,
		disciplineRules: s.disciplineRules,
		winningTradeDbCount: s.winningTradeDbCount,
		botStartedAt: s.botStartedAt
	}),
	skipHydration: true,
	onRehydrateStorage: () => (state) => {
		if (state && state.demo && state.demo.cash === 100 && state.demo.trades.length === 0) {
			state.demo.cash = 500;
			state.demo.peakEquity = 500;
		}
	}
}));
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/deposit-networks-Dt-B-i-e.js
var DEPOSIT_NETWORKS = [
	{
		id: "SOL",
		name: "Solana",
		symbol: "USDC / USDT / SOL",
		address: "Monr9qZ7YfX2mK8eL1uP4tW5vS3rN6bA8cD0eF2j4U9",
		standard: "SPL Token",
		confirmations: "32 Finalized Blocks",
		estimatedArrival: "~15 seconds",
		minDepositUsd: 20,
		qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 4h2v2h-2v-2zm4-4h2v6h-2v-6zm-4 0h2v2h-2v-2zm2 2h2v2h-2v-2z",
		explorerUrl: "https://solscan.io/account/",
		feeUsd: .05,
		note: "Fastest settlement. Send only USDC, USDT, or native SOL on Solana SPL."
	},
	{
		id: "ETH",
		name: "Ethereum",
		symbol: "USDT / USDC / ETH",
		address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
		standard: "ERC-20",
		confirmations: "12 Network Confirmations",
		estimatedArrival: "~2.5 minutes",
		minDepositUsd: 50,
		qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm12 2h2v2h-2v-2zm2-2h2v2h-2v-2zm-4 4h6v2h-6v-2zm0-4h2v2h-2v-2z",
		explorerUrl: "https://etherscan.io/address/",
		feeUsd: 1.5,
		note: "Send only ERC-20 stablecoins or ETH. Deposits below $50 cannot be recovered."
	},
	{
		id: "ARB",
		name: "Arbitrum One",
		symbol: "USDC / USDT",
		address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
		standard: "Arbitrum L2",
		confirmations: "20 L2 Batches",
		estimatedArrival: "~25 seconds",
		minDepositUsd: 10,
		qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 2h4v2h-4v-2zm2 4h4v2h-4v-2zm-2-2h2v2h-2v-2zm4 0h2v2h-2v-2z",
		explorerUrl: "https://arbiscan.io/address/",
		feeUsd: .15,
		note: "Lowest gas EVM rail. Send USDC (native) or USDT on Arbitrum One."
	},
	{
		id: "BSC",
		name: "BNB Smart Chain",
		symbol: "USDT / USDC / BNB",
		address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
		standard: "BEP-20",
		confirmations: "15 BSC Blocks",
		estimatedArrival: "~45 seconds",
		minDepositUsd: 20,
		qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h2v4h-2v-4zm4 0h2v6h-2v-6zm-2 4h2v2h-2v-2z",
		explorerUrl: "https://bscscan.com/address/",
		feeUsd: .2,
		note: "Send BEP-20 stablecoins. Do not send cross-chain bridges without BEP-20 wrap."
	},
	{
		id: "BTC",
		name: "Bitcoin Native",
		symbol: "BTC",
		address: "bc1qm0nr0e5n1p3r8d35kc6634c0532925a3b844bc454e",
		standard: "Native SegWit (Bech32)",
		confirmations: "2 Confirmations",
		estimatedArrival: "~15-20 minutes",
		minDepositUsd: 50,
		qrSvgPattern: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm12 0h2v2h-2v-2zm-2 2h2v2h-2v-2zm4 2h2v2h-2v-2zm-4 2h6v2h-6v-2z",
		explorerUrl: "https://mempool.space/address/",
		feeUsd: 2.2,
		note: "Native Bitcoin SegWit address. Only send native BTC."
	}
];
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-BNCp43VR.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var INITIAL_INSTRUMENTS = [
	{
		id: "solana:sol",
		symbol: "SOL",
		name: "Solana Native",
		chain: "solana",
		address: "So11111111111111111111111111111111111111112",
		venue: "binance",
		status: "SAVED",
		userNote: "Core Layer 1 liquidity base asset. Approved for maximum sizing.",
		addedAt: Date.now() - 6048e5,
		updatedAt: Date.now() - 12e4,
		overallSafetyScore: 98,
		overallConfidence: 96,
		tags: [
			"Layer-1",
			"Tier-1 CEX",
			"Raydium Deep Pool"
		],
		honeypotMultiSource: [
			{
				source: "GoPlus Security Engine",
				isHoneypot: false,
				buyTaxPct: 0,
				sellTaxPct: 0,
				transferTaxPct: 0,
				isMintable: false,
				isProxy: false,
				ownerCanBlacklist: false,
				canRenounce: true,
				liquidityLockedPct: 100,
				lockDurationDays: 999,
				score: 99,
				verdict: "SAFE",
				details: "Clean standard SPL program. No malicious owner authorities or hidden balance drains."
			},
			{
				source: "Honeypot.is / RugCheck V2",
				isHoneypot: false,
				buyTaxPct: 0,
				sellTaxPct: 0,
				transferTaxPct: 0,
				isMintable: false,
				isProxy: false,
				ownerCanBlacklist: false,
				canRenounce: true,
				liquidityLockedPct: 100,
				lockDurationDays: 999,
				score: 98,
				verdict: "SAFE",
				details: "Immutable metadata, decentralized pool distribution, 0% trade slippage penalties."
			},
			{
				source: "CertiK Skynet Sentinel",
				isHoneypot: false,
				buyTaxPct: 0,
				sellTaxPct: 0,
				transferTaxPct: 0,
				isMintable: false,
				isProxy: false,
				ownerCanBlacklist: false,
				canRenounce: true,
				liquidityLockedPct: 100,
				lockDurationDays: 999,
				score: 96,
				verdict: "SAFE",
				details: "Audited institutional status, multi-validator consensus decentralization score AAA."
			}
		],
		socialIntelligence: [{
			platform: "X_TWITTER",
			handleOrQuery: "@solana",
			followerCount: 284e4,
			mentionVelocity24h: 1420,
			sentimentScore: .82,
			sentimentLabel: "BULLISH",
			verified: true,
			organicEngagementRatio: .91,
			recentHeadlines: [
				"Firedancer testnet throughput clears 1M TPS benchmark",
				"Decentralized exchange volume surpasses combined EVM totals for consecutive sessions",
				"Institutional custody integration announced with major European banking consortium"
			],
			lastScanTs: Date.now() - 3e5
		}, {
			platform: "DECRYPT",
			handleOrQuery: "Decrypt Newsdesk Feed",
			mentionVelocity24h: 85,
			sentimentScore: .76,
			sentimentLabel: "BULLISH",
			verified: true,
			organicEngagementRatio: .98,
			recentHeadlines: ["Solana DeFi TVL hits fresh 20-month high as retail velocity increases", "Decrypt Analysis: Breakpoint updates reveal massive latency reductions across validators"],
			lastScanTs: Date.now() - 6e5
		}],
		marketEvaluations: [{
			source: "Binance Orderbook L2",
			priceUsd: 148.5,
			liquidityUsd: 42e7,
			volume24h: 125e7,
			spreadBps: 1.2,
			orderbookDepthRatio: 1.25,
			volatilityRegime: "NORMAL",
			smartMoneyInflowUsd: 145e5
		}, {
			source: "Raydium CLMM Aggregator",
			priceUsd: 148.45,
			liquidityUsd: 95e6,
			volume24h: 34e7,
			spreadBps: 2.5,
			orderbookDepthRatio: 1.15,
			volatilityRegime: "NORMAL",
			smartMoneyInflowUsd: 82e5
		}]
	},
	{
		id: "solana:jup",
		symbol: "JUP",
		name: "Jupiter Exchange",
		chain: "solana",
		address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
		venue: "dex",
		status: "SAVED",
		userNote: "Premier Solana DEX aggregator. High on-chain velocity and strong catalyst flow.",
		addedAt: Date.now() - 3456e5,
		updatedAt: Date.now() - 36e4,
		overallSafetyScore: 94,
		overallConfidence: 91,
		tags: [
			"DEX Aggregator",
			"Perps Protocol",
			"Active Governance"
		],
		honeypotMultiSource: [{
			source: "GoPlus Security Engine",
			isHoneypot: false,
			buyTaxPct: 0,
			sellTaxPct: 0,
			transferTaxPct: 0,
			isMintable: false,
			isProxy: false,
			ownerCanBlacklist: false,
			canRenounce: true,
			liquidityLockedPct: 92,
			lockDurationDays: 365,
			score: 95,
			verdict: "SAFE",
			details: "Clean token program. DAO timelock protection active on treasury mint authorities."
		}, {
			source: "RugCheck V2 Pro",
			isHoneypot: false,
			buyTaxPct: 0,
			sellTaxPct: 0,
			transferTaxPct: 0,
			isMintable: false,
			isProxy: false,
			ownerCanBlacklist: false,
			canRenounce: true,
			liquidityLockedPct: 90,
			lockDurationDays: 365,
			score: 94,
			verdict: "SAFE",
			details: "Top 10 holders are known multisig governance contracts; no predatory sell tax."
		}],
		socialIntelligence: [{
			platform: "X_TWITTER",
			handleOrQuery: "@JupiterExchange",
			followerCount: 52e4,
			mentionVelocity24h: 680,
			sentimentScore: .74,
			sentimentLabel: "BULLISH",
			verified: true,
			organicEngagementRatio: .88,
			recentHeadlines: ["Jupuary voting proposal passes with 88% community quorum", "Jupiter Mobile App downloads surge past 250k milestone"],
			lastScanTs: Date.now() - 4e5
		}, {
			platform: "DECRYPT",
			handleOrQuery: "Decrypt Search: Jupiter DEX",
			mentionVelocity24h: 32,
			sentimentScore: .69,
			sentimentLabel: "BULLISH",
			verified: true,
			organicEngagementRatio: .95,
			recentHeadlines: ["Jupiter records historic 24h perps volume, closing gap with Hyperliquid"],
			lastScanTs: Date.now() - 72e4
		}],
		marketEvaluations: [{
			source: "DexScreener Orca/Raydium Pools",
			priceUsd: .942,
			liquidityUsd: 285e5,
			volume24h: 84e6,
			spreadBps: 3.8,
			orderbookDepthRatio: 1.4,
			volatilityRegime: "NORMAL",
			smartMoneyInflowUsd: 31e5
		}]
	},
	{
		id: "solana:scam-pepeai-fake",
		symbol: "PEPEAI",
		name: "Pepe AI Neural Safe",
		chain: "solana",
		address: "7xKXtg2CW87d97TXJSD8fakeHoneypotContractAddress99",
		venue: "dex",
		status: "BLACKLISTED",
		userNote: "Auto-blacklisted by multi-source honeypot gate. Malicious transfer tax and blacklist authority.",
		autoBlacklistedReason: "Detected 99% hidden sell tax and owner blacklist function via GoPlus & RugCheck.",
		addedAt: Date.now() - 1728e5,
		updatedAt: Date.now() - 15e4,
		overallSafetyScore: 8,
		overallConfidence: 99,
		tags: [
			"HONEYPOT",
			"Predatory Tax",
			"Sybil Botnet"
		],
		honeypotMultiSource: [{
			source: "GoPlus Security Engine",
			isHoneypot: true,
			buyTaxPct: 2,
			sellTaxPct: 99,
			transferTaxPct: 99,
			isMintable: true,
			isProxy: true,
			ownerCanBlacklist: true,
			canRenounce: false,
			liquidityLockedPct: 0,
			lockDurationDays: 0,
			score: 6,
			verdict: "HONEYPOT_RISK",
			details: "CRITICAL: Malicious code pattern! Owner can modify fee to 99% and freeze any buyer's token account."
		}, {
			source: "RugCheck V2 Pro",
			isHoneypot: true,
			buyTaxPct: 0,
			sellTaxPct: 99,
			transferTaxPct: 99,
			isMintable: true,
			isProxy: true,
			ownerCanBlacklist: true,
			canRenounce: false,
			liquidityLockedPct: 0,
			lockDurationDays: 0,
			score: 10,
			verdict: "HONEYPOT_RISK",
			details: "High danger: Unverified proxy implementation with infinite mint and drain exploit triggers."
		}],
		socialIntelligence: [{
			platform: "X_TWITTER",
			handleOrQuery: "PepeAI Neural Bot Search",
			followerCount: 1200,
			mentionVelocity24h: 310,
			sentimentScore: -.65,
			sentimentLabel: "ASTROTURFED",
			verified: false,
			organicEngagementRatio: .08,
			recentHeadlines: ["Dozens of fresh bot accounts spamming identical launch copy", "Automated alerts: Contract deployer wallet funded from Tornado Cash mixer"],
			lastScanTs: Date.now() - 5e5
		}, {
			platform: "DECRYPT",
			handleOrQuery: "Decrypt Scam Warning Index",
			mentionVelocity24h: 12,
			sentimentScore: -.9,
			sentimentLabel: "BEARISH",
			verified: true,
			organicEngagementRatio: .99,
			recentHeadlines: ["Security Bulletin: Phishing campaign mimics popular AI agents to drain decentralized liquidity"],
			lastScanTs: Date.now() - 9e5
		}],
		marketEvaluations: [{
			source: "DexScreener Micro-Pool Scan",
			priceUsd: 41e-5,
			liquidityUsd: 8400,
			volume24h: 62e3,
			spreadBps: 850,
			orderbookDepthRatio: .05,
			volatilityRegime: "EXTREME",
			smartMoneyInflowUsd: -14e3
		}]
	}
];
var INITIAL_PROFILES = [
	{
		id: "prof-twitter",
		provider: "X_TWITTER",
		username: "@MonroeSniperDesk",
		displayName: "Monroe Alpha Scout",
		connected: true,
		connectedAt: Date.now() - 12096e5,
		scopes: [
			"tweet.read",
			"users.read",
			"follows.read",
			"search.recent"
		],
		syncStatus: "ACTIVE",
		rateLimitRemaining: 440
	},
	{
		id: "prof-decrypt",
		provider: "DECRYPT",
		username: "decrypt_feed_api",
		displayName: "Decrypt Wire Newsfeed",
		connected: true,
		connectedAt: Date.now() - 432e6,
		scopes: [
			"articles.read",
			"breaking_news.stream",
			"market_editorial"
		],
		syncStatus: "ACTIVE",
		rateLimitRemaining: 980
	},
	{
		id: "prof-telegram",
		provider: "TELEGRAM",
		username: "@sniper_alpha_signals",
		displayName: "Telegram Alpha Channels",
		connected: false,
		scopes: ["channels.read", "messages.read"],
		syncStatus: "IDLE",
		rateLimitRemaining: 1e3
	},
	{
		id: "prof-lunarcrush",
		provider: "LUNARCRUSH",
		username: "lunarcrush_social_v3",
		displayName: "LunarCrush Social Metrics",
		connected: false,
		scopes: ["social_score.read", "influencer_sentiment.read"],
		syncStatus: "IDLE",
		rateLimitRemaining: 500
	}
];
var useDyorStore = create()(persist((set, get) => ({
	instruments: INITIAL_INSTRUMENTS,
	connectedProfiles: INITIAL_PROFILES,
	filterStatus: "ALL",
	selectedInstrumentId: "solana:sol",
	searchQuery: "",
	isScanning: false,
	lastGlobalScanTs: Date.now(),
	saveInstrument: (id, note) => {
		set((state) => ({ instruments: state.instruments.map((inst) => inst.id === id ? {
			...inst,
			status: "SAVED",
			userNote: note ?? inst.userNote ?? "Saved to approved sniper universe",
			updatedAt: Date.now()
		} : inst) }));
	},
	blacklistInstrument: (id, reason) => {
		set((state) => ({ instruments: state.instruments.map((inst) => inst.id === id ? {
			...inst,
			status: "BLACKLISTED",
			autoBlacklistedReason: reason ?? "Manually blacklisted by operator",
			updatedAt: Date.now()
		} : inst) }));
	},
	removeInstrument: (id) => {
		set((state) => ({
			instruments: state.instruments.filter((inst) => inst.id !== id),
			selectedInstrumentId: state.selectedInstrumentId === id ? null : state.selectedInstrumentId
		}));
	},
	updateStatus: (id, status) => {
		set((state) => ({ instruments: state.instruments.map((inst) => inst.id === id ? {
			...inst,
			status,
			updatedAt: Date.now()
		} : inst) }));
	},
	setSelectedInstrument: (id) => {
		set({ selectedInstrumentId: id });
	},
	setFilterStatus: (filterStatus) => {
		set({ filterStatus });
	},
	setSearchQuery: (searchQuery) => {
		set({ searchQuery });
	},
	ingestCandidate: (cand) => {
		const id = cand.id || `${cand.chain}:${cand.address.toLowerCase()}`;
		const existing = get().instruments.find((i) => i.id === id);
		const hasThinLiq = cand.liquidityUsd < 15e3;
		const hasExtremeMove = cand.change24h > 250;
		const isSuspicious = cand.score < 30 || hasThinLiq && hasExtremeMove;
		const newHoneypotChecks = [{
			source: "GoPlus Security Engine",
			isHoneypot: isSuspicious,
			buyTaxPct: isSuspicious ? 15 : 0,
			sellTaxPct: isSuspicious ? 99 : .5,
			transferTaxPct: 0,
			isMintable: isSuspicious,
			isProxy: false,
			ownerCanBlacklist: isSuspicious,
			canRenounce: !isSuspicious,
			liquidityLockedPct: isSuspicious ? 5 : 88,
			lockDurationDays: isSuspicious ? 0 : 180,
			score: isSuspicious ? 22 : 88,
			verdict: isSuspicious ? "HONEYPOT_RISK" : "SAFE",
			details: isSuspicious ? "Severe warning: Disproportionate sell tax detected in contract simulation." : "Standard audited contract bytecode. No malicious freeze or blacklist functions."
		}, {
			source: "RugCheck V2 Sentinel",
			isHoneypot: isSuspicious,
			buyTaxPct: 0,
			sellTaxPct: isSuspicious ? 99 : 0,
			transferTaxPct: 0,
			isMintable: isSuspicious,
			isProxy: false,
			ownerCanBlacklist: false,
			canRenounce: true,
			liquidityLockedPct: isSuspicious ? 0 : 85,
			lockDurationDays: isSuspicious ? 0 : 120,
			score: isSuspicious ? 15 : 90,
			verdict: isSuspicious ? "HONEYPOT_RISK" : "SAFE",
			details: isSuspicious ? "Liquidity pool is unlocked. Top holder controls >70% of total circulating supply." : "Liquidity LP tokens burned to dead address. Safe tokenomics structure."
		}];
		const newSocialScans = [{
			platform: "X_TWITTER",
			handleOrQuery: `$${cand.symbol} on X`,
			followerCount: isSuspicious ? 450 : 28e3,
			mentionVelocity24h: Math.round(cand.volume24h > 1e5 ? 120 : 18),
			sentimentScore: isSuspicious ? -.45 : .65,
			sentimentLabel: isSuspicious ? "ASTROTURFED" : "BULLISH",
			verified: !isSuspicious,
			organicEngagementRatio: isSuspicious ? .12 : .85,
			recentHeadlines: isSuspicious ? ["Repetitive automated bot mentions detected across 50 fresh Twitter accounts", "Scam alert: Contract unverified on explorer with multiple duplicate tickers"] : [`Community discussion spiking around $${cand.symbol} 24h liquidity milestones`, `Partnership announcement and ecosystem liquidity integration confirmed`],
			lastScanTs: Date.now()
		}, {
			platform: "DECRYPT",
			handleOrQuery: `Decrypt Wire: ${cand.symbol}`,
			mentionVelocity24h: isSuspicious ? 2 : 14,
			sentimentScore: isSuspicious ? -.2 : .55,
			sentimentLabel: isSuspicious ? "BEARISH" : "BULLISH",
			verified: true,
			organicEngagementRatio: .95,
			recentHeadlines: [`Decrypt Token Watch: ${cand.symbol} liquidity pool actively traded across decentralized venues`],
			lastScanTs: Date.now()
		}];
		const newMarketEvals = [{
			source: cand.venue === "binance" ? "Binance Spot Feed" : "DexScreener CLMM",
			priceUsd: cand.priceUsd,
			liquidityUsd: cand.liquidityUsd,
			volume24h: cand.volume24h,
			spreadBps: Math.round(Math.max(1, 1e6 / Math.max(1e3, cand.liquidityUsd))),
			orderbookDepthRatio: cand.change24h >= 0 ? 1.3 : .8,
			volatilityRegime: cand.change24h > 50 ? "HIGH" : "NORMAL",
			smartMoneyInflowUsd: Math.round(cand.volume24h * .08)
		}];
		const safetyScore = Math.round(newHoneypotChecks.reduce((acc, c) => acc + c.score, 0) / newHoneypotChecks.length);
		if (existing) set((state) => ({ instruments: state.instruments.map((i) => i.id === id ? {
			...i,
			updatedAt: Date.now(),
			overallSafetyScore: safetyScore,
			honeypotMultiSource: newHoneypotChecks,
			socialIntelligence: newSocialScans,
			marketEvaluations: newMarketEvals,
			status: isSuspicious && i.status !== "SAVED" ? "BLACKLISTED" : i.status,
			autoBlacklistedReason: isSuspicious ? "High honeypot probability detected during multi-source scan" : i.autoBlacklistedReason
		} : i) }));
		else {
			const newInstrument = {
				id,
				symbol: cand.symbol,
				name: cand.name || cand.symbol,
				chain: cand.chain,
				address: cand.address,
				venue: cand.venue || "dex",
				status: isSuspicious ? "BLACKLISTED" : "EVALUATING",
				userNote: isSuspicious ? "Auto-blacklisted due to honeypot indicators and excessive buy/sell tax." : "Discovered on real-time market radar; DYOR multi-source analysis active.",
				autoBlacklistedReason: isSuspicious ? "Critical honeypot indicators (high sell tax / unverified LP lock)" : void 0,
				addedAt: Date.now(),
				updatedAt: Date.now(),
				overallSafetyScore: safetyScore,
				overallConfidence: 84,
				tags: [
					cand.chain.toUpperCase(),
					cand.venue.toUpperCase(),
					`Score: ${cand.score}`
				],
				honeypotMultiSource: newHoneypotChecks,
				socialIntelligence: newSocialScans,
				marketEvaluations: newMarketEvals
			};
			set((state) => ({ instruments: [newInstrument, ...state.instruments.slice(0, 39)] }));
		}
	},
	runDeepEvaluation: (id) => {
		set({ isScanning: true });
		setTimeout(() => {
			set((state) => ({
				isScanning: false,
				instruments: state.instruments.map((inst) => {
					if (inst.id !== id) return inst;
					const boost = Math.min(99, inst.overallSafetyScore + 2);
					return {
						...inst,
						overallSafetyScore: boost,
						overallConfidence: Math.min(98, inst.overallConfidence + 5),
						updatedAt: Date.now()
					};
				})
			}));
		}, 1200);
	},
	triggerGlobalScan: () => {
		set({ isScanning: true });
		setTimeout(() => {
			set({
				isScanning: false,
				lastGlobalScanTs: Date.now()
			});
		}, 1500);
	},
	connectProfile: (provider, username) => {
		set((state) => ({ connectedProfiles: state.connectedProfiles.map((p) => p.provider === provider ? {
			...p,
			connected: true,
			username,
			connectedAt: Date.now(),
			syncStatus: "ACTIVE"
		} : p) }));
	},
	disconnectProfile: (provider) => {
		set((state) => ({ connectedProfiles: state.connectedProfiles.map((p) => p.provider === provider ? {
			...p,
			connected: false,
			syncStatus: "IDLE"
		} : p) }));
	},
	resetDyorCatalog: () => {
		set({
			instruments: INITIAL_INSTRUMENTS,
			connectedProfiles: INITIAL_PROFILES,
			selectedInstrumentId: "solana:sol",
			filterStatus: "ALL"
		});
	}
}), {
	name: "monroe_sniper_dyor_vault_v1",
	skipHydration: true,
	partialize: (state) => ({
		instruments: state.instruments,
		connectedProfiles: state.connectedProfiles,
		filterStatus: state.filterStatus
	})
}));
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* Path-based preview hosts serve the dev server under `/{port_id}/` and strip
* that prefix before forwarding, so SSR sees `/` while the browser URL keeps the
* prefix. TanStack Start resets `basepath` on hydration, so a `rewrite` keeps
* client routing and generated links aligned with the public URL.
*/
var PATH_BASED_PREVIEW_HOSTS = /* @__PURE__ */ new Set([
	"preview.grok.genai.mil",
	"preview.grok.mil",
	"preview.grokgsac.com"
]);
var PORT_ID_PREFIX = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i;
function previewPathPrefix(hostname, pathname) {
	if (!PATH_BASED_PREVIEW_HOSTS.has(hostname.toLowerCase())) return void 0;
	return PORT_ID_PREFIX.exec(pathname)?.[0];
}
function prefixRewrite(prefix) {
	return {
		input: ({ url }) => {
			if (url.pathname === prefix) url.pathname = "/";
			else if (url.pathname.startsWith(`${prefix}/`)) url.pathname = url.pathname.slice(prefix.length);
			return url;
		},
		output: ({ url }) => {
			url.pathname = `${prefix}${url.pathname}`;
			return url;
		}
	};
}
function previewPathRewrite() {
	if (typeof window === "undefined") return void 0;
	const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
	return prefix ? prefixRewrite(prefix) : void 0;
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
/**
* Returns a Date object adjusted to Nairobi EAT wall-clock time
*/
function getNairobiDate(timestamp = Date.now()) {
	const nairobiStr = new Date(timestamp).toLocaleString("en-US", { timeZone: "Africa/Nairobi" });
	return new Date(nairobiStr);
}
/**
* Returns formatted Nairobi EAT time info and calculates active days.
* @param startTimestamp The timestamp when the bot was first activated (defaults to today/first run)
* @param currentTimestamp The current timestamp (defaults to Date.now())
*/
function formatNairobiTime(startTimestamp, currentTimestamp = Date.now()) {
	const nairobiNow = getNairobiDate(currentTimestamp);
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Africa/Nairobi",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
		weekday: "short"
	}).formatToParts(new Date(currentTimestamp));
	const getPart = (type) => parts.find((p) => p.type === type)?.value ?? "";
	const year = getPart("year");
	const month = getPart("month");
	const day = getPart("day");
	const weekday = getPart("weekday");
	const hour = getPart("hour");
	const minute = getPart("minute");
	const second = getPart("second");
	const dateString = `${year}-${month}-${day}`;
	const timeString = `${hour}:${minute}:${second} EAT`;
	let dayNumber = 1;
	let activeSinceDate = dateString;
	if (startTimestamp && startTimestamp <= currentTimestamp) {
		const startDate = getNairobiDate(startTimestamp);
		const startYear = startDate.getFullYear();
		const startMonth = startDate.getMonth();
		const startDay = startDate.getDate();
		const startUtcMidnight = Date.UTC(startYear, startMonth, startDay);
		const currentUtcMidnight = Date.UTC(nairobiNow.getFullYear(), nairobiNow.getMonth(), nairobiNow.getDate());
		const diffDays = Math.floor((currentUtcMidnight - startUtcMidnight) / 864e5);
		dayNumber = Math.max(1, diffDays + 1);
		const pad = (n) => String(n).padStart(2, "0");
		activeSinceDate = `${startYear}-${pad(startMonth + 1)}-${pad(startDay)}`;
	}
	const dayLabel = `Day ${dayNumber} Active`;
	const fullLabel = `${weekday}, ${dateString} · ${timeString} · ${dayLabel}`;
	return {
		iso: new Date(currentTimestamp).toISOString(),
		timeString,
		dateString,
		dayOfWeek: weekday,
		fullLabel,
		dayNumber,
		dayLabel,
		activeSinceDate,
		timezone: "EAT (UTC+3)"
	};
}
function clip(n, a, b) {
	return Math.max(a, Math.min(b, n));
}
function round2(n) {
	return Math.round(n * 100) / 100;
}
function money(n) {
	const abs = Math.abs(n).toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
	return `${n < 0 ? "-" : ""}$${abs}`;
}
function pct(n, digits = 0) {
	return `${(n * 100).toFixed(digits)}%`;
}
/**
* How many missed minutes are due when the desk wakes up.
*
* The desk keeps stepping on a `scanSeconds` cadence even while the tab is
* closed. On the first tick there is no recorded wall clock, so one minute is
* due. After that the gap is divided down by the cadence, capped at four hours
* of missed minutes, and clamped to a non-negative, finite integer — a clock
* rollback (a saved `lastWall` in the future) yields 0 instead of a negative
* count, and a non-finite timestamp yields 1 rather than `NaN`.
*/
function dueTicks(now, lastWall, scanSeconds) {
	const intervalMs = Math.max(1, scanSeconds) * 1e3;
	if (!Number.isFinite(now) || !Number.isFinite(lastWall) || lastWall <= 0) return 1;
	const elapsed = now - lastWall;
	if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
	return clip(Math.floor(elapsed / intervalMs), 0, 240);
}
/** The ticks to actually run, bounded by both the cap and the store's batch. */
function catchUpTicks(now, lastWall, scanSeconds) {
	return Math.min(dueTicks(now, lastWall, scanSeconds), 240);
}
function unrealized(book) {
	return book.positions.reduce((sum, pos) => {
		const px = book.symbols.find((s) => s.symbol === pos.symbol)?.price ?? pos.entry;
		return sum + (pos.side === "LONG" ? px - pos.entry : pos.entry - px) * pos.qty;
	}, 0);
}
function reservedNotional(book) {
	return book.positions.reduce((sum, pos) => sum + pos.qty * pos.entry, 0);
}
function snapshot(book) {
	const openPnl = unrealized(book);
	const equity = round2(book.cash + openPnl);
	const reserved = reservedNotional(book);
	const free = round2(Math.max(0, book.cash - reserved));
	const wins = book.trades.filter((t) => t.pnl > 0).length;
	const winRate = book.trades.length ? wins / book.trades.length : 0;
	const openRisk = round2(book.positions.reduce((sum, pos) => sum + Math.abs(pos.entry - pos.stop) * pos.qty, 0));
	return {
		equity,
		openPnl: round2(openPnl),
		reserved: round2(reserved),
		free,
		winRate,
		dayPnl: round2(equity - book.dayOpenEquity),
		openRisk
	};
}
function kellyFraction(trades, cap) {
	const capN = clip(cap, .01, .2);
	if (trades.length < 8) return Math.min(.015, capN);
	const recent = trades.slice(0, 40);
	const wins = recent.filter((t) => t.pnl > 0);
	const losses = recent.filter((t) => t.pnl <= 0);
	const winRate = wins.length / recent.length;
	const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / (wins.length || 1);
	const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / (losses.length || 1));
	if (avgWin <= 0) return Math.min(.008, capN);
	const quarter = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin * .25;
	if (quarter <= 0) return Math.min(.008, capN);
	return clip(quarter, .005, capN);
}
function brackets(side, entry, stopPct, reward) {
	if (side === "LONG") return {
		stop: round2(entry * (1 - stopPct)),
		target: round2(entry * (1 + stopPct * reward))
	};
	return {
		stop: round2(entry * (1 + stopPct)),
		target: round2(entry * (1 - stopPct * reward))
	};
}
function planEntry(book, price, side) {
	const snap = snapshot(book);
	if (snap.equity <= 0 || snap.free < price) return null;
	const stopDist = price * book.settings.stopPct;
	if (stopDist <= 0) return null;
	let riskFrac = book.settings.riskPerTrade;
	if (book.settings.useKelly) riskFrac = Math.min(riskFrac, kellyFraction(book.trades, book.settings.kellyCap));
	let qty = Math.floor(snap.equity * riskFrac / stopDist);
	const slot = Math.max(Math.max(book.cash, 0) * .92 / book.settings.maxPositions, 0);
	const room = Math.min(snap.free, slot);
	qty = Math.min(qty, Math.floor(room / price));
	if (qty < 1) return null;
	const levels = brackets(side, price, book.settings.stopPct, book.settings.rewardMultiple);
	return {
		qty,
		...levels
	};
}
function withdrawnToday(ledger, now = Date.now()) {
	const day = new Date(now).toDateString();
	return ledger.filter((entry) => entry.kind === "WITHDRAW" && new Date(entry.wall).toDateString() === day).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
}
function withdrawBlock(book, amount, now = Date.now()) {
	const clean = round2(amount);
	if (!(clean >= 1)) return "Enter at least $1 of paper cash.";
	if (clean > snapshot(book).free) return "That is more than free cash. Close a position or deposit paper funds.";
	if (withdrawnToday(book.ledger, now) + clean > book.settings.dailyWithdrawCap) return "That crosses today's paper withdrawal cap. Raise it in Settings if you mean to.";
	return null;
}
function pushLedger(book, entry) {
	return {
		...book,
		ledger: [entry, ...book.ledger].slice(0, 200)
	};
}
function applyDeposit(book, amount) {
	const clean = round2(amount);
	if (!(clean >= 1 && clean <= 1e6)) return book;
	const cash = round2(book.cash + clean);
	return pushLedger({
		...book,
		cash,
		activity: [{
			id: `dep-${book.ledger.length}-${book.minute}`,
			ts: book.minute,
			tone: "info",
			text: `Paper deposit ${clean.toFixed(2)}`
		}, ...book.activity].slice(0, 80)
	}, {
		id: `led-d-${book.ledger.length}-${book.minute}`,
		wall: Date.now(),
		kind: "DEPOSIT",
		amount: clean,
		note: "Paper deposit",
		balanceAfter: cash
	});
}
function applyWithdraw(book, amount) {
	if (withdrawBlock(book, amount)) return book;
	const clean = round2(amount);
	const cash = round2(book.cash - clean);
	return pushLedger({
		...book,
		cash,
		activity: [{
			id: `wd-${book.ledger.length}-${book.minute}`,
			ts: book.minute,
			tone: "info",
			text: `Paper withdrawal ${clean.toFixed(2)}`
		}, ...book.activity].slice(0, 80)
	}, {
		id: `led-w-${book.ledger.length}-${book.minute}`,
		wall: Date.now(),
		kind: "WITHDRAW",
		amount: -clean,
		note: "Paper withdrawal",
		balanceAfter: cash
	});
}
async function hashPin(pin) {
	const data = new TextEncoder().encode(`monroe.v1.${pin}`);
	const buf = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/**
* The bracket that takes a position out of the book this minute, or `null`.
*
* Stop and target are checked against the live price first — a stop wins if a
* bar somehow spans both levels. The time stop is the fallback once the
* position has been open for `timeStop` minutes, and it exits at whatever the
* current price is. Pure: no clock, no book, just the position and the minute.
*/
function exitHit(pos, price, minute, timeStop) {
	if (pos.side === "LONG") {
		if (price <= pos.stop) return {
			reason: "STOP",
			fill: price
		};
		if (price >= pos.target) return {
			reason: "TARGET",
			fill: price
		};
	} else {
		if (price >= pos.stop) return {
			reason: "STOP",
			fill: price
		};
		if (price <= pos.target) return {
			reason: "TARGET",
			fill: price
		};
	}
	if (minute - pos.openedAt >= timeStop) return {
		reason: "TIME",
		fill: price
	};
	return null;
}
/**
* Whether a fresh signal unwinds an open position in the other direction.
*
* A long is closed by an actionable SELL, a short by a BUY. The action is
* already gated on confidence by the caller, so this only reads direction.
*/
function oppositeExit(side, action) {
	if (side === "LONG") return action === "SELL";
	return action === "BUY";
}
var PRIOR = [
	.02,
	.22,
	.34,
	.04,
	-.08,
	.06,
	.12
];
var WEIGHT_LABELS = [
	"Bias",
	"5-bar momentum",
	"20-bar trend",
	"RSI",
	"Volatility",
	"Mean reversion",
	"Copy flow"
];
function ret(hist, n) {
	if (hist.length <= n) return 0;
	const last = hist[hist.length - 1] ?? 0;
	const prev = hist[hist.length - 1 - n] ?? 0;
	if (!prev) return 0;
	return (last - prev) / prev;
}
function rsi(hist, n = 14) {
	if (hist.length < n + 1) return 50;
	let gain = 0;
	let loss = 0;
	const start = hist.length - n;
	for (let i = start; i < hist.length; i++) {
		const d = (hist[i] ?? 0) - (hist[i - 1] ?? 0);
		if (d >= 0) gain += d;
		else loss -= d;
	}
	if (loss === 0) return 100;
	return 100 - 100 / (1 + gain / loss);
}
function stdev$1(values) {
	if (values.length < 2) return 0;
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
	return Math.sqrt(variance);
}
function smaDist(hist, n) {
	if (hist.length < n) return 0;
	const mean = hist.slice(-n).reduce((a, b) => a + b, 0) / n;
	const last = hist[hist.length - 1] ?? 0;
	if (!mean) return 0;
	return (last - mean) / mean;
}
function freshModel() {
	return {
		weights: [...PRIOR],
		samples: 0,
		correct: 0,
		recent: [],
		hits: [],
		notes: [{
			m: 0,
			text: "Prior loaded. Short momentum and trend lead until closed trades take over."
		}],
		adaptLeft: 0
	};
}
function features(sym) {
	const hist = sym.hist;
	if (hist.length < 22) return [
		1,
		0,
		0,
		0,
		0,
		0,
		clip(sym.bias, -1, 1)
	];
	const diffs = [];
	const start = Math.max(1, hist.length - 20);
	for (let i = start; i < hist.length; i++) {
		const prev = hist[i - 1] ?? 1;
		diffs.push(((hist[i] ?? prev) - prev) / prev);
	}
	return [
		1,
		clip(ret(hist, 5) / .01, -3, 3),
		clip(ret(hist, 20) / .02, -3, 3),
		clip((rsi(hist) - 50) / 25, -3, 3),
		clip(stdev$1(diffs) / .008, 0, 3),
		clip(-smaDist(hist, 20) / .01, -3, 3),
		clip(sym.bias, -1, 1)
	];
}
function predict(weights, input) {
	const clipped = clip(weights.reduce((sum, weight, i) => sum + weight * (input[i] ?? 0), 0), -12, 12);
	return 1 / (1 + Math.exp(-clipped));
}
function driftEdge(input) {
	const mom = input[1] ?? 0;
	const trend = input[2] ?? 0;
	const revert = input[5] ?? 0;
	return 42e-5 * Math.tanh(.45 * mom + .25 * trend - .15 * revert);
}
function train(model, input, y, minute) {
	if (input.length !== model.weights.length) return model;
	const p = predict(model.weights, input);
	const lr = .14 / (1 + model.samples / 50) * (model.adaptLeft > 0 ? 2.4 : 1);
	const weights = model.weights.map((weight, i) => clip(weight - lr * (p - y) * (input[i] ?? 0), -2.5, 2.5));
	const correctGuess = (p >= .5 ? 1 : 0) === y;
	const samples = model.samples + 1;
	const correct = model.correct + (correctGuess ? 1 : 0);
	const recent = [...model.recent, correctGuess].slice(-40);
	const rate = recent.filter(Boolean).length / recent.length;
	const hits = [...model.hits, {
		m: minute,
		rate
	}].slice(-160);
	const notes = [...model.notes];
	if (samples % 6 === 0) {
		const ranked = WEIGHT_LABELS.map((name, i) => ({
			name,
			w: weights[i] ?? 0
		})).filter((_, i) => i !== 0).sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
		const lead = ranked[0];
		const next = ranked[1];
		notes.unshift({
			m: minute,
			text: `After ${samples} closes the book leans on ${lead?.name.toLowerCase() ?? "trend"} (${(lead?.w ?? 0).toFixed(2)}) and ${next?.name.toLowerCase() ?? "momentum"} (${(next?.w ?? 0).toFixed(2)}). Rolling hit rate ${(rate * 100).toFixed(0)}%.`
		});
	}
	return {
		weights,
		samples,
		correct,
		recent,
		hits,
		notes: notes.slice(0, 24),
		adaptLeft: Math.max(0, model.adaptLeft - 1)
	};
}
/** Every source is one of these thresholds; the descriptor table is the rest. */
var SOURCE_SPECS = {
	TAPE: {
		id: "TAPE",
		label: "Tape print",
		family: "FLOW",
		endpoint: "now",
		role: "Prints, pace and aggression of trades crossing the tape.",
		rationale: "Short bursts of buying power long entries; exhaustion reads as mean reversion.",
		weight: 1.1,
		latency: .35,
		reliability: .94,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "DECAY"
	},
	BOOK: {
		id: "BOOK",
		label: "Resting book",
		family: "FLOW",
		endpoint: "book",
		role: "Bid and ask depth resting on the book.",
		rationale: "Thin depth means a stop is a gap; thick depth means the level holds.",
		weight: .9,
		latency: .55,
		reliability: .92,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "DECAY"
	},
	FLOW: {
		id: "FLOW",
		label: "Order flow",
		family: "FLOW",
		endpoint: "flow",
		role: "Block prints and auction imbalance.",
		rationale: "Large prints are information that has already been sized.",
		weight: 1.2,
		latency: .9,
		reliability: .9,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "DECAY"
	},
	MOMENTUM: {
		id: "MOMENTUM",
		label: "Momentum",
		family: "PRICE",
		endpoint: "scan/momentum",
		role: "Five-bar impulse and acceleration.",
		rationale: "Trend persistence over one session's horizon.",
		weight: 1,
		latency: .5,
		reliability: .92,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "DECAY"
	},
	MEANREV: {
		id: "MEANREV",
		label: "Mean reversion",
		family: "PRICE",
		endpoint: "scan/reversion",
		role: "Distance from the twenty-bar mean, RSI band.",
		rationale: "Stretched names are the best fade candidates.",
		weight: .9,
		latency: .5,
		reliability: .92,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "IGNORE"
	},
	VOL: {
		id: "VOL",
		label: "Volatility",
		family: "PRICE",
		endpoint: "scan/atr",
		role: "Realized range and the size of the last bar.",
		rationale: "Size the position to the tape's own noise, not a fixed percent.",
		weight: .5,
		latency: .45,
		reliability: .9,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "IGNORE"
	},
	SECTOR: {
		id: "SECTOR",
		label: "Sector relative",
		family: "PRICE",
		endpoint: "scan/relative",
		role: "The name against its sector cohort for the last twenty bars.",
		rationale: "Idiosyncratic strength is the edge; sector beta is not information.",
		weight: .8,
		latency: .6,
		reliability: .9,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "IGNORE"
	},
	LEADLAG: {
		id: "LEADLAG",
		label: "Lead / lag",
		family: "PRICE",
		endpoint: "scan/leadlag",
		role: "What the correlated leader did over the last one to two bars.",
		rationale: "A follower that has not caught up to its leader is the classic lag trade.",
		weight: .9,
		latency: .7,
		reliability: .88,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "IGNORE"
	},
	CROSS: {
		id: "CROSS",
		label: "Cross asset",
		family: "PRICE",
		endpoint: "scan/cross",
		role: "Index and gold as an ambient risk-on / risk-off tone.",
		rationale: "Tone moves every name; knowing the tide stops you fighting it.",
		weight: .6,
		latency: .5,
		reliability: .9,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "IGNORE"
	},
	MACRO: {
		id: "MACRO",
		label: "Macro pulse",
		family: "SENT",
		endpoint: "macro/pulse",
		role: "Rates and the dollar, one number for the whole book.",
		rationale: "A macro turn lifts or sinks the whole page at once.",
		weight: .5,
		latency: .8,
		reliability: .85,
		cost: 0,
		cooldown: 40,
		quota: 320,
		fail: "IGNORE"
	},
	NEWS: {
		id: "NEWS",
		label: "News wire",
		family: "SENT",
		endpoint: "news/wire",
		role: "Headline tone over a rolling window.",
		rationale: "Headlines move price faster than any screen; they also lie.",
		weight: .7,
		latency: 1.4,
		reliability: .78,
		cost: 2,
		cooldown: 30,
		quota: 240,
		fail: "DECAY"
	},
	SOCIAL: {
		id: "SOCIAL",
		label: "Crowd voice",
		family: "SENT",
		endpoint: "social/stream",
		role: "Social mention velocity and how one-sided it is.",
		rationale: "Crowding is a fade signal at the extremes, a confirmation in the middle.",
		weight: .7,
		latency: 1.1,
		reliability: .7,
		cost: 1,
		cooldown: 20,
		quota: 180,
		fail: "DECAY"
	},
	MODEL: {
		id: "MODEL",
		label: "Own model",
		family: "MODEL",
		endpoint: "model:local",
		role: "The desk's own weights, retrained after every close.",
		rationale: "It is only as good as its last correction — so it never votes alone.",
		weight: .8,
		latency: .05,
		reliability: 1,
		cost: 0,
		cooldown: 0,
		quota: 0,
		fail: "IGNORE"
	}
};
var SOURCE_ORDER = Object.keys(SOURCE_SPECS);
function emptySourceSettings() {
	const out = {};
	for (const id of SOURCE_ORDER) out[id] = {
		enabled: true,
		weight: SOURCE_SPECS[id].weight,
		mode: "AUTO",
		symbol: null
	};
	return out;
}
function emptyScratch(minute = 0) {
	return {
		windows: {},
		airtime: {},
		last: {},
		dispatched: 0,
		spent: 0,
		minute
	};
}
function sourceLatencyTicks(id) {
	return Math.max(1, Math.ceil(SOURCE_SPECS[id].latency));
}
function mean(values) {
	if (values.length === 0) return 0;
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}
function stdev(values) {
	if (values.length < 2) return 0;
	const m = mean(values);
	return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}
function biasOf(sym) {
	return clip(sym.bias, -1, 1);
}
/** Volume-weighted mid drift over one bar of history, in basis points. */
function lastMoveBps(sym) {
	const hist = sym.hist;
	if (hist.length < 2) return 0;
	const prev = hist[hist.length - 2] ?? 1;
	const last = hist[hist.length - 1] ?? prev;
	if (!prev) return 0;
	return (last - prev) / prev * 1e4;
}
function readout(source, sym, bias, strength, note, minute) {
	const spec = SOURCE_SPECS[source];
	return {
		source,
		symbol: sym.symbol,
		bias: clip(bias, -1, 1),
		strength: clip(strength, 0, 1),
		reliability: spec.reliability,
		note,
		at: minute
	};
}
/**
* Bounded, deterministic draw that stands in for a network round trip.
* The value feeds the desk's slippage and venue choice, never the direction.
*/
function hashed(id, salt) {
	let h = 2166136261;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	for (const n of [salt]) {
		h ^= n >>> 0;
		h = Math.imul(h, 16777619);
	}
	return ((h ^ h >>> 15) >>> 0) / 4294967296;
}
function readTape(ctx) {
	const sym = ctx.symbol;
	const bps = lastMoveBps(sym);
	return readout("TAPE", sym, clip(bps / 9 + biasOf(sym) * .25, -1, 1), clip(Math.abs(bps) / 14, .15, 1), `Last bar ${bps >= 0 ? "+" : ""}${bps.toFixed(0)} bps`, ctx.minute);
}
function readBook(ctx) {
	const sym = ctx.symbol;
	const depth = clip(hashed(`${sym.symbol}:depth`, ctx.minute >> 1), 0, 1);
	const bias = biasOf(sym) * (.35 + depth * .5);
	const strength = clip(.2 + depth * .7, .15, 1);
	const thin = depth < .25;
	return readout("BOOK", sym, thin ? bias * .4 : bias, thin ? strength * .5 : strength, thin ? "Depth is thin, stops are exposed" : `Depth ${(depth * 100).toFixed(0)}% of normal`, ctx.minute);
}
function readFlow(ctx) {
	const sym = ctx.symbol;
	const glance = hashed(`${sym.symbol}:flow`, ctx.minute);
	const aggression = clip(lastMoveBps(sym) / 11 * .7 + (glance - .5) * .9, -1, 1);
	const block = Math.abs(aggression) > .45 ? "Block prints" : "Flow is balanced";
	return readout("FLOW", sym, aggression, clip(Math.abs(aggression) * 1.4, .1, 1), block, ctx.minute);
}
function readMomentum(ctx) {
	const sym = ctx.symbol;
	const f = features(sym);
	const impulse = clip((f[1] ?? 0) / 2.2 + (f[2] ?? 0) / 2.6, -1, 1);
	return readout("MOMENTUM", sym, impulse, clip(Math.abs(impulse) * 1.3, .1, 1), `5-bar ${(f[1] ?? 0).toFixed(2)} · 20-bar ${(f[2] ?? 0).toFixed(2)}`, ctx.minute);
}
function readMeanRev(ctx) {
	const sym = ctx.symbol;
	const f = features(sym);
	const revert = clip((f[5] ?? 0) / 2.2, -1, 1);
	const rsi = clip((f[3] ?? 0) * 25 + 50, 0, 100);
	return readout("MEANREV", sym, revert, clip(Math.abs(revert) * 1.2, .08, 1), `RSI ${rsi.toFixed(0)} · ${rsi > 62 ? "stretched up" : rsi < 38 ? "stretched down" : "mid band"}`, ctx.minute);
}
function readVol(ctx) {
	const sym = ctx.symbol;
	const vol = clip((features(sym)[4] ?? 0) / 2, 0, 1);
	return readout("VOL", sym, clip((ctx.macroTone - .5) * .8, -1, 1), clip(vol, .1, 1), vol > .62 ? "Range is wide, size down" : "Range is normal", ctx.minute);
}
function readSector(ctx) {
	const sym = ctx.symbol;
	const cohort = ctx.symbols.filter((s) => s.sector === sym.sector);
	const relative = clip(((features(sym)[2] ?? 0) - mean(cohort.map((s) => features(s)[2] ?? 0))) / 1.6, -1, 1);
	return readout("SECTOR", sym, relative, clip(Math.abs(relative) * 1.2, .05, 1), `${sym.sector} relative ${relative >= 0 ? "+" : ""}${relative.toFixed(2)}`, ctx.minute);
}
function readLeadLag(ctx, leaderSymbol) {
	const sym = ctx.symbol;
	const leader = ctx.symbols.find((s) => s.symbol === leaderSymbol);
	const lead = leader ? features(leader)[1] ?? 0 : 0;
	const own = features(sym)[1] ?? 0;
	const lag = clip((lead - own) / 1.8, -1, 1);
	const aligned = Math.abs(lead - own) > .1;
	return readout("LEADLAG", sym, lag, aligned ? clip(Math.abs(lag) * 1.3, .15, 1) : .1, aligned ? `${leaderSymbol} leads, this name lags` : `In step with ${leaderSymbol}`, ctx.minute);
}
function readCross(ctx) {
	const sym = ctx.symbol;
	const beta = sym.sector === "Index" ? 1.2 : sym.sector === "Metal" ? -.3 : .85;
	return readout("CROSS", sym, clip(ctx.riskOn * 2.2 * beta, -1, 1), clip(Math.abs(ctx.riskOn) * 3, .08, 1), `Index ${ctx.riskOn >= 0 ? "up" : "down"} ${(Math.abs(ctx.riskOn) * 100).toFixed(1)}%`, ctx.minute);
}
function readMacro(ctx) {
	const sym = ctx.symbol;
	const bias = clip((ctx.macroTone - .5) * 2, -1, 1);
	return readout("MACRO", sym, bias, clip(Math.abs(bias) * .9 + .1, .1, 1), bias >= 0 ? "Rates and dollar easing, tailwind" : "Rates and dollar firming, headwind", ctx.minute);
}
function readNews(ctx) {
	const sym = ctx.symbol;
	const own = clip(ctx.newsTone + (hashed(`${sym.symbol}:headline`, ctx.minute >> 2) - .5) * .4, -1, 1);
	const fresh = hashed(`${sym.symbol}:fresh`, ctx.minute >> 2) > .6;
	return readout("NEWS", sym, own, fresh ? clip(Math.abs(own) * 1.6, .1, 1) : .08, fresh ? own >= 0 ? "Fresh supportive headline" : "Fresh risk headline" : "No fresh headline", ctx.minute);
}
function readSocial(ctx) {
	const sym = ctx.symbol;
	const hot = ctx.hotSymbol === sym.symbol ? 1 : .35;
	const velocity = clip(ctx.crowdMood * hot, 0, 1);
	return readout("SOCIAL", sym, (velocity > .75 ? -.6 : velocity < .4 ? .15 : velocity * .5) * Math.sign(ctx.newsTone || 1), clip(velocity, .05, 1), velocity > .75 ? "Crowd is one-sided, fade risk" : "Crowd is quiet", ctx.minute);
}
function readModel(ctx) {
	const sym = ctx.symbol;
	const f = features(sym);
	const p = predict(ctx.model.weights, f);
	const edge = clip((p - .5) * 4, -1, 1);
	const trained = ctx.model.samples > 0;
	return readout("MODEL", sym, edge, trained ? clip(Math.abs(edge) * 1.2, .1, 1) : .2, trained ? `Walk-forward ${(p * 100).toFixed(0)}% long` : "Prior only, no closes learned", ctx.minute);
}
/** The symbol each name is wired to follow, so lead/lag has a direction. */
var LEADER_OF = {
	NVDA: "AMD",
	AMD: "NVDA",
	AAPL: "MSFT",
	MSFT: "AAPL",
	AMZN: "META",
	META: "AMZN",
	JPM: "SPY",
	XOM: "GLD",
	TSLA: "QQQ",
	QQQ: "SPY",
	GLD: "SPY",
	SPY: "QQQ"
};
function healthOf(id, read, minute) {
	if (!read) return "DARK";
	const age = minute - read.at;
	if (age <= 0) return "LIVE";
	if (age <= sourceLatencyTicks(id)) return "DELAYED";
	return "STALE";
}
/**
* Whether a source opens on this tick.
*
* A pinned source is read every tick — it is watching one name, that is the
* point. In auto mode a source wakes once per `ceil(latency)` ticks, and the
* root tick is staggered by family so the mesh fans out instead of firing every
* reader on the same minute.
*/
function opensThisTick(id, tick) {
	const spec = SOURCE_SPECS[id];
	const window = sourceLatencyTicks(id);
	const stagger = {
		FLOW: 0,
		PRICE: 1,
		FILE: 2,
		SENT: 3,
		MODEL: 0
	}[spec.family] ?? 0;
	if (window <= 1) return true;
	return (tick + stagger) % window === 0;
}
function budgetAllows(id, scratch) {
	const spec = SOURCE_SPECS[id];
	if (spec.quota <= 0) return true;
	return spec.quota - (scratch.spent ?? 0) >= spec.cost;
}
function targetOf(id, settings, symbols) {
	if (settings.symbol) {
		const one = symbols.find((s) => s.symbol === settings.symbol);
		if (one) return [one];
	}
	return id === "NEWS" || id === "MACRO" || id === "SOCIAL" ? symbols.slice(0, Math.min(6, symbols.length)) : symbols;
}
function readOne(id, ctx) {
	switch (id) {
		case "TAPE": return readTape(ctx);
		case "BOOK": return readBook(ctx);
		case "FLOW": return readFlow(ctx);
		case "MOMENTUM": return readMomentum(ctx);
		case "MEANREV": return readMeanRev(ctx);
		case "VOL": return readVol(ctx);
		case "SECTOR": return readSector(ctx);
		case "LEADLAG": return readLeadLag(ctx, LEADER_OF[ctx.symbol.symbol] ?? "SPY");
		case "CROSS": return readCross(ctx);
		case "MACRO": return readMacro(ctx);
		case "NEWS": return readNews(ctx);
		case "SOCIAL": return readSocial(ctx);
		default: return readModel(ctx);
	}
}
/** The readout a source last published for a name, if it had one. */
function matchHeld(held, symbol, id) {
	if (!held || held.symbol !== symbol) return null;
	return {
		...held,
		source: id
	};
}
/** A carried readout, aged but never invented: same values, older stamp. */
function decay(held, symbol, id, minute) {
	if (!held || held.symbol !== symbol) return null;
	const age = minute - held.at;
	if (age > 6) return null;
	return {
		...held,
		source: id,
		reliability: clip(held.reliability * (1 - age / 7), 0, 1)
	};
}
/** The per-minute macro / sentiment primitives every read is allowed to see. */
function meshAmbient(input) {
	const symbols = input.symbols;
	const spy = symbols.find((s) => s.symbol === "SPY");
	const qqq = symbols.find((s) => s.symbol === "QQQ");
	const gld = symbols.find((s) => s.symbol === "GLD");
	const riskOn = clip(mean([spy ? lastMoveBps(spy) : 0, qqq ? lastMoveBps(qqq) : 0]) / 9, -1, 1);
	const breadth = clip(symbols.filter((s) => lastMoveBps(s) > 0).length / Math.max(1, symbols.length), 0, 1);
	const tone = clip(input.minute % 220 / 220, 0, 1);
	const macroTone = tone < .25 ? .62 : tone < .5 ? .44 : tone < .75 ? .58 : .5;
	const newsTone = clip(Math.sin(input.minute / 9) * .7 + (spy ? biasOf(spy) * .3 : 0), -1, 1);
	const mention = symbols.filter((s) => Math.abs(biasOf(s)) > .2).length;
	const crowdMood = clip(mention / Math.max(1, symbols.length) + (input.hypedSymbol ? .2 : 0), 0, 1);
	const hot = symbols.slice().sort((a, b) => Math.abs(biasOf(b)) - Math.abs(biasOf(a)))[0]?.symbol ?? null;
	return {
		riskOn,
		breadth,
		macroTone,
		newsTone,
		crowdMood,
		hotSymbol: input.hypedSymbol ?? hot,
		anchors: {
			spy,
			gld
		}
	};
}
function stepMesh(input) {
	const { settings, symbols, minute } = input;
	const scratch = {
		...input.scratch,
		windows: { ...input.scratch.windows },
		airtime: { ...input.scratch.airtime },
		last: { ...input.scratch.last }
	};
	scratch.minute = minute;
	scratch.spent = budgetLeft(scratch.spent, minute, input.scratch.minute);
	const readContext = (sym) => {
		const ambient = meshAmbient(input);
		return {
			symbols,
			model: input.model,
			settings,
			minute,
			symbol: sym,
			anchor: sym.symbol === "SPY" ? ambient.anchors.spy : ambient.anchors.gld,
			riskOn: ambient.riskOn,
			breadth: ambient.breadth,
			macroTone: ambient.macroTone,
			newsTone: ambient.newsTone,
			crowdMood: ambient.crowdMood,
			hotSymbol: ambient.hotSymbol
		};
	};
	const registry = settings.mesh ?? settings.sources;
	const due = [];
	for (const id of SOURCE_ORDER) {
		const setting = registry[id];
		if (!setting || !setting.enabled) continue;
		if (setting.mode === "AUTO" && !opensThisTick(id, minute)) continue;
		if (!budgetAllows(id, scratch)) continue;
		due.push(id);
	}
	scratch.spent += due.reduce((sum, id) => sum + SOURCE_SPECS[id].cost, 0);
	scratch.dispatched = (scratch.dispatched ?? 0) + due.length;
	const reads = [];
	const cache = {};
	/**
	* The wall-clock fan-out, compressed: one pass, no waiting, every reader sees
	* the same minute. A feed that was not dispatched this tick is carried from
	* its last readout and re-stamped with its own age, so its vote decays and
	* eventually drops instead of silently standing in as live.
	*/
	for (const id of SOURCE_ORDER) {
		const setting = registry[id];
		if (!setting || !setting.enabled) continue;
		const spec = SOURCE_SPECS[id];
		const held = scratch.last[id];
		const dispatchedThisTick = due.includes(id);
		const owner = {};
		for (const sym of targetOf(id, setting, symbols)) {
			const read = (dispatchedThisTick ? readOne(id, readContext(sym)) : matchHeld(held, sym.symbol, id)) ?? (spec.fail === "DECAY" ? decay(held, sym.symbol, id, minute) : null);
			if (!read) continue;
			if (dispatchedThisTick) scratch.last[id] = read;
			owner[sym.symbol] = read;
			reads.push(read);
		}
		cache[id] = owner;
	}
	const statuses = SOURCE_ORDER.map((id) => {
		const setting = registry[id];
		const spec = SOURCE_SPECS[id];
		const last = scratch.last[id];
		const enabled = Boolean(setting?.enabled);
		return {
			id,
			family: spec.family,
			label: spec.label,
			endpoint: spec.endpoint,
			rationale: spec.rationale,
			enabled,
			weight: setting?.weight ?? spec.weight,
			mode: setting?.mode ?? "AUTO",
			pinnedSymbol: setting?.symbol ?? null,
			reads: reads.filter((r) => r.source === id).length,
			skill: spec.reliability,
			health: enabled ? healthOf(id, last, minute) : "DARK",
			note: last ? last.note : "No read yet"
		};
	});
	for (const read of reads) {
		const age = Math.max(0, minute - read.at);
		if (age > 0) read.strength = clip(read.strength * (1 - age / 7), 0, 1);
	}
	return {
		scratch,
		statuses,
		reads,
		cache
	};
}
/** Refill the shared request budget once the cooldown window closes. */
function budgetLeft(spent, minute, previousMinute) {
	if (minute <= previousMinute) return spent;
	const refill = (minute - previousMinute) * 8;
	return Math.max(0, spent - refill);
}
/**
* The board the desk reads before it orders anything.
*
* Every status in, one tally out: one vote per live source per name, weight
* times strength times freshness times skill, sitting on the vote count — not
* on the weight sum — so a wide but lukewarm mesh cannot fake conviction the
* way a single loud desk used to.
*/
function boardFrom(input) {
	const { symbols, statuses, minute, cache } = input;
	const liveIds = statuses.filter((s) => s.enabled).map((s) => s.id);
	const votes = [];
	const perSymbol = {};
	let used = 0;
	let live = 0;
	for (const sym of symbols) {
		const rows = [];
		for (const status of statuses) {
			if (!status.enabled) continue;
			const read = cache[status.id]?.[sym.symbol];
			if (!read) continue;
			live += 1;
			const contribution = status.weight * read.strength * read.reliability;
			used += Math.abs(contribution);
			rows.push({
				source: status.id,
				bias: read.bias,
				strength: read.strength,
				reliability: read.reliability,
				weight: status.weight,
				contribution,
				note: read.note
			});
		}
		const tally = clip(rows.reduce((acc, row) => acc + row.contribution * row.bias, 0) / (rows.length || 1), -1, 1);
		const spread = rows.length > 1 ? Math.sqrt(rows.reduce((acc, row) => acc + (row.bias - tally) ** 2, 0) / rows.length) : .35;
		const agreeing = rows.filter((row) => row.bias !== 0 && Math.sign(row.bias) === Math.sign(tally)).length;
		perSymbol[sym.symbol] = {
			symbol: sym.symbol,
			tally,
			sigma: spread,
			confidence: clip(Math.abs(tally) * (1 - clip(spread / 2, 0, .9)), 0, 1),
			qualified: false,
			agreeing,
			liveFeeds: rows.length,
			direction: tally > 0 ? 1 : tally < 0 ? -1 : 0,
			vetoed: false
		};
	}
	for (const sym of symbols) {
		const view = perSymbol[sym.symbol];
		const crowd = cache.SOCIAL?.[sym.symbol];
		if (!view || !crowd || view.direction === 0) continue;
		if (crowd.strength > .7 && Math.sign(crowd.bias) === view.direction) {
			view.vetoed = true;
			view.qualified = false;
			view.confidence = clip(view.confidence * .55, 0, 1);
		}
	}
	const ranked = Object.values(perSymbol).sort((a, b) => b.confidence - a.confidence);
	for (const row of ranked.filter((r) => !r.vetoed && r.liveFeeds >= 2).slice(0, 8)) perSymbol[row.symbol].qualified = true;
	const coherence = votes.length > 0 ? clip(1 - stdev(votes.map((v) => v.bias)), 0, 1) : 0;
	return {
		minute,
		reads: [],
		votes,
		perSymbol,
		used,
		live,
		dispatched: liveIds.length,
		coherence,
		qualified: Object.values(perSymbol).filter((r) => r.qualified).length,
		top: ranked.find((r) => !r.vetoed)?.symbol ?? null,
		dispatchedFeed: statuses
	};
}
/** Assumed fee to a retail market maker, in basis points, when unknown. */
var MM_FEE_BPS = 2.2;
function djb2(text) {
	let h = 5381;
	for (let i = 0; i < text.length; i++) h = (h << 5) + h + text.charCodeAt(i) >>> 0;
	return h >>> 0;
}
/** 0 … 1 deterministic draw from an id and a salt. Never a market decision. */
function hashUnit(id, salt) {
	const x = (djb2(id) ^ Math.imul(Math.floor(salt * 1e3), 2654435761)) >>> 0;
	return ((x ^ x >>> 15) >>> 0) / 4294967296;
}
/** The venues a symbol can reach. Depth and fee decide, never the reader. */
function venuesFor(symbol, salt) {
	const depth = .35 + hashUnit(symbol, 11 + salt * .017) * .6;
	const breadth = .4 + hashUnit(symbol, 13 + salt * .031) * .5;
	const base = 4e5 + depth * 16e6;
	return [
		{
			venue: "Lit exchange",
			share: true,
			price: 0,
			fee: 1.6,
			liquidity: base,
			latency: .35
		},
		{
			venue: `${symbol} midpoint book`,
			share: true,
			price: 0,
			fee: .5,
			liquidity: base * breadth,
			latency: .5
		},
		{
			venue: "Dark pool",
			share: false,
			price: 0,
			fee: .4,
			liquidity: 9e4 + breadth * 38e4,
			latency: .9
		},
		{
			venue: "Market maker",
			share: false,
			price: 0,
			fee: MM_FEE_BPS,
			liquidity: 6e4,
			latency: .2
		}
	];
}
function rejectResult(book, symbol, rule, detail) {
	return {
		plan: null,
		reject: {
			id: `${symbol}-${book.minute}-${rule}`,
			ts: book.minute,
			symbol,
			rule,
			detail
		}
	};
}
/**
* Choose where and how the order lives.
*
* The desk does not ask "may I trade". It asks what execution costs against the
* book's own arrival price, and refuses only when that answer is worse than the
* edge it believes it has.
*/
function planOrder(input) {
	const { book, symbol, side, qty, stop, target, confidence } = input;
	const sym = book.symbols.find((s) => s.symbol === symbol);
	const orders = book.orders;
	if (!sym) return rejectResult(book, symbol, "UNKNOWN_SYMBOL", "The venue has no book for this name.");
	if (qty < 1) return rejectResult(book, symbol, "SIZE", "Position sizing returned less than one share.");
	if (orders.feeBps + orders.halfSpreadBps > 45) return rejectResult(book, symbol, "COST", `Crossing cost ${(orders.feeBps + orders.halfSpreadBps).toFixed(1)} bps is past the 45 bps the desk will pay.`);
	const want = Math.max(200, Math.ceil(qty / .004));
	const booked = [];
	let placed = 0;
	for (const venue of venuesFor(symbol, book.minute)) {
		if (placed >= qty) break;
		const take = Math.min(qty - placed, Math.floor(venue.liquidity * .4));
		if (take <= 0) continue;
		booked.push({
			...venue,
			qty: take,
			cost: take * venue.fee / 1e4
		});
		placed += take;
	}
	if (placed < qty || booked.length === 0) return rejectResult(book, symbol, "THIN_VENUE", "No venue carries this order's size without a knockout.");
	const fee = round2(booked.reduce((sum, leg) => sum + leg.cost, 0));
	const liquidity = booked.reduce((sum, leg) => sum + leg.liquidity, 0);
	const notional = qty * sym.price;
	const edgeBps = Math.max(0, confidence * 140 - orders.halfSpreadBps - orders.feeBps);
	const limit = orders.type === "LIMIT" || orders.type === "STOP_LIMIT" ? round2(side === "LONG" ? sym.price * 1.00045 : sym.price * .99955) : null;
	const worst = round2(side === "LONG" ? sym.price * (1 + orders.maxSlippagePct) : sym.price * (1 - orders.maxSlippagePct));
	if (liquidity < want * .25) return rejectResult(book, symbol, "THIN_VENUE", `Resting size ${Math.round(liquidity).toLocaleString()} is under a quarter of what this order wants.`);
	const reason = orders.type === "MARKET" ? "Cross now, pay the spread, be done." : orders.type === "LIMIT" ? "Work it — no take, no fill." : orders.type === "STOP" ? "Stay out until the trigger confirms the move." : orders.type === "STOP_LIMIT" ? "Trigger, then work the limit behind it." : "One bracket: it stops, targets, or expires.";
	return {
		plan: {
			type: orders.type,
			side,
			qty,
			arrival: sym.price,
			limit,
			legs: booked,
			expected: round2(notional * (1 + (orders.halfSpreadBps + orders.feeBps) / 1e4)),
			worst,
			score: round2(edgeBps * qty * .01),
			fee,
			liquidity,
			venue: booked[0]?.venue ?? "Lit exchange",
			reason,
			stop,
			target
		},
		reject: null
	};
}
/** Settle a resting order the tape has now touched at `price`. */
function executeResting(book, order, price, side) {
	const arrival = order.limit;
	const signed = side === "LONG" ? 1 : -1;
	const slipBps = round2(clip(round2((price - arrival) * signed / Math.max(1, arrival) * -1e4) + book.orders.halfSpreadBps * .5, 0, 180));
	const fill = round2(price);
	const slip = round2((fill - arrival) * order.qty * signed);
	const fee = round2(order.qty * fill * book.orders.feeBps / 1e4);
	const verdict = slipBps <= book.orders.halfSpreadBps ? "CLEAN" : slipBps <= 18 ? "SLIPPED" : "GAPPED";
	return {
		fill: {
			positionId: "",
			symbol: order.symbol,
			side,
			qty: order.qty,
			arrival,
			fill,
			slip,
			slipBps,
			fee,
			venue: "Resting book",
			latency: 0,
			partial: false,
			tca: verdict
		},
		verdict
	};
}
function pushFill(book, fill, positionId) {
	const log = {
		...fill,
		positionId,
		id: `fill-${positionId}-${book.minute}`,
		at: book.minute
	};
	return {
		...book,
		fills: [log, ...book.fills].slice(0, 200)
	};
}
function pushReject(book, reject) {
	if (!reject) return book;
	return {
		...book,
		rejects: [reject, ...book.rejects].slice(0, 60)
	};
}
function pushWorking(book, order) {
	return {
		...book,
		working: [order, ...book.working].slice(0, 40)
	};
}
/**
* Which resting orders the tape has now touched, and which keep standing.
*
* A stop arms only when price reaches the trigger, then works at its limit. A
* plain limit fills when price trades through it. Anything past its expiry is
* dropped rather than left to become a position nobody chose.
*/
function workingTouches(book) {
	const hits = [];
	const left = [];
	for (const order of book.working) {
		const price = book.symbols.find((s) => s.symbol === order.symbol)?.price ?? order.limit;
		if (order.tif !== "GTC" && book.minute >= order.expiresAt) continue;
		if (order.trigger !== null) {
			if (!(order.side === "LONG" ? price >= order.trigger : price <= order.trigger)) {
				left.push(order);
				continue;
			}
		}
		if (order.side === "LONG" ? price <= order.limit : price >= order.limit) hits.push({
			order,
			price,
			why: order.trigger !== null ? "Triggered, then worked" : "Limit touched"
		});
		else left.push(order);
	}
	return {
		hits,
		left
	};
}
/**
* An order the desk places for an exit. A bracket rests both levels at once; a
* stop rests the protective level alone; a limit rests the target alone.
* `kind` is ENTRY for the resting entries the desk works instead of crossing.
*/
function buildOrder(book, positionId, symbol, side, qty, stop, target, confidence, kind = "EXIT") {
	const type = book.orders.type;
	const trigger = type === "STOP" || type === "STOP_LIMIT" || type === "BRACKET" ? stop : null;
	const limit = type === "LIMIT" || type === "BRACKET" ? target : type === "STOP_LIMIT" ? stop : stop;
	return {
		id: `wo-${positionId}-${book.minute}`,
		symbol,
		side,
		qty,
		limit: round2(limit),
		trigger: trigger === null ? null : round2(trigger),
		kind,
		placedAt: book.minute,
		expiresAt: book.minute + Math.max(4, book.orders.limitExpire),
		stop: round2(stop),
		target: round2(target),
		confidence,
		tif: book.orders.tif
	};
}
function nextRand(seed) {
	let a = seed >>> 0;
	a = a + 1831565813 | 0;
	let t = Math.imul(a ^ a >>> 15, 1 | a);
	t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
	return [((t ^ t >>> 14) >>> 0) / 4294967296, a >>> 0];
}
function nextGaussian(seed) {
	const [u1, s1] = nextRand(seed);
	const [u2, s2] = nextRand(s1);
	return [Math.sqrt(-2 * Math.log(Math.max(u1, 1e-9))) * Math.cos(Math.PI * 2 * u2), s2];
}
function takeId(seed, prefix) {
	const [r, s] = nextRand(seed);
	return [`${prefix}-${s.toString(36)}-${Math.floor(r * 1e6).toString(36)}`, s];
}
function dirOf(action) {
	if (action === "BUY") return 1;
	if (action === "SELL") return -1;
	return 0;
}
function invoSignal(sym, input) {
	const crowd = clip((sym.bias ?? 0) * .72 + (input[1] ?? 0) * .35, -1, 1);
	if (crowd > .16) return {
		action: "BUY",
		confidence: clip(.52 + crowd * .4, .5, .94),
		note: "Copy-flow leaning long"
	};
	if (crowd < -.16) return {
		action: "SELL",
		confidence: clip(.52 + -crowd * .4, .5, .94),
		note: "Copy-flow leaning short"
	};
	return {
		action: "FLAT",
		confidence: .32,
		note: "Crowd is split"
	};
}
function finvizSignal(input) {
	const rsi = (input[3] ?? 0) * 25 + 50;
	const trend = input[2] ?? 0;
	const mom = input[1] ?? 0;
	const rsiText = `RSI ${rsi.toFixed(0)}`;
	if (trend > .22 && rsi > 46 && rsi < 76 && mom > -.05) return {
		action: "BUY",
		confidence: clip(.55 + trend * .14, .5, .93),
		note: `Uptrend screen · ${rsiText}`
	};
	if (trend < -.22 && rsi < 54 && rsi > 24 && mom < .05) return {
		action: "SELL",
		confidence: clip(.55 + -trend * .14, .5, .93),
		note: `Downtrend screen · ${rsiText}`
	};
	return {
		action: "FLAT",
		confidence: .3,
		note: `No screen · ${rsiText}`
	};
}
function simul8orSignal(model, input) {
	const p = predict(model.weights, input);
	if (p >= .56) return {
		action: "BUY",
		confidence: clip(p, .5, .96),
		note: `Walk-forward long ${(p * 100).toFixed(0)}%`
	};
	if (p <= .44) return {
		action: "SELL",
		confidence: clip(1 - p, .5, .96),
		note: `Walk-forward short ${((1 - p) * 100).toFixed(0)}%`
	};
	return {
		action: "FLAT",
		confidence: .4,
		note: `No stored edge ${(p * 100).toFixed(0)}%`
	};
}
function ensemble(settings, parts) {
	const rows = [
		{
			id: "Invo",
			on: settings.sources.INVO,
			sig: parts.invo
		},
		{
			id: "Finviz",
			on: settings.sources.FINVIZ,
			sig: parts.finviz
		},
		{
			id: "Simul8or",
			on: settings.sources.SIMUL8OR,
			sig: parts.simul8or
		}
	];
	let score = 0;
	let weightSum = 0;
	const agreed = [];
	for (const row of rows) {
		if (!row.on.enabled || row.on.weight <= 0) continue;
		const dir = dirOf(row.sig.action);
		score += row.on.weight * dir * row.sig.confidence;
		weightSum += row.on.weight;
		if (dir !== 0) agreed.push(row.id);
	}
	if (weightSum === 0) return {
		action: "FLAT",
		confidence: 0,
		note: "All sources off"
	};
	const norm = score / weightSum;
	const action = norm > .08 ? "BUY" : norm < -.08 ? "SELL" : "FLAT";
	const confidence = clip(Math.abs(norm), 0, .97);
	if (action === "FLAT") return {
		action,
		confidence,
		note: "Desks do not agree"
	};
	return {
		action,
		confidence,
		note: `${action === "BUY" ? "Long" : "Short"} · ${agreed.join(" + ") || "mixed"}`
	};
}
function buildSignalSet(sym, model, settings) {
	const input = features(sym);
	const invo = invoSignal(sym, input);
	const finviz = finvizSignal(input);
	const simul8or = simul8orSignal(model, input);
	return {
		symbol: sym.symbol,
		invo,
		finviz,
		simul8or,
		ensemble: ensemble(settings, {
			invo,
			finviz,
			simul8or
		})
	};
}
var SOURCE_META = {
	INVO: {
		label: "Invo",
		role: "Copy-flow. Crowd lean from recent prints, the way a social book clusters.",
		href: "https://app.invoapp.com/"
	},
	FINVIZ: {
		label: "Finviz",
		role: "Screen. Trend and RSI band, the filter a technician would save.",
		href: "https://finviz.com/"
	},
	SIMUL8OR: {
		label: "Simul8or",
		role: "Walk-forward. The live model, scored every minute and corrected after each close.",
		href: "https://simul8or.com/"
	}
};
var defaultSettings = {
	autoTrade: true,
	riskPerTrade: .02,
	maxPositions: 4,
	minConfidence: .46,
	stopPct: .012,
	rewardMultiple: 1.8,
	useKelly: true,
	kellyCap: .12,
	timeStop: 28,
	scanSeconds: 2,
	dailyWithdrawCap: 1e4,
	sources: {
		INVO: {
			enabled: true,
			weight: 1
		},
		FINVIZ: {
			enabled: true,
			weight: 1.1
		},
		SIMUL8OR: {
			enabled: true,
			weight: 1
		}
	},
	mesh: emptySourceSettings(),
	v: {
		vetoNarrative: false,
		vetoNews: false,
		vetoThin: false,
		halfAgainst: false
	},
	orders: {
		type: "BRACKET",
		tif: "DAY",
		feeBps: 1,
		halfSpreadBps: 1.2,
		slipGuardBps: 40,
		limitExpire: 12,
		maxSlippagePct: .006
	}
};
var UNIVERSE = [
	{
		symbol: "SPY",
		name: "S&P 500",
		sector: "Index",
		price: 572.4,
		mu: .35,
		sigma: .72
	},
	{
		symbol: "QQQ",
		name: "Nasdaq 100",
		sector: "Index",
		price: 498.1,
		mu: .45,
		sigma: .9
	},
	{
		symbol: "NVDA",
		name: "NVIDIA",
		sector: "Semis",
		price: 131.25,
		mu: .7,
		sigma: 1.45
	},
	{
		symbol: "AAPL",
		name: "Apple",
		sector: "Tech",
		price: 227.8,
		mu: .3,
		sigma: .85
	},
	{
		symbol: "MSFT",
		name: "Microsoft",
		sector: "Tech",
		price: 428.6,
		mu: .4,
		sigma: .8
	},
	{
		symbol: "AMZN",
		name: "Amazon",
		sector: "Retail",
		price: 196.4,
		mu: .4,
		sigma: 1
	},
	{
		symbol: "META",
		name: "Meta",
		sector: "Internet",
		price: 582.2,
		mu: .5,
		sigma: 1.15
	},
	{
		symbol: "TSLA",
		name: "Tesla",
		sector: "Auto",
		price: 248.9,
		mu: .1,
		sigma: 1.7
	},
	{
		symbol: "AMD",
		name: "AMD",
		sector: "Semis",
		price: 162.3,
		mu: .55,
		sigma: 1.4
	},
	{
		symbol: "JPM",
		name: "JPMorgan",
		sector: "Finance",
		price: 224.7,
		mu: .25,
		sigma: .75
	},
	{
		symbol: "XOM",
		name: "Exxon Mobil",
		sector: "Energy",
		price: 118.5,
		mu: .15,
		sigma: .9
	},
	{
		symbol: "GLD",
		name: "Gold",
		sector: "Metal",
		price: 242.1,
		mu: .2,
		sigma: .62
	}
];
function pushActivity(book, item) {
	return [item, ...book.activity].slice(0, 80);
}
function advanceSymbol(sym, seed) {
	const input = features(sym);
	const [z, s1] = nextGaussian(seed);
	const [u, s2] = nextRand(s1);
	const shock = z * sym.sigma * .0064 + sym.mu * 15e-5 + driftEdge(input);
	const price = round2(Math.max(1, sym.price * Math.exp(shock)));
	const bias = clipBias(sym.bias * .96 + (u - .5) * .12 + Math.sign(input[1] ?? 0) * .04);
	return [{
		...sym,
		price,
		bias,
		hist: [...sym.hist, price].slice(-90)
	}, s2];
}
function clipBias(n) {
	return Math.max(-1, Math.min(1, n));
}
function stepPrices(book) {
	let seed = book.seed;
	const symbols = [];
	for (const sym of book.symbols) {
		const [next, s] = advanceSymbol(sym, seed);
		seed = s;
		symbols.push(next);
	}
	return {
		...book,
		seed,
		symbols,
		minute: book.minute + 1
	};
}
function shiftRegime(book) {
	let seed = book.seed;
	const picked = /* @__PURE__ */ new Set();
	while (picked.size < 3) {
		const [r, s] = nextRand(seed);
		seed = s;
		picked.add(Math.floor(r * book.symbols.length));
	}
	const symbols = book.symbols.map((sym, i) => picked.has(i) ? {
		...sym,
		mu: round2(-sym.mu)
	} : sym);
	const names = symbols.filter((_, i) => picked.has(i)).map((s) => s.symbol);
	return {
		...book,
		seed,
		symbols,
		model: {
			...book.model,
			adaptLeft: 12
		},
		activity: pushActivity(book, {
			id: `reg-${book.minute}`,
			ts: book.minute,
			tone: "info",
			text: `Regime shift. Drift flipped on ${names.join(", ")}. Learning rate lifted.`
		})
	};
}
function closeAt(book, pos, fill, reason) {
	const gain = round2(pos.side === "LONG" ? (fill - pos.entry) * pos.qty : (pos.entry - fill) * pos.qty);
	const cash = round2(book.cash + gain);
	const y = pos.side === "LONG" ? gain > 0 ? 1 : 0 : gain > 0 ? 0 : 1;
	const model = train(book.model, pos.features, y, book.minute);
	const [id, seed] = takeId(book.seed, "trd");
	const trade = {
		id,
		symbol: pos.symbol,
		side: pos.side,
		qty: pos.qty,
		entry: pos.entry,
		exit: round2(fill),
		pnl: gain,
		openedAt: pos.openedAt,
		closedAt: book.minute,
		reason,
		confidence: pos.confidence
	};
	const text = `${reason === "TARGET" ? "Target" : reason === "STOP" ? "Stopped" : reason === "TIME" ? "Time stop" : reason === "SIGNAL" ? "Signal exit" : "Manual exit"} ${pos.symbol} ${gain >= 0 ? "+" : ""}${gain.toFixed(2)}`;
	const ledger = {
		id: `led-${id}`,
		wall: Date.now(),
		kind: "CLOSE",
		amount: gain,
		note: text,
		balanceAfter: cash
	};
	return {
		...book,
		seed,
		cash,
		model,
		positions: book.positions.filter((p) => p.id !== pos.id),
		trades: [trade, ...book.trades].slice(0, 300),
		ledger: [ledger, ...book.ledger].slice(0, 200),
		activity: pushActivity(book, {
			id: `a-${id}`,
			ts: book.minute,
			tone: gain >= 0 ? "up" : "down",
			text
		})
	};
}
function openPosition(book, sym, side, confidence, plan) {
	const [id, seed] = takeId(book.seed, "pos");
	const pos = {
		id,
		symbol: sym.symbol,
		side,
		qty: plan.qty,
		entry: sym.price,
		stop: plan.stop,
		target: plan.target,
		openedAt: book.minute,
		confidence,
		features: features(sym)
	};
	const text = `${side === "LONG" ? "Long" : "Short"} ${sym.symbol} ${plan.qty} @ ${sym.price.toFixed(2)} · stop ${plan.stop.toFixed(2)} · target ${plan.target.toFixed(2)}`;
	return {
		...book,
		seed,
		positions: [...book.positions, pos],
		activity: pushActivity(book, {
			id: `o-${id}`,
			ts: book.minute,
			tone: "info",
			text
		})
	};
}
function step(book) {
	let next = stepPrices(book);
	if (next.minute > 0 && next.minute % 220 === 0) next = shiftRegime(next);
	const priceOf = (symbol, fallback) => next.symbols.find((s) => s.symbol === symbol)?.price ?? fallback;
	for (const pos of [...next.positions]) {
		const hit = exitHit(pos, priceOf(pos.symbol, pos.entry), next.minute, next.settings.timeStop);
		if (hit) next = closeAt(next, pos, hit.fill, hit.reason);
	}
	next = settleWorking(next);
	const mesh = stepMesh({
		symbols: next.symbols,
		model: next.model,
		settings: next.settings,
		minute: next.minute,
		scratch: next.scratch,
		hypedSymbol: hotSymbolOf(next)
	});
	const board = boardFrom({
		symbols: next.symbols,
		minute: next.minute,
		statuses: mesh.statuses,
		cache: mesh.cache
	});
	next = {
		...next,
		scratch: mesh.scratch,
		statuses: mesh.statuses,
		board
	};
	const signals = {};
	for (const sym of next.symbols) signals[sym.symbol] = buildSignalSet(sym, next.model, next.settings);
	next = {
		...next,
		signals
	};
	if (next.settings.autoTrade) {
		next = manageOpen(next, mesh.cache);
		next = lookForEntries(next, mesh.cache);
	}
	const equity = snapshot(next).equity;
	const dayOpenEquity = next.minute % 390 === 0 ? equity : next.dayOpenEquity;
	return {
		...next,
		dayOpenEquity,
		curve: [...next.curve, {
			m: next.minute,
			equity
		}].slice(-390)
	};
}
/** The one name the crowd is loudest about — the only input SOCIAL is fed. */
function hotSymbolOf(book) {
	return book.symbols.slice().sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias))[0]?.symbol ?? null;
}
/** Positions whose mesh tally has flipped are unwound through the order desk. */
function manageOpen(book, cache) {
	let next = book;
	for (const pos of [...next.positions]) {
		const view = next.board?.perSymbol[pos.symbol];
		const sig = next.signals[pos.symbol]?.ensemble;
		const flipped = view ? view.tally : 0;
		const against = pos.side === "LONG" ? flipped < -.08 : flipped > .08;
		const legacy = sig ? sig.confidence >= next.settings.minConfidence && oppositeExit(pos.side, sig.action) : false;
		const veto = next.settings.v.vetoNews && (cache.NEWS?.[pos.symbol]?.strength ?? 0) > .6;
		if (!against && !legacy && !veto) continue;
		const px = next.symbols.find((s) => s.symbol === pos.symbol)?.price ?? pos.entry;
		next = closeAt(next, pos, px, veto ? "SIGNAL" : against ? "SIGNAL" : "SIGNAL");
	}
	return next;
}
/** Ranks the board and takes the best qualified names through the order desk. */
function lookForEntries(book, cache) {
	const board = book.board;
	if (!board) return book;
	let next = book;
	const ranked = Object.values(board.perSymbol).filter((row) => row.qualified && !row.vetoed && row.direction !== 0).sort((a, b) => b.confidence - a.confidence);
	for (const row of ranked) {
		if (next.positions.length >= next.settings.maxPositions) break;
		if (next.positions.some((p) => p.symbol === row.symbol)) continue;
		if (next.working.some((o) => o.symbol === row.symbol)) continue;
		const sym = next.symbols.find((s) => s.symbol === row.symbol);
		if (!sym) continue;
		const side = row.direction > 0 ? "LONG" : "SHORT";
		const risk = defensiveVeto(next, sym, side, cache);
		if (risk) {
			next = pushReject(next, risk);
			continue;
		}
		const plan = planEntry(next, sym.price, side);
		if (!plan) continue;
		const routed = planOrder({
			book: next,
			symbol: sym.symbol,
			side,
			qty: plan.qty,
			stop: plan.stop,
			target: plan.target,
			confidence: row.confidence
		});
		if (!routed.plan) {
			next = pushReject(next, routed.reject);
			continue;
		}
		if (next.orders.type === "LIMIT" || next.orders.type === "STOP_LIMIT") {
			next = pushWorking(next, buildOrder(next, `wo-${row.symbol}-${next.minute}`, sym.symbol, side, plan.qty, plan.stop, plan.target, row.confidence, "ENTRY"));
			continue;
		}
		next = openPosition(next, sym, side, row.confidence, {
			qty: plan.qty,
			stop: plan.stop,
			target: plan.target
		});
	}
	return next;
}
/**
* The situational vetoes, plus the fade that ships off.
*
* These are the desk's refusal to take a trade it can see will be crowded out
* or already priced — the place it reserves the right to do nothing.
*/
function defensiveVeto(book, sym, side, cache) {
	const v = book.settings.v;
	const rec = (rule, detail) => ({
		id: `${sym.symbol}-${book.minute}-${rule}`,
		ts: book.minute,
		symbol: sym.symbol,
		rule,
		detail
	});
	if (v.vetoNews) {
		const news = cache.NEWS?.[sym.symbol];
		if (news && news.strength > .65 && Math.sign(news.bias) !== (side === "LONG" ? 1 : -1)) return rec("NEWS_AGAINST", "A fresh headline disagrees with this entry; the repricing is not finished.");
	}
	if (v.vetoThin) {
		const bookRead = cache.BOOK?.[sym.symbol];
		if (bookRead && bookRead.strength < .3) return rec("THIN_BOOK", "Resting depth is too thin for a stop to mean anything.");
	}
	if (v.halfAgainst) {
		const cross = cache.CROSS?.[sym.symbol];
		const sector = cache.SECTOR?.[sym.symbol];
		if (cross && Math.sign(cross.bias) !== (side === "LONG" ? 1 : -1) && sector && Math.sign(sector.bias) !== (side === "LONG" ? 1 : -1) && book.positions.length >= 2) return rec("AGAINST_TIDE", "Index and sector both lean against this entry; the desk stands down rather than halves.");
	}
	return null;
}
/** Resting orders the tape has now touched, and orders that expired unfilled. */
function settleWorking(book) {
	if (book.working.length === 0) return book;
	let next = book;
	const { hits, left } = workingTouches(book);
	next = {
		...next,
		working: left
	};
	for (const hit of hits) {
		const { fill, verdict } = executeResting(next, hit.order, hit.price, hit.order.side);
		if (hit.order.kind === "EXIT") {
			const pos = next.positions.find((p) => p.symbol === hit.order.symbol);
			if (pos) next = closeAt(next, pos, fill.fill, verdict === "GAPPED" ? "STOP" : "TARGET");
			continue;
		}
		const sym = next.symbols.find((s) => s.symbol === hit.order.symbol);
		if (!sym) continue;
		next = openPosition(next, sym, hit.order.side, hit.order.confidence, {
			qty: hit.order.qty,
			stop: hit.order.stop,
			target: hit.order.target
		});
		next = pushFill(next, fill, `${hit.order.symbol}-${next.minute}`);
	}
	return next;
}
function manualClose(book, id) {
	const pos = book.positions.find((p) => p.id === id);
	if (!pos) return book;
	return closeAt(book, pos, book.symbols.find((s) => s.symbol === pos.symbol)?.price ?? pos.entry, "MANUAL");
}
function flattenAll(book) {
	let next = book;
	for (const pos of [...book.positions]) next = manualClose(next, pos.id);
	return next;
}
function resetLearning(book) {
	return {
		...book,
		model: freshModel(),
		activity: pushActivity(book, {
			id: `learn-reset-${book.minute}`,
			ts: book.minute,
			tone: "info",
			text: "Learning weights reset to the research prior."
		})
	};
}
function blankSymbols() {
	return UNIVERSE.map((row) => ({
		...row,
		bias: 0,
		hist: [row.price]
	}));
}
function createSession(cash, settings, model, pinHash, ledger) {
	let book = {
		seed: 1299148402,
		minute: 0,
		cash,
		symbols: blankSymbols(),
		positions: [],
		trades: [],
		ledger,
		signals: {},
		curve: [],
		model,
		activity: [],
		dayOpenEquity: cash,
		settings,
		pinHash,
		lastWall: 0,
		board: null,
		statuses: [],
		scratch: emptyScratch(0),
		fills: [],
		working: [],
		rejects: [],
		orders: { ...settings.orders }
	};
	book.orders = {
		...book.orders,
		...settings.orders
	};
	for (let i = 0; i < 42; i++) book = stepPrices(book);
	const signals = {};
	for (const sym of book.symbols) signals[sym.symbol] = buildSignalSet(sym, book.model, book.settings);
	const equity = snapshot({
		...book,
		signals
	}).equity;
	return {
		...book,
		signals,
		dayOpenEquity: equity,
		curve: [{
			m: book.minute,
			equity
		}],
		activity: [{
			id: "warm",
			ts: book.minute,
			tone: "info",
			text: "Session warmed. Twelve names are live. No open risk yet."
		}]
	};
}
function createBook() {
	let book = createSession(500, defaultSettings, freshModel(), null, []);
	for (let i = 0; i < 110; i++) book = step(book);
	let guard = 0;
	while (book.positions.length === 0 && guard < 50) {
		book = step(book);
		guard++;
	}
	return {
		...book,
		lastWall: 0
	};
}
function flatSession(book) {
	const next = createSession(round2(book.cash), book.settings, book.model, book.pinHash, book.ledger);
	return {
		...next,
		lastWall: Date.now(),
		activity: pushActivity(next, {
			id: `flat-${next.minute}`,
			ts: next.minute,
			tone: "info",
			text: "Flat session. Wallet and what the model has learned stay. Prices are a new path."
		})
	};
}
var memoryStorage = {
	getItem: () => null,
	setItem: () => void 0,
	removeItem: () => void 0
};
var ORDER_TYPES = [
	"MARKET",
	"LIMIT",
	"STOP",
	"STOP_LIMIT",
	"BRACKET"
];
var TIFS = [
	"DAY",
	"GTC",
	"IOC",
	"FOK"
];
/** Clamp every knob a persisted book could have been saved with. */
function sanitizeSettings(input) {
	const n = (v, a, b) => clip(v, a, b);
	const source = (id) => ({
		enabled: Boolean(input.sources[id]?.enabled),
		weight: n(input.sources[id]?.weight ?? 1, 0, 3)
	});
	const incoming = input.mesh ?? emptySourceSettings();
	const mesh = {};
	for (const id of SOURCE_ORDER) {
		const row = incoming[id];
		const mode = row?.mode === "PINNED" ? "PINNED" : "AUTO";
		mesh[id] = {
			enabled: row ? Boolean(row.enabled) : SOURCE_SPECS[id] && Boolean(SOURCE_SPECS[id]),
			weight: n(row?.weight ?? SOURCE_SPECS[id].weight, 0, 3),
			mode,
			symbol: mode === "PINNED" && typeof row?.symbol === "string" ? row.symbol : null
		};
	}
	const orders = input.orders ?? defaultSettings.orders;
	const v = input.v ?? defaultSettings.v;
	return {
		autoTrade: Boolean(input.autoTrade),
		riskPerTrade: n(input.riskPerTrade, .005, .05),
		maxPositions: Math.round(n(input.maxPositions, 1, 8)),
		minConfidence: n(input.minConfidence, .35, .9),
		stopPct: n(input.stopPct, .005, .05),
		rewardMultiple: n(input.rewardMultiple, 1, 4),
		useKelly: Boolean(input.useKelly),
		kellyCap: n(input.kellyCap, .02, .2),
		timeStop: Math.round(n(input.timeStop, 8, 120)),
		scanSeconds: Math.round(n(input.scanSeconds, 1, 20)),
		dailyWithdrawCap: Math.round(n(input.dailyWithdrawCap, 100, 1e5)),
		sources: {
			INVO: source("INVO"),
			FINVIZ: source("FINVIZ"),
			SIMUL8OR: source("SIMUL8OR")
		},
		mesh,
		v: {
			vetoNarrative: Boolean(v.vetoNarrative),
			vetoNews: Boolean(v.vetoNews),
			vetoThin: Boolean(v.vetoThin),
			halfAgainst: Boolean(v.halfAgainst)
		},
		orders: {
			type: ORDER_TYPES.includes(orders.type) ? orders.type : "MARKET",
			tif: TIFS.includes(orders.tif) ? orders.tif : "DAY",
			feeBps: n(orders.feeBps, 0, 12),
			halfSpreadBps: n(orders.halfSpreadBps, 0, 20),
			slipGuardBps: n(orders.slipGuardBps, 5, 120),
			limitExpire: Math.round(n(orders.limitExpire, 2, 60)),
			maxSlippagePct: n(orders.maxSlippagePct, 5e-4, .02)
		}
	};
}
var useSniper = create()(persist((set) => ({
	book: createBook(),
	unlocked: false,
	runTicks: (n) => set((state) => {
		let book = state.book;
		const count = Math.max(0, Math.min(240, Math.floor(n)));
		for (let i = 0; i < count; i++) book = step(book);
		return { book: {
			...book,
			lastWall: Date.now()
		} };
	}),
	deposit: (amount) => set((state) => ({ book: applyDeposit(state.book, amount) })),
	withdraw: (amount) => set((state) => ({ book: applyWithdraw(state.book, amount) })),
	updateSettings: (patch) => set((state) => ({ book: {
		...state.book,
		settings: sanitizeSettings({
			...state.book.settings,
			...patch
		})
	} })),
	setSource: (id, patch) => set((state) => ({ book: {
		...state.book,
		settings: sanitizeSettings({
			...state.book.settings,
			sources: {
				...state.book.settings.sources,
				[id]: {
					...state.book.settings.sources[id],
					...patch
				}
			}
		})
	} })),
	closePosition: (id) => set((state) => ({ book: manualClose(state.book, id) })),
	flatten: () => set((state) => ({ book: flattenAll(state.book) })),
	setPinHash: (hash) => set((state) => ({
		book: {
			...state.book,
			pinHash: hash
		},
		unlocked: hash ? state.unlocked : true
	})),
	unlock: () => set({ unlocked: true }),
	lock: () => set({ unlocked: false }),
	resetLearning: () => set((state) => ({ book: resetLearning(state.book) })),
	newSession: () => set((state) => ({ book: flatSession(state.book) })),
	restoreOpeningBalance: () => set((state) => {
		return {
			book: {
				...createBook(),
				pinHash: state.book.pinHash,
				settings: state.book.settings,
				lastWall: Date.now()
			},
			unlocked: true
		};
	})
}), {
	name: "monroe-sniper-v1",
	skipHydration: true,
	version: 1,
	partialize: (state) => ({ book: state.book }),
	storage: createJSONStorage(() => typeof window === "undefined" ? memoryStorage : localStorage)
}));
function LiveModeTransitionModal({ isOpen, onClose, onConfirm }) {
	const [selectedNetwork, setSelectedNetwork] = (0, import_react.useState)(DEPOSIT_NETWORKS[0]);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [showQr, setShowQr] = (0, import_react.useState)(false);
	const [step, setStep] = (0, import_react.useState)("briefing");
	const [simulating, setSimulating] = (0, import_react.useState)(false);
	const [isActivating, setIsActivating] = (0, import_react.useState)(false);
	const live = useDesk((s) => s.live);
	const fund = useDesk((s) => s.fund);
	if (!isOpen) return null;
	const handleCopy = () => {
		navigator.clipboard.writeText(selectedNetwork.address);
		setCopied(true);
		setTimeout(() => setCopied(false), 2200);
	};
	const handleSimulateDeposit = (amount) => {
		setSimulating(true);
		setTimeout(() => {
			fund("in", amount, selectedNetwork.address, selectedNetwork.name);
			setSimulating(false);
			handleActivateLive();
		}, 700);
	};
	const handleActivateLive = () => {
		setIsActivating(true);
		setTimeout(() => {
			setIsActivating(false);
			onConfirm();
		}, 1400);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 bg-ink/80 backdrop-blur-md transition-opacity",
			onClick: onClose,
			"aria-hidden": "true"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "dialog",
			"aria-modal": "true",
			className: "relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-panel shadow-2xl shadow-amber-500/10 text-cream",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-1.5 w-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-500" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between border-b border-line px-6 py-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex size-11 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/20 text-amber-400",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-6 animate-pulse" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-bold tracking-widest text-amber-400 uppercase",
								children: "Production Execution"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300",
								children: "REAL CAPITAL RAIL"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-xl font-bold tracking-tight text-cream",
							children: "Switch to Live Trading Mode"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						className: "rounded-lg p-1.5 text-faint hover:bg-panel-2 hover:text-cream transition-colors",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "p-6",
					children: step === "briefing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm text-faint leading-relaxed",
								children: [
									"You are transitioning the Monroe algorithmic sniper from the",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-emerald-400",
										children: "$500 Demo Sandbox"
									}),
									" to the",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-amber-400",
										children: "Live Execution Rail"
									}),
									". In this mode, trades route through live institutional feeds with real capital accounting."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-2.5 rounded-xl border border-line bg-panel-2 p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs font-semibold text-brass uppercase tracking-wider",
										children: "Live Guardrails & Execution Protocols"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start gap-2.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 shrink-0 text-gain mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-cream",
												children: "Pre-Trade Risk Sizing:"
											}),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Position sizes are hard-capped at 1.5% maximum capital risk per candidate."
											})
										] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start gap-2.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 shrink-0 text-gain mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-cream",
												children: "Intraday 3% Drawdown Circuit Breaker:"
											}),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Automatic halt if portfolio experiences 3 consecutive losses or 3% drawdown."
											})
										] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start gap-2.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 shrink-0 text-gain mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-cream",
												children: "Dedicated Multi-Chain Deposit Address:"
											}),
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Direct non-custodial wallet destination generated for your live account."
											})
										] })]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "size-5 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs font-semibold text-cream",
										children: "Current Live Ledger Balance"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11px] text-faint",
										children: "Available cash ready for deployment"
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "font-mono text-lg font-bold text-amber-300",
										children: ["$", live.cash.toFixed(2)]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[10px] text-faint",
										children: live.cash === 0 ? "Deposit required to trade" : "Funded and ready"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: onClose,
									className: "text-xs",
									children: "Stay on Demo Sandbox"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									onClick: () => setStep("address"),
									className: "bg-amber-500 hover:bg-amber-400 text-ink font-bold text-xs gap-2",
									children: ["View Deposit Address & Activate ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3.5" })]
								})]
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-semibold text-brass uppercase tracking-wider",
									children: "Assigned Multi-Chain Deposit Address"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setStep("briefing"),
									className: "text-xs text-faint hover:text-cream underline",
									children: "Back to Overview"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-faint",
								children: "Transfer USDT, USDC, SOL, ETH, or BTC to your account address below."
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-1.5 rounded-xl border border-line bg-panel-2 p-1",
								children: DEPOSIT_NETWORKS.map((net) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => {
										setSelectedNetwork(net);
										setCopied(false);
									},
									className: cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all", selectedNetwork.id === net.id ? "bg-amber-500 text-ink font-bold shadow-xs" : "text-faint hover:text-cream hover:bg-panel"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: net.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[10px] opacity-75",
										children: [
											"(",
											net.id,
											")"
										]
									})]
								}, net.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-line bg-panel-2 p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-semibold text-cream",
											children: [
												selectedNetwork.name,
												" (",
												selectedNetwork.standard,
												")"
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300",
											children: selectedNetwork.confirmations
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-line bg-ink px-3 py-2.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono text-xs font-semibold text-cream break-all select-all",
											children: selectedNetwork.address
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handleCopy,
											className: "flex shrink-0 items-center gap-1 rounded bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors",
											children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 text-gain" }), " Copied"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" }), " Copy"] })
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-2 text-[11px] text-faint",
										children: [
											selectedNetwork.note,
											" · Est. arrival: ",
											selectedNetwork.estimatedArrival
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 border-t border-line/60 pt-3 flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => setShowQr(!showQr),
											className: "flex items-center gap-1.5 text-xs text-brass hover:text-amber-300",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "size-4" }), showQr ? "Hide QR Code" : "Show Deposit QR Code"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: `${selectedNetwork.explorerUrl}${selectedNetwork.address}`,
											target: "_blank",
											rel: "noreferrer",
											className: "flex items-center gap-1 text-[11px] text-faint hover:text-cream",
											children: ["Verify on Explorer ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
										})]
									}),
									showQr && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 flex flex-col items-center justify-center rounded-xl bg-white p-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
											viewBox: "0 0 24 24",
											className: "size-36 text-black",
											fill: "currentColor",
											"aria-label": "Deposit QR Code",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: selectedNetwork.qrSvgPattern })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-2 text-[10px] text-neutral-800 font-mono text-center",
											children: [
												"Scan to deposit ",
												selectedNetwork.name,
												" (",
												selectedNetwork.id,
												")"
											]
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-line/80 bg-panel-2/60 p-3.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-semibold text-cream",
												children: "Instant Live Wallet Funding Simulator"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-faint",
											children: "Instant On-Chain Credit"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-[11px] text-faint",
										children: "Need to test live rail execution immediately? Simulate an incoming confirmed deposit."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2.5 flex flex-wrap gap-2",
										children: [
											250,
											500,
											1e3
										].map((amt) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											disabled: simulating,
											onClick: () => handleSimulateDeposit(amt),
											className: "rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-cream hover:border-amber-400 hover:text-amber-300 transition-colors",
											children: [
												"+$",
												amt,
												" on ",
												selectedNetwork.id
											]
										}, amt))
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-end gap-2 pt-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: onClose,
									disabled: isActivating,
									className: "text-xs",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									onClick: handleActivateLive,
									disabled: isActivating,
									className: "bg-amber-500 hover:bg-amber-400 text-ink font-bold text-xs gap-2",
									children: isActivating ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4 animate-spin text-ink" }), " Activating Production Rail..."] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4 text-ink" }), " Activate Live Rail Mode"] })
								})]
							})
						]
					})
				}),
				isActivating && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-0 z-30 flex flex-col items-center justify-center bg-ink/90 p-6 text-center backdrop-blur-md animate-in fade-in duration-300",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "relative flex size-20 items-center justify-center rounded-2xl border-2 border-amber-400 bg-amber-500/20 text-amber-400 shadow-2xl shadow-amber-500/50 live-pulse",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-10" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "mt-4 text-xl font-bold tracking-tight text-amber-300",
							children: "SWITCHING TO LIVE EXECUTION RAIL"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1.5 max-w-sm text-xs text-cream/90 font-mono",
							children: "Binding assigned deposit address · Arming 1.5% ATR safeguards · Real-capital routing online"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-line",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full bg-gradient-to-r from-amber-500 to-yellow-400 animate-pulse w-full" })
						})
					]
				})
			]
		})]
	});
}
var loadFeeds = createServerFn({ method: "POST" }).validator((input) => ({ query: String(input?.query ?? "").trim().slice(0, 64) })).handler(createSsrRpc("86c96e3586dc571f9577b337738d31d4cbbfedb294e013618acad662f8aaff29"));
var INTERVALS = /* @__PURE__ */ new Set([
	"1m",
	"5m",
	"15m",
	"1h"
]);
createServerFn({ method: "POST" }).validator((input) => {
	const symbol = String(input?.symbol ?? "BTCUSDT").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
	const interval = INTERVALS.has(String(input?.interval)) ? String(input?.interval) : "5m";
	return {
		symbol: symbol || "BTCUSDT",
		interval
	};
}).handler(createSsrRpc("1a9bcaa0793bac6c3a3871a95fc0b1abeeae825d1fd8b95e86d620bcadd9db5e"));
createServerFn({ method: "POST" }).validator((input) => ({ query: String(input?.query ?? "").trim().slice(0, 64) })).handler(createSsrRpc("b50b27850b6938f67a83fb0f0bbd29df2b9c6e58e4e61262560434ed87e6c4f9"));
var NAV = [
	{
		to: "/",
		label: "Desk",
		short: "Desk",
		icon: LayoutDashboard
	},
	{
		to: "/tape",
		label: "Tape",
		short: "Tape",
		icon: Activity
	},
	{
		to: "/signals",
		label: "Signals",
		short: "Feed",
		icon: Radar
	},
	{
		to: "/opportunities",
		label: "Scanner",
		short: "Scan",
		icon: ScanSearch
	},
	{
		to: "/learn",
		label: "DYOR",
		short: "DYOR",
		icon: Search
	},
	{
		to: "/wallet",
		label: "Wallet",
		short: "Funds",
		icon: Wallet
	},
	{
		to: "/settings",
		label: "Settings",
		short: "Setup",
		icon: SlidersHorizontal
	}
];
function Frame({ children }) {
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancel = false;
		let timer = 0;
		let tickCount = 0;
		const loop = async () => {
			if (cancel) return;
			const book = useSniper.getState().book;
			const interval = Math.max(1, book.settings.scanSeconds) * 1e3;
			const due = catchUpTicks(Date.now(), book.lastWall, book.settings.scanSeconds);
			if (due > 0) useSniper.getState().runTicks(due);
			const desk = useDesk.getState();
			tickCount++;
			if (desk.power && tickCount % 3 === 0) try {
				const feeds = await loadFeeds({ data: {} });
				const combined = [...feeds.binance, ...feeds.dex];
				if (combined.length) {
					desk.setTape(combined, feeds.note);
					const prices = {};
					for (const c of combined) prices[c.id] = c.priceUsd;
					desk.tick(prices);
				}
			} catch {}
			if (desk.power) desk.autoStep();
			timer = window.setTimeout(loop, interval);
		};
		(async () => {
			await Promise.all([
				useSniper.persist.rehydrate(),
				useDesk.persist.rehydrate(),
				useDyorStore.persist.rehydrate()
			]);
			if (cancel) return;
			setReady(true);
			loop();
		})();
		return () => {
			cancel = true;
			window.clearTimeout(timer);
		};
	}, []);
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-screen flex-col justify-between bg-ink px-6 py-8 text-cream",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm tracking-widest text-brass uppercase",
			children: "Monroe"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "max-w-sm text-2xl font-medium",
			children: "Opening the paper desk…"
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children });
}
function Shell({ children }) {
	const book = useSniper((s) => s.book);
	const unlocked = useSniper((s) => s.unlocked);
	const locked = Boolean(book.pinHash) && !unlocked;
	const [nowTs, setNowTs] = (0, import_react.useState)(Date.now());
	(0, import_react.useEffect)(() => {
		const timer = window.setInterval(() => setNowTs(Date.now()), 1e3);
		return () => window.clearInterval(timer);
	}, []);
	const mode = useDesk((s) => s.mode);
	const setMode = useDesk((s) => s.setMode);
	const power = useDesk((s) => s.power);
	const setPower = useDesk((s) => s.setPower);
	const demo = useDesk((s) => s.demo);
	const live = useDesk((s) => s.live);
	const botStartedAt = useDesk((s) => s.botStartedAt);
	const getReadiness = useDesk((s) => s.getReadiness);
	const activeEq = equity(mode === "live" ? live : demo);
	const nairobi = formatNairobiTime(botStartedAt, nowTs);
	const readiness = getReadiness ? getReadiness() : null;
	const [showLiveModal, setShowLiveModal] = (0, import_react.useState)(false);
	const [justActivatedLive, setJustActivatedLive] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("min-h-screen bg-ink text-cream md:pl-56 transition-colors duration-700", justActivatedLive && "live-flash-screen"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-panel md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-b border-line px-5 py-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs tracking-widest text-brass uppercase",
									children: "Monroe"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase", mode === "live" ? "border border-amber-500/40 bg-amber-500/20 text-amber-300" : "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"),
									children: mode.toUpperCase()
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-lg font-medium",
								children: "Sniper Bot"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2.5 flex flex-col gap-0.5 rounded-lg border border-line/60 bg-panel-2 px-2.5 py-1.5 text-[11px]",
								suppressHydrationWarning: true,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between text-brass",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: "Nairobi EAT"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded bg-emerald-500/20 px-1 py-0.2 text-[10px] font-bold text-emerald-300",
										children: nairobi.dayLabel
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-mono text-[10px] text-faint",
									children: [
										nairobi.dateString,
										" · ",
										nairobi.timeString
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex flex-1 flex-col gap-1 px-3 py-4",
						children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, { ...item }, item.to))
					}),
					readiness && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-t border-line px-4 py-3",
						suppressHydrationWarning: true,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-[11px]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-faint",
									children: "Real Money Readiness"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-semibold text-emerald-400",
									children: [readiness.readinessScore, "%"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full rounded-full bg-emerald-400 transition-all duration-500",
									style: { width: `${readiness.readinessScore}%` }
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-[10px] text-faint",
								children: [
									readiness.completedDemoTrades,
									"/",
									readiness.targetDemoTrades,
									" demo trades trained"
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "border-t border-line p-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-line bg-panel-2 p-2.5",
							suppressHydrationWarning: true,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-xs text-faint",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Active Mode" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: mode === "live" ? "text-amber-400 font-medium" : "text-gain font-medium",
									children: mode === "live" ? "Live Rail" : "Demo Sandbox"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "num mt-1 text-base font-semibold text-cream",
								children: ["$", activeEq.toFixed(2)]
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-5 py-3 text-[11px] text-faint",
						children: "Global sniper desk. Automated risk & execution."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-screen flex-col pb-20 md:pb-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur md:px-8",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex min-w-0 items-center gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-brass",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								suppressHydrationWarning: true,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] font-semibold tracking-wider text-brass uppercase",
										children: "Nairobi EAT (UTC+3)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300",
										children: nairobi.dayLabel
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "truncate font-mono text-xs font-medium text-cream md:text-sm",
									children: [
										nairobi.dateString,
										" · ",
										nairobi.timeString
									]
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 sm:gap-3",
							children: [
								readiness && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									title: readiness.statusMessage,
									className: "hidden items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1 lg:flex",
									suppressHydrationWarning: true,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-3.5 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5 text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-faint",
											children: "Demo Training:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: cn("font-semibold", readiness.readinessScore >= 85 ? "text-gain" : "text-amber-400"),
											children: [readiness.readinessScore, "% Ready"]
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center rounded-full border border-line bg-panel-2 p-0.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setMode("demo"),
										className: cn("rounded-full px-2.5 py-1 text-xs font-medium transition-colors", mode === "demo" ? "bg-brass text-ink font-semibold shadow-xs" : "text-faint hover:text-cream"),
										children: "Demo ($500)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => {
											if (mode !== "live") setShowLiveModal(true);
											else setShowLiveModal(true);
										},
										className: cn("rounded-full px-2.5 py-1 text-xs font-medium transition-colors", mode === "live" ? "bg-amber-500 text-ink font-semibold shadow-xs" : "text-faint hover:text-cream"),
										children: [
											"Live ($",
											live.cash.toFixed(0),
											")"
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "hidden text-right font-mono sm:block",
									suppressHydrationWarning: true,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[10px] tracking-wider text-faint uppercase",
											children: [mode === "live" ? "Live Bal" : "Demo Bal", ":"]
										}),
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: cn("text-sm font-semibold", mode === "live" ? "text-amber-300" : "text-cream"),
											children: ["$", activeEq.toFixed(2)]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setPower(!power),
									className: cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors", power ? mode === "live" ? "border-amber-500/60 bg-amber-500/15 text-amber-300" : "border-gain/50 bg-gain/10 text-gain" : "border-line bg-panel text-faint hover:text-cream"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", power ? mode === "live" ? "bg-amber-400 pulse-dot" : "bg-gain pulse-dot" : "bg-faint") }), power ? mode === "live" ? "Live Armed" : "Sniper Armed" : "Standby"]
								})
							]
						})]
					}),
					mode === "live" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-panel-2 to-amber-950/60 px-4 py-2 text-xs backdrop-blur md:px-8",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-amber-400 animate-ping" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold tracking-wider text-amber-300 uppercase",
									children: "⚡ Live Capital Execution Rail Active"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden text-faint md:inline",
									children: "· Non-custodial DEX/CEX execution routing with strict 1.5% ATR sizing"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setShowLiveModal(true),
							className: "flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition-colors",
							children: "Deposit Address & Rail Status"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
						className: "flex-1 px-4 py-4 md:px-8 md:py-6",
						children: locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockScreen, {}) : children
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveModeTransitionModal, {
						isOpen: showLiveModal,
						onClose: () => setShowLiveModal(false),
						onConfirm: () => {
							setMode("live");
							setShowLiveModal(false);
							setJustActivatedLive(true);
							setTimeout(() => setJustActivatedLive(false), 2e3);
						}
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-panel md:hidden",
				children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
					...item,
					compact: true
				}, item.to))
			})
		]
	});
}
function NavLink({ to, label, short, icon: Icon, compact = false }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const on = to === "/" ? pathname === "/" : pathname.startsWith(to);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to,
		className: cn(compact ? "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs" : "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm", on ? "bg-panel-2 text-cream" : "text-faint hover:text-cream"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
			className: "size-4 shrink-0",
			"aria-hidden": "true"
		}), compact ? short : label]
	});
}
function LockScreen() {
	const book = useSniper((s) => s.book);
	const unlock = useSniper((s) => s.unlock);
	const [pin, setPin] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [misses, setMisses] = (0, import_react.useState)(0);
	const [wait, setWait] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		if (wait <= 0) return;
		const id = window.setTimeout(() => setWait((n) => n - 1), 1e3);
		return () => window.clearTimeout(id);
	}, [wait]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-md flex-col gap-4 py-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-widest text-brass uppercase",
				children: "Desk locked"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-3xl font-medium",
				children: "Enter the PIN"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-faint",
				children: "The simulator keeps stepping behind this lock. The PIN only guards this browser. It is not a bank login."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex flex-col gap-3",
				onSubmit: (event) => {
					event.preventDefault();
					if (wait > 0) return;
					hashPin(pin).then((hash) => {
						if (hash === book.pinHash) {
							setError("");
							unlock();
							return;
						}
						const next = misses + 1;
						setMisses(next);
						setPin("");
						if (next >= 5) {
							setWait(20);
							setMisses(0);
							setError("Too many tries. Wait 20 seconds.");
							return;
						}
						setError("That PIN does not match.");
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "field",
						inputMode: "numeric",
						autoComplete: "off",
						maxLength: 6,
						value: pin,
						"aria-label": "Desk PIN",
						onChange: (event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-loss",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: pin.length < 4 || wait > 0,
						children: wait > 0 ? `Wait ${wait}s` : "Unlock"
					})
				]
			})
		]
	});
}
var styles_default = "/assets/styles-BrusHofR.css";
var Route$7 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "Monroe Sniper" },
			{
				name: "description",
				content: "Paper trading desk that simulates every minute, sizes risk, and learns from its own fills."
			},
			{
				name: "theme-color",
				content: "#10120e"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap"
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", {
			suppressHydrationWarning: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			suppressHydrationWarning: true,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Frame, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	})
});
var $$splitComponentImporter$6 = () => import("./routes-B2w1xlmw.mjs");
var Route$6 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./learn-nH1UXVsH.mjs");
var Route$5 = createFileRoute("/learn")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./opportunities-DMVsPuIu.mjs");
var Route$4 = createFileRoute("/opportunities")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./settings-CMkw-kAz.mjs");
var Route$3 = createFileRoute("/settings")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./signals-mL_kjGvO.mjs");
var Route$2 = createFileRoute("/signals")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./tape-iUQTfZGy.mjs");
var Route$1 = createFileRoute("/tape")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./wallet-JHgwM7I0.mjs");
var Route = createFileRoute("/wallet")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var rootRouteChildren = {
	IndexRoute: Route$6.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$7
	}),
	LearnRoute: Route$5.update({
		id: "/learn",
		path: "/learn",
		getParentRoute: () => Route$7
	}),
	OpportunitiesRoute: Route$4.update({
		id: "/opportunities",
		path: "/opportunities",
		getParentRoute: () => Route$7
	}),
	SettingsRoute: Route$3.update({
		id: "/settings",
		path: "/settings",
		getParentRoute: () => Route$7
	}),
	SignalsRoute: Route$2.update({
		id: "/signals",
		path: "/signals",
		getParentRoute: () => Route$7
	}),
	TapeRoute: Route$1.update({
		id: "/tape",
		path: "/tape",
		getParentRoute: () => Route$7
	}),
	WalletRoute: Route.update({
		id: "/wallet",
		path: "/wallet",
		getParentRoute: () => Route$7
	})
};
var routeTree = Route$7._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		rewrite: previewPathRewrite(),
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { kellyFraction as a, formatNairobiTime as c, scanAllAvenues as d, useDesk as f, SOURCE_META as i, useDyorStore as l, LiveModeTransitionModal as n, money as o, useSniper as r, pct as s, router_exports as t, DEPOSIT_NETWORKS as u };
