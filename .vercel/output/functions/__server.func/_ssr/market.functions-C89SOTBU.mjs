import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { u as scoreCandidate } from "./paper-DIU7_PCo.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/market.functions-C89SOTBU.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
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
export { scanMarket_createServerFn_handler };
