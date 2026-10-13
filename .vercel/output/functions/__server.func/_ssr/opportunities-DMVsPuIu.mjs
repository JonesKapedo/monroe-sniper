import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, n as Card, r as Label, t as Button } from "./ui-9RT2T2XE.mjs";
import { A as ExternalLink, F as Clock3, I as CircleX, L as CircleCheck, U as ArrowDownRight, b as RefreshCw, d as ShieldX, f as ShieldCheck, h as Search, r as Wallet, s as TrendingUp, t as Zap } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/opportunities-DMVsPuIu.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TTL = 3e4;
var cache = /* @__PURE__ */ new Map();
var pending = /* @__PURE__ */ new Map();
var num = (v) => {
	if (v === null || v === void 0 || v === "") return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
};
var obj = (v) => v && typeof v === "object" ? v : {};
var str = (v, fallback = "") => typeof v === "string" && v.trim() ? v.trim() : fallback;
var clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
async function json(url, ttl = TTL) {
	const old = cache.get(url);
	if (old && old.expires > Date.now()) return old.value;
	const existing = pending.get(url);
	if (existing) return existing;
	const task = (async () => {
		let last;
		for (let attempt = 0; attempt < 2; attempt++) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 3500);
			try {
				const response = await fetch(url, {
					headers: { Accept: "application/json" },
					signal: controller.signal
				});
				if (!response.ok) {
					if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
						await new Promise((r) => setTimeout(r, 250));
						continue;
					}
					throw new Error(`HTTP ${response.status}`);
				}
				const value = await response.json();
				cache.set(url, {
					expires: Date.now() + ttl,
					value
				});
				while (cache.size > 120) {
					const first = cache.keys().next().value;
					if (first === void 0) break;
					cache.delete(first);
				}
				return value;
			} catch (error) {
				last = error;
				if (!attempt) await new Promise((r) => setTimeout(r, 200));
			} finally {
				clearTimeout(timer);
			}
		}
		throw last instanceof Error ? last : /* @__PURE__ */ new Error("Market-data request failed");
	})();
	pending.set(url, task);
	try {
		return await task;
	} finally {
		pending.delete(url);
	}
}
var CHAIN_IDS = {
	ethereum: "1",
	eth: "1",
	bsc: "56",
	"binance-smart-chain": "56",
	base: "8453",
	polygon: "137",
	arbitrum: "42161",
	optimism: "10",
	avalanche: "43114",
	solana: "solana"
};
var CHAIN_NAMES = {
	"1": "ethereum",
	"56": "bsc",
	"8453": "base",
	"137": "polygon",
	"42161": "arbitrum",
	"10": "optimism",
	"43114": "avalanche",
	solana: "solana"
};
function normalizeChain(chain) {
	const key = chain.toLowerCase();
	return CHAIN_NAMES[CHAIN_IDS[key] ?? key] ?? key;
}
function chainIdFor(chain) {
	const key = chain.toLowerCase();
	return CHAIN_IDS[key] ?? (CHAIN_NAMES[key] ? key : null);
}
function normalizeDexPair(input) {
	const p = obj(input), base = obj(p.baseToken), address = str(base.address);
	if (!address) return null;
	const chain = normalizeChain(str(p.chainId, "unknown")), volume = obj(p.volume), change = obj(p.priceChange);
	const day = obj(obj(p.txns).h24);
	return {
		chain,
		address,
		symbol: str(base.symbol, "UNKNOWN").toUpperCase(),
		name: str(base.name, str(base.symbol, "Unknown token")),
		priceUsd: num(p.priceUsd),
		liquidityUsd: num(obj(p.liquidity).usd),
		volume24h: num(volume.h24),
		marketCap: num(p.marketCap),
		fdv: num(p.fdv),
		priceChange24h: num(change.h24),
		buys24h: num(day.buys),
		sells24h: num(day.sells),
		pairCreatedAt: num(p.pairCreatedAt),
		url: str(p.url) || null,
		fetchedAt: Date.now()
	};
}
function dedupe(raw) {
	const map = /* @__PURE__ */ new Map();
	for (const pair of raw.map(normalizeDexPair).filter((x) => x !== null)) {
		const key = `${pair.chain}:${pair.address.toLowerCase()}`, prev = map.get(key);
		if (!prev || (pair.liquidityUsd ?? 0) > (prev.liquidityUsd ?? 0)) map.set(key, pair);
	}
	return [...map.values()].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
}
async function dexSearch(query) {
	if (!query.trim()) return [];
	return dedupe((await json(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query.trim())}`)).pairs ?? []);
}
async function dexTrending() {
	const profiles = await json("https://api.dexscreener.com/token-profiles/latest/v1", 15e3);
	const items = Array.isArray(profiles) ? profiles.slice(0, 18) : [];
	return dedupe((await Promise.all(items.map(async (raw) => {
		const p = obj(raw), chain = str(p.chainId), address = str(p.tokenAddress);
		if (!chain || !address) return [];
		try {
			return (await json(`https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`, 15e3)).pairs ?? [];
		} catch {
			return [];
		}
	}))).flat()).slice(0, 30);
}
async function cgSearch(query) {
	return (await json(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query.trim())}`, 6e4)).coins ?? [];
}
async function dexToken(chain, address) {
	return dedupe((await json(`https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`)).pairs ?? []);
}
async function goplusSecurity(chain, address) {
	const id = chainIdFor(chain);
	if (!id || id === "solana") return null;
	const data = await json(`https://api.gopluslabs.io/api/v1/token_security/${encodeURIComponent(id)}?contract_addresses=${encodeURIComponent(address)}`, 6e4);
	const result = obj(obj(data.result)[address.toLowerCase()] ?? obj(data.result)[address]);
	return Object.keys(result).length ? result : null;
}
async function honeypotCheck(address, chainId = "1") {
	const data = await json(`https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(address)}&chainID=${encodeURIComponent(chainId)}`, 6e4);
	return Object.keys(data).length ? data : null;
}
function boolFlag(v) {
	if (v === "1" || v === 1 || v === true) return true;
	if (v === "0" || v === 0 || v === false) return false;
	return null;
}
async function verifySecurity(m) {
	const chainId = chainIdFor(m.chain);
	if (!chainId) return null;
	const [gpResult, hpResult] = await Promise.allSettled([goplusSecurity(m.chain, m.address), honeypotCheck(m.address, chainId)]);
	const gp = gpResult.status === "fulfilled" ? gpResult.value : null;
	const hp = hpResult.status === "fulfilled" ? hpResult.value : null;
	if (!gp && !hp) return null;
	const hpFlag = typeof obj(hp?.honeypotResult).isHoneypot === "boolean" ? obj(hp?.honeypotResult).isHoneypot : null;
	const sim = obj(hp?.simulationResult), buyTax = num(sim.buyTax), sellTax = num(sim.sellTax);
	const mint = gp ? boolFlag(gp.is_mintable) : null;
	const freeze = gp ? boolFlag(gp.owner_change_balance) === true || boolFlag(gp.is_blacklisted) === true ? true : boolFlag(gp.owner_change_balance) === false && boolFlag(gp.is_blacklisted) === false ? false : null : null;
	const holders = Array.isArray(gp?.lp_holders) ? gp.lp_holders : [];
	const lockedShare = holders.reduce((sum, holder) => {
		const h = obj(holder);
		return sum + (boolFlag(h.is_locked) === true ? num(h.percent) ?? 0 : 0);
	}, 0);
	const lpLocked = gp && holders.length ? lockedShare >= .95 : null;
	const details = [];
	if (hpFlag === true) details.push("honeypot.is reports a honeypot");
	if (buyTax !== null && buyTax > .15) details.push("Buy tax exceeds 15%");
	if (sellTax !== null && sellTax > .15) details.push("Sell tax exceeds 15%");
	if (mint === true) details.push("Contract owner can mint tokens");
	if (freeze === true) details.push("Contract may freeze or blacklist holders");
	if (lpLocked === false) details.push("LP holder data does not show 95% locked liquidity");
	if (lpLocked === null) details.push("Liquidity-lock status could not be verified");
	return {
		honeypot: hpFlag,
		lpLocked,
		ownerCanMint: mint,
		ownerCanFreeze: freeze,
		buyTax,
		sellTax,
		verified: Boolean(gp && hp && hpFlag !== null && lpLocked !== null && mint !== null && freeze !== null && buyTax !== null && sellTax !== null),
		checkedAt: Date.now(),
		providers: [...gp ? ["GoPlus"] : [], ...hp ? ["honeypot.is"] : []],
		details
	};
}
function scoreOpportunity(m, security) {
	const flags = [], rationale = [];
	const liquidity = clamp((m.liquidityUsd ?? 0) / 1e5 * 100);
	const volumeRatio = (m.marketCap ?? m.fdv ?? 0) > 0 ? (m.volume24h ?? 0) / (m.marketCap ?? m.fdv ?? 1) : 0;
	const momentum = clamp(50 + (m.priceChange24h ?? 0) * .35);
	const ageHours = m.pairCreatedAt ? Math.max(0, (Date.now() - m.pairCreatedAt) / 36e5) : null;
	const novelty = ageHours === null ? 25 : clamp(100 - ageHours * 1.5);
	let securityScore = security?.verified ? 100 : 20;
	if (security?.honeypot === true || security?.ownerCanMint === true || security?.ownerCanFreeze === true || security?.lpLocked === false) securityScore = 0;
	let score = .35 * liquidity + .25 * momentum + .2 * securityScore + .2 * novelty;
	if (volumeRatio > .5) {
		score += 8;
		flags.push("high-volume");
		rationale.push("24h volume is high relative to market value");
	}
	if ((m.priceChange24h ?? 0) > 150 && volumeRatio > 1) {
		score -= 25;
		flags.push("PUMP-RISK");
		rationale.push("Extreme price acceleration with outsized volume");
	}
	if ((m.liquidityUsd ?? 0) < 1e4) {
		flags.push("THIN-LIQUIDITY");
		rationale.push("Liquidity is below $10k");
	}
	if (!security) {
		flags.push("SECURITY-UNVERIFIED");
		rationale.push("Security providers did not return a usable report");
	}
	if (security?.honeypot === true) {
		flags.push("HONEYPOT");
		rationale.push("Hard reject: honeypot detected");
	}
	if (security?.lpLocked === false) {
		flags.push("LP-UNLOCKED");
		rationale.push("Hard reject: locked liquidity not established");
	}
	if (security?.ownerCanMint === true) {
		flags.push("MINT-AUTHORITY");
		rationale.push("Hard reject: owner can mint");
	}
	if (security?.ownerCanFreeze === true) {
		flags.push("FREEZE-AUTHORITY");
		rationale.push("Hard reject: holders may be frozen");
	}
	if ((security?.buyTax ?? 0) > .15 || (security?.sellTax ?? 0) > .15) {
		flags.push("HIGH-TAX");
		rationale.push("Hard reject: trade tax exceeds 15%");
	}
	if (m.pairCreatedAt && ageHours !== null && ageHours < 24) {
		flags.push("NEW-PAIR");
		rationale.push("Pair is less than 24 hours old; volatility risk is elevated");
	}
	if (liquidity >= 70) rationale.push("Liquidity depth is comparatively strong");
	if (momentum >= 65) rationale.push("24h momentum is positive");
	if (!rationale.length) rationale.push("Insufficient positive evidence; keep on watchlist");
	const hardReject = flags.some((f) => [
		"HONEYPOT",
		"LP-UNLOCKED",
		"MINT-AUTHORITY",
		"FREEZE-AUTHORITY",
		"HIGH-TAX"
	].includes(f));
	const securityVerified = Boolean(security?.verified && security.honeypot === false && security.lpLocked === true && security.ownerCanMint === false && security.ownerCanFreeze === false && security.buyTax !== null && security.buyTax <= .15 && security.sellTax !== null && security.sellTax <= .15);
	const bounded = Math.round(clamp(score));
	return {
		id: `${m.chain}:${m.address.toLowerCase()}`,
		symbol: m.symbol,
		address: m.address,
		chain: m.chain,
		score: bounded,
		risk: bounded >= 65 && securityVerified ? "safe" : bounded >= 35 ? "caution" : "danger",
		flags: [...new Set(flags)],
		metrics: m,
		security,
		securityVerified,
		tradableInPaperMode: bounded >= 70 && securityVerified && !hardReject && (m.liquidityUsd ?? 0) >= 1e4,
		rationale
	};
}
var status = (id, label, state, message) => ({
	id,
	label,
	state,
	message,
	checkedAt: Date.now()
});
async function scanOpportunities(query = "") {
	const q = query.trim(), providers = [];
	let metrics = [];
	try {
		metrics = q ? await dexSearch(q) : await dexTrending();
		providers.push(status("dexscreener", "DexScreener", "ok", `${metrics.length} token pairs loaded`));
	} catch (e) {
		providers.push(status("dexscreener", "DexScreener", "error", e instanceof Error ? e.message : "Request failed"));
	}
	const checked = await Promise.all(metrics.slice(0, 12).map(async (m) => {
		try {
			return [m, await verifySecurity(m)];
		} catch {
			return [m, null];
		}
	}));
	const opportunities = checked.map(([m, s]) => scoreOpportunity(m, s)).sort((a, b) => Number(b.tradableInPaperMode) - Number(a.tradableInPaperMode) || b.score - a.score);
	const verified = checked.filter(([, s]) => s?.verified).length;
	providers.push(status("goplus", "GoPlus Security", verified ? "ok" : "degraded", verified ? `${verified} candidate(s) passed combined checks` : "Complete security evidence unavailable"));
	providers.push(status("honeypot", "honeypot.is", verified ? "ok" : "degraded", "Missing results fail closed"));
	if (q) try {
		const coins = await cgSearch(q);
		providers.push(status("coingecko", "CoinGecko", "ok", `${coins.length} search matches`));
	} catch (e) {
		providers.push(status("coingecko", "CoinGecko", "degraded", e instanceof Error ? e.message : "Unavailable"));
	}
	else providers.push(status("coingecko", "CoinGecko", "idle", "Optional asset enrichment"));
	providers.push(status("sec-edgar", "SEC EDGAR", "idle", "Best-effort filings adapter; not token-security evidence"));
	return {
		opportunities,
		providers,
		scannedAt: Date.now(),
		query: q
	};
}
var MAX_IDEA_EXPOSURE = .05;
var MAX_PORTFOLIO_EXPOSURE = .15;
var MIN_LIQUIDITY_USD = 1e4;
var HARD_REJECT_FLAGS = [
	"HONEYPOT",
	"LP-UNLOCKED",
	"MINT-AUTHORITY",
	"FREEZE-AUTHORITY",
	"HIGH-TAX"
];
function id(prefix, at) {
	return `${prefix}-${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
var usd = (n) => n.toLocaleString("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 2
});
var hardRejected = (signal) => signal.flags.some((flag) => HARD_REJECT_FLAGS.includes(flag));
function createPaperPortfolio(cashUsd = 500) {
	return {
		version: 1,
		cashUsd: Math.max(0, Number.isFinite(cashUsd) ? cashUsd : 500),
		positions: [],
		trades: [],
		decisions: []
	};
}
function paperExposureUsd(portfolio) {
	return portfolio.positions.reduce((sum, p) => sum + p.qty * p.currentPrice, 0);
}
function paperEquityUsd(portfolio) {
	return portfolio.cashUsd + paperExposureUsd(portfolio);
}
function appendDecision(portfolio, verdict) {
	return {
		...portfolio,
		decisions: [verdict, ...portfolio.decisions].slice(0, 150)
	};
}
function evaluateRiskGate(signal, portfolio, now = Date.now()) {
	const m = signal.metrics;
	const equity = paperEquityUsd(portfolio);
	const exposure = paperExposureUsd(portfolio);
	const quoteAge = now - m.fetchedAt;
	const securityAge = signal.security ? now - signal.security.checkedAt : Number.POSITIVE_INFINITY;
	const notional = Math.max(0, Math.min(equity * MAX_IDEA_EXPOSURE, portfolio.cashUsd, equity * MAX_PORTFOLIO_EXPOSURE - exposure));
	const sameToken = portfolio.positions.some((p) => p.tokenId === signal.id);
	const report = signal.security;
	const securityClean = Boolean(signal.securityVerified && report?.verified === true && report.honeypot === false && report.lpLocked === true && report.ownerCanMint === false && report.ownerCanFreeze === false && report.buyTax !== null && report.buyTax <= .15 && report.sellTax !== null && report.sellTax <= .15);
	const checks = [
		{
			id: "score",
			label: "Composite score ≥ 70",
			pass: signal.score >= 70,
			detail: `${signal.score}/100; minimum 70`
		},
		{
			id: "security",
			label: "Verified clean security",
			pass: securityClean,
			detail: securityClean ? "Both security sources returned a clean report" : "Missing, stale, incomplete, or adverse security report"
		},
		{
			id: "hard-reject",
			label: "No hard-reject flags",
			pass: !hardRejected(signal),
			detail: hardRejected(signal) ? signal.flags.filter((f) => HARD_REJECT_FLAGS.includes(f)).join(", ") : "No hard-reject flags"
		},
		{
			id: "liquidity",
			label: "Liquidity ≥ $10,000",
			pass: (m.liquidityUsd ?? 0) >= MIN_LIQUIDITY_USD,
			detail: `${usd(m.liquidityUsd ?? 0)}; minimum ${usd(MIN_LIQUIDITY_USD)}`
		},
		{
			id: "quote",
			label: "Fresh, usable market quote",
			pass: m.priceUsd !== null && Number.isFinite(m.priceUsd) && m.priceUsd > 0 && quoteAge >= 0 && quoteAge <= 6e4,
			detail: m.priceUsd === null ? "No price" : `${usd(m.priceUsd)}; quote age ${Math.round(quoteAge / 1e3)}s`
		},
		{
			id: "security-age",
			label: "Security check ≤ 5 minutes",
			pass: Boolean(report && securityAge >= 0 && securityAge <= 3e5),
			detail: report ? `Security evidence age ${Math.round(securityAge / 1e3)}s` : "No security report"
		},
		{
			id: "slots",
			label: `Position slots available (max 3)`,
			pass: portfolio.positions.length < 3,
			detail: `${portfolio.positions.length}/3 open`
		},
		{
			id: "duplicate",
			label: "No duplicate open position",
			pass: !sameToken,
			detail: sameToken ? "A paper position for this token is already open" : "No duplicate token position"
		},
		{
			id: "idea-budget",
			label: "Idea exposure ≤ 5% of equity",
			pass: equity > 0 && notional > 0 && notional <= equity * .05 + .01,
			detail: `Planned notional ${usd(notional)}; equity ${usd(equity)}`
		},
		{
			id: "portfolio-budget",
			label: "Aggregate exposure ≤ 15% of equity",
			pass: equity > 0 && exposure + notional <= equity * .15 + .01,
			detail: `Current ${usd(exposure)}; after trade ${usd(exposure + notional)}`
		},
		{
			id: "cash",
			label: "Paper cash available",
			pass: portfolio.cashUsd > 0 && notional > 0,
			detail: `${usd(portfolio.cashUsd)} available`
		}
	];
	return {
		id: id("gate", now),
		tokenId: signal.id,
		symbol: signal.symbol,
		score: signal.score,
		allowed: checks.every((check) => check.pass),
		decidedAt: now,
		plannedNotionalUsd: notional,
		checks
	};
}
function auditScan(portfolio, signals, now = Date.now()) {
	const decisions = signals.map((signal) => evaluateRiskGate(signal, portfolio, now));
	return {
		...portfolio,
		decisions: [...decisions, ...portfolio.decisions].slice(0, 150)
	};
}
function enterPaperPosition(portfolio, signal, now = Date.now()) {
	const verdict = evaluateRiskGate(signal, portfolio, now);
	let next = appendDecision(portfolio, verdict);
	if (!verdict.allowed || !signal.metrics.priceUsd || verdict.plannedNotionalUsd <= 0) return {
		portfolio: next,
		verdict,
		entered: false
	};
	const entry = signal.metrics.priceUsd;
	const qty = verdict.plannedNotionalUsd / entry;
	const position = {
		id: id("paper", now),
		tokenId: signal.id,
		symbol: signal.symbol,
		name: signal.metrics.name,
		chain: signal.chain,
		address: signal.address,
		qty,
		initialQty: qty,
		entryPrice: entry,
		currentPrice: entry,
		stopPrice: entry * .92,
		scaleOutPrice: entry * 1.2,
		highWaterPrice: entry,
		peakLiquidityUsd: signal.metrics.liquidityUsd ?? 0,
		initialNotionalUsd: verdict.plannedNotionalUsd,
		realizedPnlUsd: 0,
		openedAt: now,
		lastUpdatedAt: now,
		scaledOut: false,
		score: signal.score
	};
	next = {
		...next,
		cashUsd: Math.max(0, next.cashUsd - verdict.plannedNotionalUsd),
		positions: [...next.positions, position]
	};
	return {
		portfolio: next,
		verdict,
		entered: true
	};
}
function recordTrade(position, qty, price, reason, now, partial) {
	return {
		id: id("trade", now),
		tokenId: position.tokenId,
		symbol: position.symbol,
		chain: position.chain,
		address: position.address,
		qty,
		entryPrice: position.entryPrice,
		exitPrice: price,
		pnlUsd: (price - position.entryPrice) * qty,
		reason,
		openedAt: position.openedAt,
		closedAt: now,
		score: position.score,
		partial
	};
}
function closePosition(portfolio, position, price, reason, now) {
	const trade = recordTrade(position, position.qty, price, reason, now, false);
	return {
		...portfolio,
		cashUsd: portfolio.cashUsd + position.qty * price,
		positions: portfolio.positions.filter((p) => p.id !== position.id),
		trades: [trade, ...portfolio.trades].slice(0, 250)
	};
}
/** Apply fresh market marks and the guide's hard stop, scale-out, trailing, time and liquidity exits. */
function applyPaperMarketUpdates(portfolio, updates, now = Date.now()) {
	const byToken = new Map(updates.map((update) => [update.tokenId, update]));
	let next = portfolio;
	for (const original of [...portfolio.positions]) {
		let position = next.positions.find((p) => p.id === original.id);
		if (!position) continue;
		const update = byToken.get(position.tokenId);
		const quoteFresh = Boolean(update && update.fetchedAt !== void 0 && now - update.fetchedAt >= 0 && now - update.fetchedAt <= 6e4);
		const updatedPrice = update?.priceUsd;
		const price = quoteFresh && typeof updatedPrice === "number" && Number.isFinite(updatedPrice) && updatedPrice > 0 ? updatedPrice : position.currentPrice;
		const updatedLiquidity = update?.liquidityUsd;
		const liquidity = quoteFresh && typeof updatedLiquidity === "number" && updatedLiquidity > 0 ? updatedLiquidity : position.peakLiquidityUsd;
		const highWater = Math.max(position.highWaterPrice, price);
		const peakLiquidity = Math.max(position.peakLiquidityUsd, liquidity);
		position = {
			...position,
			currentPrice: price,
			highWaterPrice: highWater,
			peakLiquidityUsd: peakLiquidity,
			lastUpdatedAt: quoteFresh ? now : position.lastUpdatedAt
		};
		next = {
			...next,
			positions: next.positions.map((p) => p.id === position?.id ? position : p)
		};
		let reason = null;
		if (now - position.openedAt >= 216e5) reason = "TIME_STOP";
		else if (peakLiquidity > 0 && liquidity < peakLiquidity * .7) reason = "LIQUIDITY_DROP";
		else if (price <= position.stopPrice) reason = "STOP";
		if (reason) {
			next = closePosition(next, position, price, reason, now);
			continue;
		}
		if (!position.scaledOut && price >= position.scaleOutPrice) {
			const sellQty = position.qty * .5;
			const trade = recordTrade(position, sellQty, price, "SCALE_OUT", now, true);
			const remaining = {
				...position,
				qty: position.qty - sellQty,
				scaledOut: true,
				realizedPnlUsd: position.realizedPnlUsd + trade.pnlUsd
			};
			next = {
				...next,
				cashUsd: next.cashUsd + sellQty * price,
				positions: next.positions.map((p) => p.id === position.id ? remaining : p),
				trades: [trade, ...next.trades].slice(0, 250)
			};
			position = remaining;
		}
		if (position.scaledOut && price <= position.highWaterPrice * .9) next = closePosition(next, position, price, "TRAILING_STOP", now);
	}
	return next;
}
function closePaperPosition(portfolio, positionId, now = Date.now()) {
	const position = portfolio.positions.find((p) => p.id === positionId);
	return position ? closePosition(portfolio, position, position.currentPrice, "MANUAL", now) : portfolio;
}
function resetPaperPortfolio() {
	return createPaperPortfolio();
}
function gateStatusText(verdict) {
	const failed = verdict.checks.filter((check) => !check.pass).map((check) => check.label);
	return verdict.allowed ? "All risk gates passed; eligible for paper execution only." : `Blocked by ${failed.length} gate(s): ${failed.join(", ")}.`;
}
var PAPER_STORAGE_KEY = "monroe-paper-portfolio-v1";
var money = (n) => n == null ? "—" : n.toLocaleString("en-US", {
	style: "currency",
	currency: "USD",
	notation: Math.abs(n) >= 1e6 ? "compact" : "standard",
	maximumFractionDigits: Math.abs(n) < 1 ? 8 : 2
});
var pct = (n) => n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
var ageText = (ms) => ms < 6e4 ? `${Math.max(0, Math.round(ms / 1e3))}s ago` : `${Math.round(ms / 6e4)}m ago`;
function loadPaperPortfolio() {
	if (typeof window === "undefined") return createPaperPortfolio();
	try {
		const parsed = JSON.parse(window.localStorage.getItem(PAPER_STORAGE_KEY) ?? "null");
		if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.positions) || !Array.isArray(parsed.trades) || !Array.isArray(parsed.decisions)) return createPaperPortfolio();
		return {
			version: 1,
			cashUsd: typeof parsed.cashUsd === "number" && Number.isFinite(parsed.cashUsd) ? Math.max(0, parsed.cashUsd) : 500,
			positions: parsed.positions,
			trades: parsed.trades,
			decisions: parsed.decisions
		};
	} catch {
		return createPaperPortfolio();
	}
}
function persistPaperPortfolio(book) {
	try {
		if (typeof window !== "undefined") window.localStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify(book));
	} catch {}
}
function short(address) {
	return address.length > 15 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address;
}
function tokenKey(chain, address) {
	return `${chain}:${address.toLowerCase()}`;
}
function OpportunitiesView() {
	const [query, setQuery] = (0, import_react.useState)("");
	const [result, setResult] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [lastNotice, setLastNotice] = (0, import_react.useState)("");
	const [portfolio, setPortfolio] = (0, import_react.useState)(createPaperPortfolio);
	(0, import_react.useEffect)(() => {
		setPortfolio(loadPaperPortfolio());
	}, []);
	const positionsRef = (0, import_react.useRef)(portfolio.positions);
	(0, import_react.useEffect)(() => {
		positionsRef.current = portfolio.positions;
	}, [portfolio.positions]);
	(0, import_react.useEffect)(() => {
		persistPaperPortfolio(portfolio);
	}, [portfolio]);
	const scan = (0, import_react.useCallback)(async (term) => {
		setLoading(true);
		setError("");
		try {
			const next = await scanOpportunities(term);
			const at = Date.now();
			setResult(next);
			setSelected((current) => current ? next.opportunities.find((item) => item.id === current.id) ?? null : next.opportunities[0] ?? null);
			setPortfolio((old) => {
				return auditScan(applyPaperMarketUpdates(old, next.opportunities.map((item) => ({
					tokenId: item.id,
					priceUsd: item.metrics.priceUsd,
					liquidityUsd: item.metrics.liquidityUsd,
					fetchedAt: item.metrics.fetchedAt
				})), at), next.opportunities, at);
			});
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Market scan failed");
		} finally {
			setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		scan("");
	}, [scan]);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		const refreshPositions = async () => {
			const held = positionsRef.current;
			const quoteResults = await Promise.all(held.map(async (position) => {
				try {
					const preferred = (await dexToken(position.chain, position.address)).find((pair) => tokenKey(pair.chain, pair.address) === position.tokenId);
					if (!preferred) return null;
					return {
						tokenId: position.tokenId,
						priceUsd: preferred.priceUsd,
						liquidityUsd: preferred.liquidityUsd,
						fetchedAt: Date.now()
					};
				} catch {
					return null;
				}
			}));
			const updates = [];
			for (const row of quoteResults) if (row !== null) updates.push(row);
			if (cancelled) return;
			setPortfolio((old) => applyPaperMarketUpdates(old, updates, Date.now()));
		};
		const timer = window.setInterval(() => {
			refreshPositions();
		}, 3e4);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, []);
	const [watchlist, setWatchlist] = (0, import_react.useState)(() => {
		try {
			return JSON.parse(localStorage.getItem("monroe-watchlist-v1") ?? "[]");
		} catch {
			return [];
		}
	});
	const toggleWatch = (id) => {
		setWatchlist((old) => {
			const next = old.includes(id) ? old.filter((value) => value !== id) : [...old, id];
			try {
				window.localStorage.setItem("monroe-watchlist-v1", JSON.stringify(next));
			} catch {}
			return next;
		});
	};
	const items = result?.opportunities ?? [];
	const equity = paperEquityUsd(portfolio);
	const exposure = paperExposureUsd(portfolio);
	const totalPnl = equity - 500;
	const realizedPnl = portfolio.trades.reduce((sum, trade) => sum + trade.pnlUsd, 0);
	const unrealizedPnl = portfolio.positions.reduce((sum, position) => sum + (position.currentPrice - position.entryPrice) * position.qty, 0);
	const selectedVerdict = (0, import_react.useMemo)(() => selected ? evaluateRiskGate(selected, portfolio, Date.now()) : null, [selected, portfolio]);
	const executePaper = () => {
		if (!selected) return;
		const execution = enterPaperPosition(portfolio, selected, Date.now());
		setPortfolio(execution.portfolio);
		setLastNotice(execution.entered ? `PAPER FILL · ${selected.symbol} opened for ${money(execution.verdict.plannedNotionalUsd)}. No live order was sent.` : gateStatusText(execution.verdict));
	};
	const closePaper = (position) => {
		setPortfolio((old) => closePaperPosition(old, position.id, Date.now()));
		setLastNotice(`PAPER CLOSE · ${position.symbol} marked and closed at ${money(position.currentPrice)}.`);
	};
	const resetPaper = () => {
		if (!window.confirm(`Reset the paper portfolio to $${500 .toLocaleString("en-US")}? This clears open positions and paper trade history.`)) return;
		setPortfolio(resetPaperPortfolio());
		setLastNotice(`Paper portfolio reset to $${500 .toLocaleString("en-US")}. No live funds are involved.`);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col justify-between gap-4 md:flex-row md:items-end",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-[0.24em] text-brass uppercase",
							children: "Market intelligence / public feeds"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1 rounded-md border border-gain/40 px-2 py-1 text-[10px] tracking-wide text-gain",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-gain" }), "PAPER ONLY"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-2 text-3xl font-medium md:text-4xl",
						children: "Opportunity scanner"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-2xl text-sm text-faint",
						children: "Scan real public token-pair data, inspect every risk gate, and simulate entries and exits in an isolated paper book."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => void scan(query),
					disabled: loading,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("size-4", loading && "animate-spin") }), loading ? "Scanning feeds…" : "Refresh scan"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3 xl:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortfolioMetric, {
						label: "Paper equity",
						value: money(equity),
						detail: `${totalPnl >= 0 ? "+" : ""}${money(totalPnl)} total P&L`,
						positive: totalPnl >= 0,
						icon: "equity"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortfolioMetric, {
						label: "Available paper cash",
						value: money(portfolio.cashUsd),
						detail: "USD simulator ledger",
						icon: "cash"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortfolioMetric, {
						label: "Open risk",
						value: money(exposure),
						detail: `${equity > 0 ? (exposure / equity * 100).toFixed(1) : "0.0"}% of equity · max 15%`,
						icon: "risk"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortfolioMetric, {
						label: "Open positions",
						value: `${portfolio.positions.length}/3`,
						detail: `Realized ${money(realizedPnl)} · Unrealized ${money(unrealizedPnl)}`,
						icon: "positions",
						positive: realizedPnl + unrealizedPnl >= 0
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 sm:flex-row",
				role: "search",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "flex min-w-0 flex-1 gap-3",
					onSubmit: (event) => {
						event.preventDefault();
						if (query.trim()) scan(query.trim());
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "relative min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "field pl-9",
							value: query,
							onChange: (event) => setQuery(event.target.value),
							placeholder: "Token name, ticker, or contract address…",
							"aria-label": "Search token markets"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "submit",
						disabled: loading || !query.trim(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4" }), "Search"]
					})]
				}), query && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					onClick: () => {
						setQuery("");
						scan("");
					},
					children: "Trending"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid grid-cols-2 gap-3 md:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "Candidates",
						value: String(items.length)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "Security verified",
						value: String(items.filter((item) => item.securityVerified).length)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "Paper gate passed",
						value: String(items.filter((item) => evaluateRiskGate(item, portfolio).allowed).length)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "Danger flagged",
						value: String(items.filter((item) => item.risk === "danger").length)
					})
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Provider health" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-faint",
						children: result ? `Updated ${new Date(result.scannedAt).toLocaleTimeString()}` : "Waiting for first scan"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5",
					children: (result?.providers ?? skeleton).map((source) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provider, { item: source }, source.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-xs text-faint",
					children: "Public endpoints can throttle or block browser requests. Missing or incomplete security evidence always blocks paper entry."
				})
			] }),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "alert",
				className: "rounded-xl border border-loss/40 bg-loss/10 p-4 text-sm text-loss",
				children: error
			}),
			lastNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: "flex items-start justify-between gap-3 rounded-xl border border-line bg-panel-2 p-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: lastNotice }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-faint hover:text-cream",
					onClick: () => setLastNotice(""),
					"aria-label": "Dismiss notice",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "size-4" })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: query ? `Results for “${query}”` : "Latest token profiles" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-faint",
								children: "Score ≥ 70 + every hard gate"
							})]
						}),
						loading && !result && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-faint",
							children: "Connecting to public market feeds…"
						}) }),
						!loading && !items.length && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: "No candidates returned"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-faint",
							children: "The provider may be throttling requests. Try a contract address or refresh shortly."
						})] }),
						items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpportunityCard, {
							item,
							selected: selected?.id === item.id,
							watched: watchlist.includes(item.id),
							verdict: evaluateRiskGate(item, portfolio),
							onSelect: () => setSelected(item),
							onWatch: () => toggleWatch(item.id)
						}, item.id))
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-col gap-4 xl:sticky xl:top-24",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Risk verdict & paper order" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-4 text-brass" })]
						}), selected && selectedVerdict ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-lg font-medium",
										children: selected.symbol
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-faint",
										children: [
											selected.chain,
											" · ",
											short(selected.address)
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Score, {
										score: selected.score,
										risk: selected.risk
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: cn("mt-4 rounded-lg border p-3", selectedVerdict.allowed ? "border-gain/40 bg-gain/5" : "border-loss/40 bg-loss/5"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "flex items-center gap-2 text-xs uppercase tracking-wide",
										children: [selectedVerdict.allowed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 text-gain" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldX, { className: "size-4 text-loss" }), selectedVerdict.allowed ? "Risk gates passed" : "ENTRY BLOCKED"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-sm",
										children: selectedVerdict.allowed ? "Eligible for paper execution only." : `${selectedVerdict.checks.filter((check) => !check.pass).length} gate(s) need to pass before an entry is permitted.`
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-4 flex flex-col gap-3",
									children: selectedVerdict.checks.map((check) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start gap-2",
										children: [check.pass ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "mt-0.5 size-4 shrink-0 text-gain" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "mt-0.5 size-4 shrink-0 text-loss" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-sm",
												children: check.label
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-faint",
												children: check.detail
											})]
										})]
									}, check.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 rounded-lg border border-line p-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-3 text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Proposed paper notional"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-mono",
												children: money(selectedVerdict.plannedNotionalUsd)
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-2 flex items-center justify-between gap-3 text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Stop loss"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-mono",
												children: [selected.metrics.priceUsd ? money(selected.metrics.priceUsd * .92) : "—", " (−8%)"]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-2 flex items-center justify-between gap-3 text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "First scale-out"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-mono",
												children: [selected.metrics.priceUsd ? money(selected.metrics.priceUsd * 1.2) : "—", " (+20%)"]
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									className: "mt-4 w-full",
									disabled: !selectedVerdict.allowed || loading,
									onClick: executePaper,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4" }), "Simulate paper entry"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-center text-xs text-faint",
									children: "No wallet connection, live order, or real money is used."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs tracking-wide text-faint uppercase",
										children: "Signal rationale"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
										className: "mt-2 flex flex-col gap-2",
										children: selected.rationale.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex gap-2 text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-brass",
												children: "•"
											}), line]
										}, line))
									})]
								}),
								selected.security?.details.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 rounded-lg border border-line p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-faint",
										children: "Security findings"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
										className: "mt-2 flex flex-col gap-2",
										children: selected.security.details.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
											className: "text-sm",
											children: line
										}, line))
									})]
								}) : null,
								selected.metrics.url && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									className: "mt-4 inline-flex items-center gap-2 text-sm text-brass hover:underline",
									href: selected.metrics.url,
									target: "_blank",
									rel: "noreferrer",
									children: ["Open pair on DexScreener ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-faint",
							children: "Select a candidate to see its full risk verdict. A blocked verdict cannot be overridden in this prototype."
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Paper positions" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-faint",
									children: "Auto-marked ~30s"
								})]
							}),
							portfolio.positions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3 flex flex-col gap-3",
								children: portfolio.positions.map((position) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PositionCard, {
									position,
									onClose: () => closePaper(position)
								}, position.id))
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 rounded-lg border border-dashed border-line p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "size-5 text-faint" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm",
										children: "No open paper positions."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-xs text-faint",
										children: "Only candidates passing every risk gate can open a position."
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-faint",
									children: [
										"Paper history · ",
										portfolio.trades.length,
										" fills"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: resetPaper,
									className: "text-xs text-loss hover:underline",
									children: "Reset paper book"
								})]
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Risk audit trail" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-faint",
								children: "Newest first"
							})]
						}), portfolio.decisions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex flex-col divide-y divide-line",
							children: portfolio.decisions.slice(0, 6).map((decision) => {
								const failed = decision.checks.filter((check) => !check.pass);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "py-3 first:pt-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-sm font-medium",
											children: [
												decision.symbol,
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-mono text-xs text-faint",
													children: [decision.score, "/100"]
												})
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: cn("text-[10px] tracking-wide", decision.allowed ? "text-gain" : "text-loss"),
											children: decision.allowed ? "PASS" : "BLOCKED"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-xs text-faint",
										children: [
											new Date(decision.decidedAt).toLocaleTimeString(),
											" · ",
											decision.allowed ? `Notional ${money(decision.plannedNotionalUsd)}` : failed.slice(0, 2).map((check) => check.label).join(" · ")
										]
									})]
								}, decision.id);
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-faint",
							children: "Risk verdicts will appear as candidates are scanned."
						})] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Execution discipline · guide-aligned paper simulation" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rule, {
							title: "Position budget",
							body: "At most 5% of equity per idea, no more than three open positions or 15% aggregate initial exposure."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rule, {
							title: "Hard stop",
							body: "Close the remaining position if price falls 8% below entry."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rule, {
							title: "Scale-out + trail",
							body: "Sell half at +20%; trail the remainder 10% below its highest observed price."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rule, {
							title: "Time & liquidity guard",
							body: "Close after six hours or when observed pool liquidity falls more than 30% from its peak."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-xs text-faint",
					children: "This is an auditable prototype, not investment advice. Security providers may be incomplete or inaccurate; no scanner can guarantee that a token is safe."
				})
			] })
		]
	});
}
function PortfolioMetric({ label, value, detail, icon, positive }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "min-w-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(icon === "equity" ? TrendingUp : icon === "cash" ? Wallet : icon === "risk" ? ShieldCheck : Clock3, { className: "size-4 shrink-0 text-brass" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 truncate font-mono text-xl md:text-2xl",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("mt-1 text-xs", positive === void 0 ? "text-faint" : positive ? "text-gain" : "text-loss"),
				children: detail
			})
		]
	});
}
function Metric({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-line p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-faint",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 font-mono text-xl",
			children: value
		})]
	});
}
function Provider({ item }) {
	const color = item.state === "ok" ? "text-gain" : item.state === "error" ? "text-loss" : item.state === "degraded" ? "text-brass" : "text-faint";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-line p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium",
					children: item.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", item.state === "ok" ? "bg-gain" : item.state === "error" ? "bg-loss" : "bg-brass") })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("mt-1 text-xs", color),
				children: item.state.toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-faint",
				children: item.message
			})
		]
	});
}
function OpportunityCard({ item, selected, watched, verdict, onSelect, onWatch }) {
	const move = item.metrics.priceChange24h;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: cn("rounded-xl border bg-panel p-4 transition", selected ? "border-brass" : "border-line hover:border-brass/60"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					className: "min-w-0 flex-1 text-left",
					onClick: onSelect,
					type: "button",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: item.symbol
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-md border border-line px-2 py-0.5 text-xs text-faint",
								children: item.chain
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("rounded-md px-2 py-0.5 text-xs uppercase", item.risk === "safe" ? "bg-gain/10 text-gain" : item.risk === "danger" ? "bg-loss/10 text-loss" : "bg-brass/10 text-brass"),
								children: item.risk
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 truncate text-xs text-faint",
						children: [
							item.metrics.name,
							" · ",
							short(item.address)
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-4 sm:justify-end",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Score, {
						score: item.score,
						risk: item.risk
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onWatch,
						"aria-pressed": watched,
						className: cn("min-h-10 rounded-lg border px-3 text-xs", watched ? "border-brass text-brass" : "border-line text-faint"),
						children: watched ? "Watching" : "Watch"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: onSelect,
				className: "mt-4 grid w-full grid-cols-2 gap-3 text-left md:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "Price",
						value: money(item.metrics.priceUsd)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "Liquidity",
						value: money(item.metrics.liquidityUsd)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "24h volume",
						value: money(item.metrics.volume24h)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
						label: "24h move",
						value: pct(move)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: item.flags.slice(0, 5).map((flag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-md border border-line px-2 py-1 text-[11px] text-faint",
					children: flag
				}, flag))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex items-center gap-2 text-xs",
				children: [
					verdict.allowed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 text-gain" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldX, { className: "size-4 text-loss" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: verdict.allowed ? "text-gain" : "text-loss",
						children: verdict.allowed ? "All risk gates pass" : `${verdict.checks.filter((check) => !check.pass).length} gate(s) blocking`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-auto text-faint",
						children: verdict.allowed ? "Paper only" : "No entry"
					})
				]
			})
		]
	});
}
function Mini({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-lg bg-ink/60 p-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[11px] text-faint",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 truncate font-mono text-sm",
			children: value
		})]
	});
}
function Score({ score, risk }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "text-right",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: cn("font-mono text-xl", risk === "safe" ? "text-gain" : risk === "danger" ? "text-loss" : "text-brass"),
			children: [score, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-faint",
				children: "/100"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[10px] text-faint",
			children: "composite score"
		})]
	});
}
function PositionCard({ position, onClose }) {
	const change = (position.currentPrice / position.entryPrice - 1) * 100;
	const openedFor = Math.max(0, Date.now() - position.openedAt);
	const pnl = (position.currentPrice - position.entryPrice) * position.qty + position.realizedPnlUsd;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-line p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: position.symbol
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-faint",
					children: [
						position.chain,
						" · ",
						short(position.address)
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onClose,
					className: "inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs text-faint hover:text-cream",
					"aria-label": `Close ${position.symbol} paper position`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "size-3" }), "Close"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
					label: "Mark / entry",
					value: `${money(position.currentPrice)} / ${money(position.entryPrice)}`
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mini, {
					label: "Unrealized + realized",
					value: money(pnl)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex items-center justify-between gap-2 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: change >= 0 ? "text-gain" : "text-loss",
					children: [pct(change), " price move"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-faint",
					children: [ageText(openedFor), " open"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2 text-[11px] text-faint",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "rounded-md border border-line px-2 py-1",
						children: ["Stop ", money(position.stopPrice)]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "rounded-md border border-line px-2 py-1",
						children: ["Scale ", position.scaledOut ? "done" : money(position.scaleOutPrice)]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "rounded-md border border-line px-2 py-1",
						children: ["Trail ", position.scaledOut ? money(position.highWaterPrice * .9) : "activates after scale"]
					})
				]
			})
		]
	});
}
function Rule({ title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-line p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "flex items-center gap-2 text-sm font-medium",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownRight, { className: "size-4 text-brass" }), title]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-xs leading-relaxed text-faint",
			children: body
		})]
	});
}
var skeleton = [
	{
		id: "dexscreener",
		label: "DexScreener",
		state: "idle",
		message: "Waiting for scan",
		checkedAt: null
	},
	{
		id: "coingecko",
		label: "CoinGecko",
		state: "idle",
		message: "Optional asset enrichment",
		checkedAt: null
	},
	{
		id: "goplus",
		label: "GoPlus Security",
		state: "idle",
		message: "Waiting for checks",
		checkedAt: null
	},
	{
		id: "honeypot",
		label: "honeypot.is",
		state: "idle",
		message: "Waiting for checks",
		checkedAt: null
	},
	{
		id: "sec-edgar",
		label: "SEC EDGAR",
		state: "idle",
		message: "Best-effort filings enrichment",
		checkedAt: null
	}
];
var SplitComponent = OpportunitiesView;
//#endregion
export { SplitComponent as component };
