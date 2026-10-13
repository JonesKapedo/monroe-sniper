//#region node_modules/.nitro/vite/services/ssr/assets/paper-MZacH4KP.js
var HARD = [
	"HONEYPOT",
	"LP-UNLOCKED",
	"MINT-AUTHORITY",
	"FREEZE-AUTHORITY",
	"HIGH-TAX"
];
function assessEdge(input) {
	if ((input.flags ?? []).some((flag) => HARD.includes(flag))) return {
		act: false,
		edge: 0,
		stance: "SKIP",
		why: "Hard risk flag. No trade."
	};
	if (!(input.liquidityUsd >= 1e4)) return {
		act: false,
		edge: 0,
		stance: "SKIP",
		why: "Book too thin to clear costs."
	};
	const change = Number.isFinite(input.change24h) ? input.change24h : 0;
	const age = input.pairAgeHours;
	const sentiment = input.sentiment;
	let edge = input.score;
	const notes = [];
	if (typeof sentiment === "number" && Number.isFinite(sentiment)) {
		if (Math.sign(sentiment) !== 0 && Math.sign(change) !== 0 && Math.sign(sentiment) !== Math.sign(change)) {
			edge -= 18;
			notes.push("Social tone fights the tape");
		} else if (Math.abs(sentiment) >= .35 && Math.sign(sentiment) === Math.sign(change)) {
			edge += 6;
			notes.push("Social tone agrees");
		}
	} else notes.push("No social feed");
	if (Math.abs(change) < .45 && (age == null || age > 48) && input.score < 78) return {
		act: false,
		edge: Math.max(0, edge),
		stance: "SKIP",
		why: "Efficient quote. No fresh information edge."
	};
	if (age != null && age >= 0 && age < 8 && input.score >= 68 && input.liquidityUsd >= 2e4 && change > -3) return {
		act: true,
		edge: Math.min(100, edge + 8),
		stance: "EARLY",
		why: `Early print (${age.toFixed(1)}h). ${notes.join(". ")}`.trim()
	};
	const participation = input.liquidityUsd > 0 ? input.volume24h / input.liquidityUsd : 0;
	const trending = change >= 1.2 && participation >= .08 && input.score >= 62;
	const strongBook = input.score >= 80 && change > 0;
	if (trending || strongBook) return {
		act: true,
		edge: Math.min(100, edge),
		stance: "TREND",
		why: `Statistical lean ${change.toFixed(1)}% with participation ${participation.toFixed(2)}. ${notes.join(". ")}`.trim()
	};
	return {
		act: false,
		edge: Math.max(0, edge),
		stance: "SKIP",
		why: "Edge does not clear the prior. Stand aside."
	};
}
var MAX_IDEA = .2;
var MAX_BOOK = .6;
var MIN_LIQ = 1e4;
function emptyBook(cashUsd = 500) {
	const cash = Math.max(0, cashUsd);
	return {
		cash,
		positions: [],
		trades: [],
		peakEquity: Math.max(cash, 1),
		dayPnl: 0,
		consecutiveLosses: 0,
		cooldownUntil: null,
		kill: false,
		killReason: null
	};
}
function exposure(book) {
	return book.positions.reduce((s, p) => s + p.qty * p.mark, 0);
}
function equity(book) {
	return book.cash + exposure(book);
}
function scoreCandidate(input) {
	if (!input.address || !input.priceUsd || input.priceUsd <= 0) return null;
	const liq = input.liquidityUsd ?? 0;
	const vol = input.volume24h ?? 0;
	const chg = input.change24h ?? 0;
	const ageH = input.pairCreatedAt ? Math.max(0, (Date.now() - input.pairCreatedAt) / 36e5) : null;
	const liqScore = Math.max(0, Math.min(100, liq / 1e5 * 100));
	const mom = Math.max(0, Math.min(100, 50 + chg * .35));
	const novelty = ageH === null ? 30 : Math.max(0, Math.min(100, 100 - ageH * 1.5));
	let score = .7 * liqScore + .2 * mom + .1 * novelty;
	const flags = [];
	const rationale = [];
	if (vol > 0 && liq > 0 && vol / liq > .4) {
		score += 6;
		rationale.push("Volume is active relative to pool depth");
	}
	if (chg > 120) {
		score -= 18;
		flags.push("EXTREME-MOVE");
		rationale.push("24h move is extreme; treat as unstable");
	}
	if (liq < 1e4) {
		flags.push("THIN");
		rationale.push("Liquidity is under $10k");
	}
	if (ageH !== null && ageH < 6) {
		flags.push("FRESH");
		rationale.push("Pair is under six hours old");
	}
	if (!rationale.length) rationale.push("Ordinary tape; size only if the gate clears");
	score = Math.round(Math.max(0, Math.min(100, score)));
	return {
		id: `${input.chain}:${input.address.toLowerCase()}`,
		symbol: input.symbol.toUpperCase(),
		name: input.name,
		chain: input.chain,
		address: input.address,
		priceUsd: input.priceUsd,
		liquidityUsd: liq,
		volume24h: vol,
		change24h: chg,
		pairAgeHours: ageH,
		url: input.url,
		score,
		flags,
		rationale,
		venue: input.venue ?? "dex"
	};
}
/** Constant-product style impact, capped. */
function impactPct(notional, liquidity) {
	if (liquidity <= 0 || notional <= 0) return .02;
	return Math.min(.35, notional / (2 * liquidity));
}
function simulateBuy(notional, mid, liquidity) {
	const impact = impactPct(notional, liquidity);
	const fee = .003;
	const buffer = .005;
	const gas = notional < 50 ? .1 : 1.5;
	const fill = mid * (1 + impact + buffer);
	const costPct = notional > 0 ? (notional * (impact + buffer + fee) + gas) / notional : 1;
	const qty = Math.max(0, (notional - notional * fee - gas) / fill);
	const reasons = [];
	if (costPct > .06) reasons.push(`Expected cost ${(costPct * 100).toFixed(1)}% is above 6%`);
	if (liquidity < notional * 8) reasons.push("Pool is thin versus the intended size");
	if (qty <= 0) reasons.push("Nothing left after fees");
	return {
		fill,
		qty,
		impact,
		costPct,
		acceptable: reasons.length === 0,
		reasons
	};
}
function portfolioLines(book, now = Date.now()) {
	const eq = equity(book);
	const peak = Math.max(book.peakEquity, eq);
	const dd = peak > 0 ? (peak - eq) / peak : 0;
	const dayLoss = peak > 0 ? Math.max(0, -book.dayPnl) / peak : 0;
	const cooling = book.cooldownUntil !== null && now < book.cooldownUntil;
	return [
		{
			id: "kill",
			label: "Kill switch off",
			pass: !book.kill,
			detail: book.kill ? book.killReason ?? "Halted" : "Entries allowed"
		},
		{
			id: "cool",
			label: "No loss cooldown",
			pass: !cooling,
			detail: cooling ? "Waiting out consecutive losses" : "Clear"
		},
		{
			id: "day",
			label: "Daily loss under 5%",
			pass: dayLoss <= .05,
			detail: `Day P&L ${book.dayPnl.toFixed(0)}`
		},
		{
			id: "dd",
			label: "Drawdown under 15%",
			pass: dd <= .15,
			detail: `${(dd * 100).toFixed(1)}% from peak`
		}
	];
}
function entryVerdict(book, c, now = Date.now(), minScore = 62) {
	const eq = equity(book);
	const exp = exposure(book);
	const room = Math.max(0, eq * MAX_BOOK - exp);
	const notional = Math.max(0, Math.min(eq * MAX_IDEA, book.cash, room));
	const dup = book.positions.some((p) => p.tokenId === c.id);
	const lines = [
		...portfolioLines(book, now),
		{
			id: "score",
			label: `Score at least ${minScore}`,
			pass: c.score >= minScore,
			detail: `${c.score}/100`
		},
		{
			id: "liq",
			label: "Liquidity at least $10k",
			pass: c.liquidityUsd >= MIN_LIQ,
			detail: `$${Math.round(c.liquidityUsd).toLocaleString()}`
		},
		{
			id: "slots",
			label: "Open slot",
			pass: book.positions.length < 3,
			detail: `${book.positions.length}/3`
		},
		{
			id: "dup",
			label: "Not already held",
			pass: !dup,
			detail: dup ? "Already in the book" : "New name"
		},
		{
			id: "cash",
			label: "Cash and cap allow a ticket",
			pass: notional >= 5,
			detail: `Planned $${notional.toFixed(0)}`
		}
	];
	const sim = lines.every((l) => l.pass) && notional > 0 ? simulateBuy(notional, c.priceUsd, c.liquidityUsd) : null;
	if (sim && !sim.acceptable) lines.push({
		id: "exec",
		label: "Executable inside cost budget",
		pass: false,
		detail: sim.reasons.join("; ")
	});
	else if (sim) lines.push({
		id: "exec",
		label: "Executable inside cost budget",
		pass: true,
		detail: `Impact ${(sim.impact * 100).toFixed(2)}%, fill $${sim.fill.toPrecision(4)}`
	});
	return {
		allowed: lines.every((l) => l.pass) && Boolean(sim?.acceptable),
		lines,
		notional,
		sim
	};
}
function stamp(prefix) {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function enter(book, c, now = Date.now(), minScore = 62, customSizing) {
	const v = entryVerdict(book, c, now, minScore);
	if (!v.allowed || !v.sim) return {
		book,
		ok: false,
		note: v.lines.filter((l) => !l.pass).map((l) => l.label).join(", ") || "Blocked"
	};
	const notionalToUse = Math.min(book.cash, customSizing?.notional ?? v.notional);
	const qtyToUse = notionalToUse > 0 ? notionalToUse / v.sim.fill : v.sim.qty;
	const stopToUse = customSizing?.stop ?? v.sim.fill * .92;
	const targetToUse = customSizing?.target ?? v.sim.fill * 1.06;
	const pos = {
		id: stamp("pos"),
		tokenId: c.id,
		symbol: c.symbol,
		chain: c.chain,
		qty: qtyToUse,
		entryPrice: v.sim.fill,
		mark: v.sim.fill,
		stop: stopToUse,
		target: targetToUse,
		openedAt: now,
		notional: notionalToUse,
		venue: c.venue
	};
	return {
		book: armIfNeeded({
			...book,
			cash: book.cash - notionalToUse,
			positions: [...book.positions, pos],
			peakEquity: Math.max(book.peakEquity, equity({
				...book,
				cash: book.cash - notionalToUse,
				positions: [...book.positions, pos]
			}))
		}),
		ok: true,
		note: `Paper fill ${c.symbol}`
	};
}
function markBook(book, prices, now = Date.now()) {
	let next = book;
	const kept = [];
	const extraTrades = [];
	let cash = book.cash;
	let day = book.dayPnl;
	let streak = book.consecutiveLosses;
	let cool = book.cooldownUntil;
	for (const p of book.positions) {
		const px = prices[p.tokenId] && prices[p.tokenId] > 0 ? prices[p.tokenId] : p.mark;
		const aged = now - p.openedAt > 216e5;
		let activeStop = p.stop;
		if (px >= p.entryPrice * 1.03 && activeStop < p.entryPrice * 1.008) activeStop = p.entryPrice * 1.008;
		const stopped = px <= activeStop;
		const targetHit = px >= (p.target ?? p.entryPrice * 1.06);
		if (aged || stopped || targetHit) {
			const pnl = (px - p.entryPrice) * p.qty;
			cash += p.qty * px;
			day += pnl;
			streak = pnl < 0 ? streak + 1 : 0;
			if (streak >= 3) cool = now + 144e5;
			extraTrades.push({
				id: stamp("tr"),
				symbol: p.symbol,
				pnl,
				reason: targetHit ? "TARGET" : stopped ? px > p.entryPrice ? "BREAKEVEN" : "STOP" : "TIME",
				closedAt: now
			});
		} else kept.push({
			...p,
			mark: px,
			stop: activeStop
		});
	}
	next = {
		...book,
		cash,
		positions: kept,
		trades: [...extraTrades, ...book.trades].slice(0, 40),
		dayPnl: day,
		consecutiveLosses: streak,
		cooldownUntil: cool
	};
	const eq = equity(next);
	next.peakEquity = Math.max(book.peakEquity, eq);
	return armIfNeeded(next);
}
function closeOne(book, id, now = Date.now()) {
	const p = book.positions.find((x) => x.id === id);
	if (!p) return book;
	const pnl = (p.mark - p.entryPrice) * p.qty;
	const streak = pnl < 0 ? book.consecutiveLosses + 1 : 0;
	const next = {
		...book,
		cash: book.cash + p.qty * p.mark,
		positions: book.positions.filter((x) => x.id !== id),
		trades: [{
			id: stamp("tr"),
			symbol: p.symbol,
			pnl,
			reason: "MANUAL",
			closedAt: now
		}, ...book.trades].slice(0, 40),
		dayPnl: book.dayPnl + pnl,
		consecutiveLosses: streak,
		cooldownUntil: streak >= 3 ? now + 144e5 : book.cooldownUntil
	};
	next.peakEquity = Math.max(book.peakEquity, equity(next));
	return armIfNeeded(next);
}
function armIfNeeded(book) {
	const eq = equity(book);
	const peak = Math.max(book.peakEquity, eq);
	const dd = peak > 0 ? (peak - eq) / peak : 0;
	const dayLoss = peak > 0 ? Math.max(0, -book.dayPnl) / peak : 0;
	if (!book.kill && (dd > .15 || dayLoss > .05)) return {
		...book,
		peakEquity: peak,
		kill: true,
		killReason: dd > .15 ? "Drawdown limit" : "Daily loss limit"
	};
	return {
		...book,
		peakEquity: peak
	};
}
function setKill(book, on) {
	return {
		...book,
		kill: on,
		killReason: on ? "Operator halt" : null
	};
}
/** Sample tape so the desk is usable when public APIs are quiet. */
function sampleTape(now = Date.now()) {
	return [
		[
			"WETH",
			"Wrapped Ether",
			"ethereum",
			"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			3200,
			18e7,
			9e8,
			1.2,
			4e4
		],
		[
			"PEPE",
			"Pepe",
			"ethereum",
			"0x6982508145454Ce325dDbE47a25d4ec3d2311933",
			9e-6,
			42e6,
			8e7,
			6.4,
			8e3
		],
		[
			"AERO",
			"Aerodrome",
			"base",
			"0x940181a94A35A4569E4529A3CDfB74e38FD98631",
			1.15,
			28e6,
			12e6,
			3.1,
			2e3
		],
		[
			"BONK",
			"Bonk",
			"solana",
			"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
			21e-6,
			95e5,
			22e6,
			-4.2,
			12e3
		],
		[
			"NEW",
			"Fresh Pool",
			"base",
			"0x1111111111111111111111111111111111111111",
			.04,
			6200,
			4e4,
			80,
			2
		]
	].map((r) => scoreCandidate({
		symbol: r[0],
		name: r[1],
		chain: r[2],
		address: r[3],
		priceUsd: r[4],
		liquidityUsd: r[5],
		volume24h: r[6],
		change24h: r[7],
		pairCreatedAt: now - r[8] * 36e5,
		url: null,
		venue: "dex"
	})).filter((x) => x !== null);
}
function emptyMemory() {
	return {
		seen: 0,
		wins: 0,
		losses: 0,
		realized: 0,
		minScore: 62
	};
}
/** Nudge the score floor from closed-trade evidence. History is the only teacher. */
function learn(memory, pnl) {
	const wins = memory.wins + (pnl > 0 ? 1 : 0);
	const losses = memory.losses + (pnl < 0 ? 1 : 0);
	const seen = memory.seen + 1;
	const realized = memory.realized + pnl;
	let minScore = memory.minScore;
	if (seen >= 4) {
		const winRate = wins / seen;
		if (winRate < .4 || realized < 0) minScore = Math.min(85, minScore + 2);
		else if (winRate > .55 && realized > 0) minScore = Math.max(55, minScore - 1);
	}
	return {
		seen,
		wins,
		losses,
		realized,
		minScore
	};
}
function chooseEntry(book, tape, minScore, now = Date.now()) {
	const ranked = tape.map((c) => ({
		c,
		edge: assessEdge(c)
	})).filter((row) => row.edge.act).sort((a, b) => b.edge.edge - a.edge.edge || b.c.score - a.c.score);
	for (const row of ranked) if (entryVerdict(book, row.c, now, minScore).allowed) return row.c;
	return null;
}
function deposit(book, amount) {
	if (!(amount > 0)) return book;
	const next = {
		...book,
		cash: book.cash + amount
	};
	next.peakEquity = Math.max(book.peakEquity, equity(next));
	return next;
}
function withdraw(book, amount) {
	if (!(amount > 0)) return {
		book,
		ok: false,
		note: "Amount must be positive"
	};
	if (amount > book.cash + 1e-4) return {
		book,
		ok: false,
		note: "Not enough free cash"
	};
	return {
		book: {
			...book,
			cash: book.cash - amount
		},
		ok: true,
		note: "Withdrawal posted to the ledger"
	};
}
//#endregion
export { emptyBook as a, equity as c, markBook as d, portfolioLines as f, withdraw as g, setKill as h, deposit as i, exposure as l, scoreCandidate as m, chooseEntry as n, emptyMemory as o, sampleTape as p, closeOne as r, enter as s, assessEdge as t, learn as u };
