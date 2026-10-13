import { t as createServerFn } from "./ssr.mjs";
import { p as scoreCandidate } from "./paper-DKIhRqAY.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/market.functions-Q-lRfaPg.js
function binanceExecutionStatus() {
	const key = process.env.BINANCE_API_KEY?.trim();
	const secret = process.env.BINANCE_API_SECRET?.trim();
	if (!key || !secret) return {
		configured: false,
		note: "Binance signing is unwired. Add BINANCE_API_KEY and BINANCE_API_SECRET on the host when you want a live adapter. Orders stay off."
	};
	return {
		configured: true,
		note: "Keys are present, but this build does not submit Binance orders."
	};
}
function num(v) {
	if (v === null || v === void 0 || v === "") return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}
function fromPair(p) {
	const address = p.baseToken?.address?.trim();
	if (!address) return null;
	return scoreCandidate({
		symbol: p.baseToken?.symbol || "UNKNOWN",
		name: p.baseToken?.name || p.baseToken?.symbol || "Token",
		chain: (p.chainId || "unknown").toLowerCase(),
		address,
		priceUsd: num(p.priceUsd),
		liquidityUsd: num(p.liquidity?.usd),
		volume24h: num(p.volume?.h24),
		change24h: num(p.priceChange?.h24),
		pairCreatedAt: num(p.pairCreatedAt),
		url: p.url || null
	});
}
async function pull(url) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 6e3);
	try {
		const res = await fetch(url, {
			headers: { Accept: "application/json" },
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`Market feed HTTP ${res.status}`);
		const body = await res.json();
		if (Array.isArray(body)) {
			const pairs = [];
			for (const profile of body.slice(0, 8)) {
				if (!profile.chainId || !profile.tokenAddress) continue;
				const nested = await fetch(`https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(profile.chainId)}/${encodeURIComponent(profile.tokenAddress)}`, {
					headers: { Accept: "application/json" },
					signal: ctrl.signal
				});
				if (!nested.ok) continue;
				const data = await nested.json();
				const list = Array.isArray(data) ? data : data.pairs ?? [];
				pairs.push(...list);
			}
			return pairs;
		}
		return body.pairs ?? [];
	} finally {
		clearTimeout(timer);
	}
}
var BINANCE = [
	"BTCUSDT",
	"ETHUSDT",
	"SOLUSDT",
	"BNBUSDT",
	"XRPUSDT",
	"DOGEUSDT",
	"PEPEUSDT",
	"SUIUSDT",
	"NEARUSDT",
	"AVAXUSDT",
	"LINKUSDT",
	"ADAUSDT"
];
function binanceRows(rows) {
	const out = [];
	for (const row of rows) {
		const symbol = (row.symbol ?? "").replace("USDT", "");
		const c = scoreCandidate({
			symbol,
			name: `${symbol} / USDT`,
			chain: "binance",
			address: row.symbol ?? symbol,
			priceUsd: num(row.lastPrice),
			liquidityUsd: num(row.quoteVolume),
			volume24h: num(row.quoteVolume),
			change24h: num(row.priceChangePercent),
			pairCreatedAt: null,
			url: row.symbol ? `https://www.binance.com/en/trade/${row.symbol}` : null,
			venue: "binance"
		});
		if (c) out.push(c);
	}
	return out;
}
var cache = /* @__PURE__ */ new Map();
var CACHE_MS = 12e3;
async function getJson(url, headers, ms = 5e3) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	try {
		const res = await fetch(url, {
			headers: {
				Accept: "application/json",
				...headers
			},
			signal: ctrl.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}
function referenceRows(rows, source) {
	const out = [];
	for (const row of rows) {
		const symbol = (row.symbol || "").toUpperCase();
		if (!symbol || !row.id) continue;
		const c = scoreCandidate({
			symbol,
			name: `${row.name || symbol} · ${source === "coingecko" ? "CoinGecko" : "CMC"}`,
			chain: source,
			address: row.id,
			priceUsd: num(row.current_price),
			liquidityUsd: num(row.market_cap),
			volume24h: num(row.total_volume),
			change24h: num(row.price_change_percentage_24h),
			pairCreatedAt: null,
			url: null,
			venue: "dex"
		});
		if (c) out.push(c);
	}
	return out;
}
async function pullCoinGecko() {
	return referenceRows(await getJson("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=12&page=1&price_change_percentage=24h"), "coingecko");
}
async function pullCoinMarketCap() {
	const key = process.env.CMC_API_KEY?.trim() || process.env.COINMARKETCAP_API_KEY?.trim();
	if (!key) return {
		rows: [],
		locked: true
	};
	return {
		rows: referenceRows(((await getJson("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=12&convert=USD", { "X-CMC_PRO_API_KEY": key })).data ?? []).map((row) => ({
			id: String(row.id ?? row.symbol ?? ""),
			symbol: row.symbol,
			name: row.name,
			current_price: row.quote?.USD?.price,
			total_volume: row.quote?.USD?.volume_24h,
			market_cap: row.quote?.USD?.market_cap,
			price_change_percentage_24h: row.quote?.USD?.percent_change_24h
		})), "coinmarketcap"),
		locked: false
	};
}
var loadFeeds_createServerFn_handler = createServerRpc({
	id: "86c96e3586dc571f9577b337738d31d4cbbfedb294e013618acad662f8aaff29",
	name: "loadFeeds",
	filename: "src/lib/market.functions.ts"
}, (opts) => loadFeeds.__executeServer(opts));
var loadFeeds = createServerFn({ method: "POST" }).validator((input) => ({ query: String(input?.query ?? "").trim().slice(0, 64) })).handler(loadFeeds_createServerFn_handler, async ({ data }) => {
	const key = data.query || "*";
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_MS) return hit.pack;
	const symbols = encodeURIComponent(JSON.stringify([...BINANCE]));
	const dexUrl = data.query ? `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(data.query)}` : "https://api.dexscreener.com/token-profiles/latest/v1";
	const [bx, dx, gx, cx] = await Promise.allSettled([
		getJson(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`),
		pull(dexUrl),
		pullCoinGecko(),
		pullCoinMarketCap()
	]);
	const binance = bx.status === "fulfilled" ? binanceRows(bx.value) : [];
	const dexMap = /* @__PURE__ */ new Map();
	if (dx.status === "fulfilled") for (const c of dx.value.map(fromPair)) {
		if (!c) continue;
		const prev = dexMap.get(c.id);
		if (!prev || c.liquidityUsd > prev.liquidityUsd) dexMap.set(c.id, c);
	}
	const dex = [...dexMap.values()].sort((a, b) => b.score - a.score).slice(0, 12);
	const gecko = gx.status === "fulfilled" ? gx.value : [];
	const cmc = cx.status === "fulfilled" ? cx.value : {
		rows: [],
		locked: !process.env.CMC_API_KEY && !process.env.COINMARKETCAP_API_KEY
	};
	const health = [
		{
			id: "binance",
			label: "Binance",
			state: binance.length ? "live" : "down",
			detail: binance.length ? `${binance.length} spot quotes` : "Public ticker unavailable"
		},
		{
			id: "dex",
			label: "DEX",
			state: dex.length ? "live" : "down",
			detail: dex.length ? `${dex.length} pairs` : "DexScreener unavailable"
		},
		{
			id: "coingecko",
			label: "CoinGecko",
			state: gecko.length ? "live" : "down",
			detail: gecko.length ? `${gecko.length} markets` : "CoinGecko unavailable"
		},
		{
			id: "coinmarketcap",
			label: "CoinMarketCap",
			state: cmc.locked ? "locked" : cmc.rows.length ? "live" : "down",
			detail: cmc.locked ? "Add CMC_API_KEY on the host" : cmc.rows.length ? `${cmc.rows.length} listings` : "CMC request failed"
		}
	];
	const reference = [...gecko, ...cmc.rows].slice(0, 16);
	const executionNote = binanceExecutionStatus().note;
	const pack = {
		binance,
		dex,
		reference,
		health,
		note: health.map((row) => `${row.label} ${row.state}`).join(" · "),
		executionNote
	};
	cache.set(key, {
		at: Date.now(),
		pack
	});
	return pack;
});
var INTERVALS = /* @__PURE__ */ new Set([
	"1m",
	"5m",
	"15m",
	"1h"
]);
var loadKlines_createServerFn_handler = createServerRpc({
	id: "1a9bcaa0793bac6c3a3871a95fc0b1abeeae825d1fd8b95e86d620bcadd9db5e",
	name: "loadKlines",
	filename: "src/lib/market.functions.ts"
}, (opts) => loadKlines.__executeServer(opts));
var loadKlines = createServerFn({ method: "POST" }).validator((input) => {
	const symbol = String(input?.symbol ?? "BTCUSDT").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
	const interval = INTERVALS.has(String(input?.interval)) ? String(input?.interval) : "5m";
	return {
		symbol: symbol || "BTCUSDT",
		interval
	};
}).handler(loadKlines_createServerFn_handler, async ({ data }) => {
	try {
		const candles = (await getJson(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(data.symbol)}&interval=${data.interval}&limit=48`)).map((row) => ({
			time: Number(row[0]),
			open: Number(row[1]),
			high: Number(row[2]),
			low: Number(row[3]),
			close: Number(row[4])
		})).filter((bar) => Number.isFinite(bar.open) && Number.isFinite(bar.close));
		return {
			candles,
			note: candles.length ? `Binance ${data.symbol} ${data.interval}` : "No klines"
		};
	} catch (err) {
		return {
			candles: [],
			note: err instanceof Error ? err.message : "Klines unavailable"
		};
	}
});
var scanMarket_createServerFn_handler = createServerRpc({
	id: "b50b27850b6938f67a83fb0f0bbd29df2b9c6e58e4e61262560434ed87e6c4f9",
	name: "scanMarket",
	filename: "src/lib/market.functions.ts"
}, (opts) => scanMarket.__executeServer(opts));
var scanMarket = createServerFn({ method: "POST" }).validator((input) => ({ query: String(input?.query ?? "").trim().slice(0, 64) })).handler(scanMarket_createServerFn_handler, async ({ data }) => {
	const q = data.query;
	const url = q ? `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}` : "https://api.dexscreener.com/token-profiles/latest/v1";
	try {
		const pairs = await pull(url);
		const map = /* @__PURE__ */ new Map();
		for (const c of pairs.map(fromPair)) {
			if (!c) continue;
			const prev = map.get(c.id);
			if (!prev || c.liquidityUsd > prev.liquidityUsd) map.set(c.id, c);
		}
		const candidates = [...map.values()].sort((a, b) => b.score - a.score).slice(0, 18);
		return {
			candidates,
			source: candidates.length ? "live" : "empty",
			note: candidates.length ? `DexScreener returned ${candidates.length} names` : "Feed returned no usable pairs"
		};
	} catch (err) {
		return {
			candidates: [],
			source: "empty",
			note: err instanceof Error ? err.message : "Feed unavailable"
		};
	}
});
//#endregion
export { loadFeeds_createServerFn_handler, loadKlines_createServerFn_handler, scanMarket_createServerFn_handler };
