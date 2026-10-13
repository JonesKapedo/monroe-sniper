import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, n as Card, r as Label, t as Button } from "./ui-9RT2T2XE.mjs";
import { c as equity, f as portfolioLines, l as exposure, p as sampleTape } from "./paper-MZacH4KP.mjs";
import { r as create } from "../_libs/zustand.mjs";
import { F as Coins, I as Clock, M as Crosshair, T as Pause, _ as Scale, b as RefreshCw, c as Sparkles, f as ShieldCheck, h as Search, j as Earth, o as TriangleAlert, p as ShieldAlert, s as TrendingUp, t as Zap, u as Shield, w as Play, y as Rocket, z as CircleCheck } from "../_libs/lucide-react.mjs";
import { c as formatNairobiTime, d as scanAllAvenues, f as useDesk, n as LiveModeTransitionModal } from "./router-BNCp43VR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B2w1xlmw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var useFeedHealth = create((set) => ({
	rows: [],
	setRows: (rows) => set({ rows })
}));
var money = (n) => n.toLocaleString("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 2
});
var px = (n) => {
	if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
	return `$${n.toPrecision(4)}`;
};
function Desk() {
	const mode = useDesk((s) => s.mode);
	const setMode = useDesk((s) => s.setMode);
	const power = useDesk((s) => s.power);
	const setPower = useDesk((s) => s.setPower);
	const demo = useDesk((s) => s.demo);
	const live = useDesk((s) => s.live);
	const memory = useDesk((s) => s.memory);
	const tape = useDesk((s) => s.tape);
	const log = useDesk((s) => s.log);
	const setTape = useDesk((s) => s.setTape);
	const tick = useDesk((s) => s.tick);
	const autoStep = useDesk((s) => s.autoStep);
	const manualEnter = useDesk((s) => s.manualEnter);
	const flatten = useDesk((s) => s.flatten);
	const flattenAll = useDesk((s) => s.flattenAll);
	const resetDemo = useDesk((s) => s.resetDemo);
	const botStartedAt = useDesk((s) => s.botStartedAt);
	const disciplineRules = useDesk((s) => s.disciplineRules);
	const getReadiness = useDesk((s) => s.getReadiness);
	const readiness = getReadiness ? getReadiness() : null;
	const [query, setQuery] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [filterVenue, setFilterVenue] = (0, import_react.useState)("all");
	const [avenueFilter, setAvenueFilter] = (0, import_react.useState)("ALL");
	const [showReadinessModal, setShowReadinessModal] = (0, import_react.useState)(false);
	const [showLiveModal, setShowLiveModal] = (0, import_react.useState)(false);
	const [nowTs, setNowTs] = (0, import_react.useState)(Date.now());
	(0, import_react.useEffect)(() => {
		const timer = window.setInterval(() => setNowTs(Date.now()), 1e3);
		return () => window.clearInterval(timer);
	}, []);
	const nairobi = formatNairobiTime(botStartedAt, nowTs);
	const book = mode === "live" ? live : demo;
	const eq = equity(book);
	const exp = exposure(book);
	const wins = book.trades.filter((t) => t.pnl > 0).length;
	const hitRate = book.trades.length > 0 ? wins / book.trades.length * 100 : 0;
	const avenues = scanAllAvenues(book, disciplineRules, nowTs);
	const scan = (0, import_react.useCallback)(async (q) => {
		setBusy(true);
		try {
			const res = await loadFeeds({ data: { query: q } });
			const combined = [
				...res.binance,
				...res.dex,
				...res.reference
			];
			useFeedHealth.getState().setRows(res.health);
			if (combined.length) setTape(combined, res.note);
			else setTape(sampleTape(), "Loaded built-in baseline pairs.");
		} catch {
			setTape(sampleTape(), "Offline feed fallback. Using built-in global universe.");
		} finally {
			setBusy(false);
		}
	}, [setTape]);
	const snipeAvenue = (0, import_react.useCallback)((opp) => {
		const aveCand = {
			id: opp.id,
			symbol: opp.symbol,
			name: opp.symbol,
			address: opp.id,
			chain: opp.chain,
			venue: opp.venueA.toLowerCase().includes("binance") ? "binance" : "dex",
			priceUsd: opp.priceA,
			change24h: (opp.grossSpreadPct ?? 2.5) * (opp.perpSide === "SHORT" ? -1 : 1),
			volume24h: 85e4,
			liquidityUsd: 42e4,
			score: opp.confidenceScore,
			pairAgeHours: 24,
			url: null,
			flags: [],
			rationale: [opp.title, ...opp.disciplineNotes ?? []]
		};
		manualEnter(aveCand);
	}, [manualEnter]);
	(0, import_react.useEffect)(() => {
		scan("");
	}, [scan]);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			const prices = {};
			const positions = useDesk.getState()[useDesk.getState().mode].positions;
			for (const p of positions) {
				const drift = 1 + (Math.random() - .48) * .015;
				prices[p.tokenId] = p.mark * drift;
			}
			if (Object.keys(prices).length) tick(prices);
			if (useDesk.getState().power) autoStep();
		}, 3e3);
		return () => window.clearInterval(id);
	}, [tick, autoStep]);
	const filteredTape = tape.filter((c) => {
		if (filterVenue === "all") return true;
		return c.venue === filterVenue;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-bold tracking-tight md:text-3xl",
						children: "Global Sniper Desk"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase", mode === "live" ? "border border-amber-500/40 bg-amber-500/15 text-amber-300" : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"),
						children: mode === "live" ? "Live Trading Active" : "Demo Mode ($500)"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-faint md:text-sm",
					children: mode === "live" ? "Live execution rail. Real cash ledger active. Connect signing keys or manage funds in the Wallet." : "Safe simulated paper environment. Starts at $500. Bot combs global markets, analyzes risk, and learns from every fill."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2 sm:gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center rounded-xl border border-line bg-panel-2 p-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setMode("demo"),
								className: cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-all", mode === "demo" ? "bg-brass text-ink shadow-sm" : "text-faint hover:text-cream"),
								children: "🟢 Paper Trading ($500)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => {
									if (mode !== "live") setShowLiveModal(true);
									else setShowLiveModal(true);
								},
								className: cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-all", mode === "live" ? "bg-amber-500 text-ink shadow-sm" : "text-faint hover:text-cream"),
								children: [
									"🔴 Live Trading ($",
									live.cash.toFixed(0),
									")"
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: power ? "solid" : "ghost",
							onClick: () => setPower(!power),
							className: cn("font-semibold", power ? "bg-gain text-ink hover:bg-gain/90" : "border-line text-faint hover:text-cream"),
							children: power ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "mr-1.5 size-4" }), " Armed & Hunting"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "mr-1.5 size-4" }), " Arm Sniper Bot"] })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => scan(query),
							disabled: busy,
							title: "Scan global feeds",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("size-4", busy && "animate-spin") })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "danger",
							onClick: () => flattenAll(),
							disabled: book.positions.length === 0,
							title: "Flatten all open positions",
							children: "Flatten All"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col justify-between gap-3 rounded-xl border border-line bg-panel p-3.5 sm:flex-row sm:items-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex size-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brass",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						suppressHydrationWarning: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold text-brass uppercase tracking-wider",
								children: "EAT GMT(+3) Nairobi Timezone"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300",
								suppressHydrationWarning: true,
								children: [nairobi.dayLabel, " (Started Today)"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-sm font-semibold text-cream",
							suppressHydrationWarning: true,
							children: [
								nairobi.dayOfWeek,
								", ",
								nairobi.dateString,
								" · ",
								nairobi.timeString
							]
						})]
					})]
				}), readiness && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 border-t border-line/60 pt-2 sm:border-t-0 sm:pt-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-left sm:text-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-faint",
								children: "Live Capital Readiness:"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: cn("font-bold", readiness.readinessScore >= 85 ? "text-gain" : "text-amber-400"),
								children: [
									readiness.readinessScore,
									"% (",
									readiness.status,
									")"
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11px] text-faint",
							children: [
								readiness.completedDemoTrades,
								"/",
								readiness.targetDemoTrades,
								" demo trades trained · ",
								readiness.currentWinRatePct,
								"% win rate"
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						onClick: () => setShowReadinessModal(true),
						className: "h-8 border border-line px-2.5 text-xs text-brass hover:border-brass",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "mr-1 size-3.5" }), " Audit Readiness"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: `${mode.toUpperCase()} EQUITY`,
						value: money(eq),
						sub: mode === "demo" ? "Sandbox Balance" : "Live Ledger"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "DAY P&L",
						value: (book.dayPnl >= 0 ? "+" : "") + money(book.dayPnl),
						tone: book.dayPnl >= 0 ? "gain" : "loss",
						sub: eq > 0 ? `${(book.dayPnl / eq * 100).toFixed(2)}% ROI` : "0.00%"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "AVAILABLE CASH",
						value: money(book.cash),
						sub: `Risk cap: ${money(eq * .6)}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "HIT RATE",
						value: book.trades.length > 0 ? `${hitRate.toFixed(1)}%` : "—",
						sub: `${book.trades.length} closed trades`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "OPEN RISK",
						value: money(exp),
						sub: `${book.positions.length}/3 positions held`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "ADAPTIVE BRAIN",
						value: `${memory.minScore}/100`,
						sub: memory.seen >= 4 ? `Tuned on ${memory.seen} trades` : "Initial threshold",
						accent: true
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 md:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4 text-brass" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-lg font-bold text-cream",
									children: "Universal Money-Making Avenues"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded bg-brass/10 px-2 py-0.5 text-xs font-semibold text-brass",
									children: "Perps · Arbitrage · Early IPOs · Yield Basis"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-xs text-faint",
							children: "Autonomous sniper exploring diverse market revenue streams with quantitative discipline."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-1.5 text-[11px]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-1 rounded border border-loss/30 bg-loss/10 px-2 py-0.5 font-medium text-loss",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "size-3" }), " Max Loss: -3.0% Circuit Breaker"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-1 rounded border border-gain/30 bg-gain/10 px-2 py-0.5 font-medium text-gain",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "size-3" }), " Min R:R ≥ 2.5:1 Floor"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-medium text-purple-300",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "size-3" }), " Dynamic Trailing Stops"]
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-1.5 border-b border-line/60 pb-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setAvenueFilter("ALL"),
								className: cn("rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors", avenueFilter === "ALL" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream"),
								children: [
									"All Avenues (",
									avenues.length,
									")"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setAvenueFilter("PERPS"),
								className: cn("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors", avenueFilter === "PERPS" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3" }), " Perps & Funding (3)"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setAvenueFilter("ARBITRAGE"),
								className: cn("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors", avenueFilter === "ARBITRAGE" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "size-3" }), " DEX-CEX Arbitrage (2)"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setAvenueFilter("EARLY_IPO"),
								className: cn("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors", avenueFilter === "EARLY_IPO" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rocket, { className: "size-3" }), " Early IPOs & Launches (2)"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setAvenueFilter("YIELD_BASIS"),
								className: cn("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors", avenueFilter === "YIELD_BASIS" ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Coins, { className: "size-3" }), " Staking Yield Basis (1)"]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
						children: avenues.filter((a) => avenueFilter === "ALL" ? true : a.category === avenueFilter).map((opp) => {
							const isHeld = book.positions.some((p) => p.tokenId === opp.id);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: cn("flex flex-col justify-between rounded-xl border p-3.5 transition-all", isHeld ? "border-gain/60 bg-gain/5" : "border-line bg-panel-2 hover:border-line/80"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-bold text-cream",
													children: opp.symbol
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", opp.category === "PERPS" && "bg-amber-500/20 text-amber-300", opp.category === "ARBITRAGE" && "bg-cyan-500/20 text-cyan-300", opp.category === "EARLY_IPO" && "bg-pink-500/20 text-pink-300", opp.category === "YIELD_BASIS" && "bg-emerald-500/20 text-emerald-300"),
													children: opp.category
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[10px] text-faint",
													children: [
														"(",
														opp.chain,
														")"
													]
												})
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-0.5 text-xs font-medium text-cream",
											children: opp.title
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-mono text-sm font-bold text-cream",
												children: px(opp.priceA)
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[10px] text-faint",
												children: opp.venueB ? `${opp.venueA} ↔ ${opp.venueB}` : opp.venueA
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 grid grid-cols-2 gap-2 rounded-lg border border-line/50 bg-panel p-2 text-[11px]",
										children: [
											opp.category === "PERPS" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Funding Rate:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-mono font-semibold text-gain",
												children: opp.fundingRate8h ? `+${(opp.fundingRate8h * 100).toFixed(3)}%/8h` : "—"
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Annualized Yield:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-mono font-semibold text-brass",
												children: opp.fundingApr ? `${opp.fundingApr}% APR` : "—"
											})] })] }),
											opp.category === "ARBITRAGE" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Gross Spread:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "font-mono font-semibold text-gain",
												children: [
													"+",
													opp.grossSpreadPct,
													"%"
												]
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Net Profit (Post-Gas):"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "font-mono font-semibold text-emerald-400",
												children: ["+$", opp.netProfitUsd?.toFixed(2)]
											})] })] }),
											opp.category === "EARLY_IPO" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Liquidity Lock:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "font-mono font-semibold text-cream",
												children: [opp.liquidityLockDays, " Days Locked"]
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Anti-Rug Score:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "font-mono font-semibold text-emerald-400",
												children: [opp.rugScore, "/100 Safe"]
											})] })] }),
											opp.category === "YIELD_BASIS" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Peg Stability:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-mono font-semibold text-gain",
												children: "99.98% Pegged"
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-faint",
												children: "Expected APY:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "font-mono font-semibold text-brass",
												children: [opp.expectedApy, "% APY"]
											})] })] })
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2.5 flex items-center justify-between text-[11px] text-faint",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["R:R Multiple: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
												className: "text-brass",
												children: [opp.riskRewardRatio, "R"]
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Stop: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
												className: "text-loss",
												children: [
													px(opp.stopLossPrice),
													" (-",
													(opp.stopLossPct * 100).toFixed(1),
													"%)"
												]
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Target: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-gain",
												children: px(opp.targetPrice)
											})] })
										]
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex items-center justify-between border-t border-line/60 pt-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[10px] text-faint",
										children: ["Confidence: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "text-cream",
											children: [opp.confidenceScore, "%"]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: isHeld || book.positions.length >= 3,
										onClick: () => snipeAvenue(opp),
										className: cn("rounded-lg px-3 py-1 text-xs font-semibold transition-colors", isHeld ? "cursor-default text-gain" : "bg-brass text-ink hover:bg-brass/90 shadow-sm"),
										children: isHeld ? "Held" : "Simulate Snipe"
									})]
								})]
							}, opp.id);
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Earth, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "text-sm font-semibold tracking-wider text-faint uppercase",
							children: [
								"Global Market Intelligence (",
								tape.length,
								" pairs live)"
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex rounded-lg border border-line bg-panel p-0.5 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setFilterVenue("all"),
									className: cn("rounded px-2 py-0.5 font-medium", filterVenue === "all" ? "bg-panel-2 text-cream" : "text-faint"),
									children: "All"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setFilterVenue("binance"),
									className: cn("rounded px-2 py-0.5 font-medium", filterVenue === "binance" ? "bg-panel-2 text-cream" : "text-faint"),
									children: "Binance CEX"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setFilterVenue("dex"),
									className: cn("rounded px-2 py-0.5 font-medium", filterVenue === "dex" ? "bg-panel-2 text-cream" : "text-faint"),
									children: "Raydium / DEX"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
							onSubmit: (e) => {
								e.preventDefault();
								scan(query);
							},
							className: "flex items-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: query,
									onChange: (e) => setQuery(e.target.value),
									placeholder: "Filter ticker / address…",
									className: "h-8 rounded-lg border border-line bg-panel pl-8 pr-3 text-xs text-cream outline-none focus:border-brass"
								})]
							})
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex w-full min-w-0 max-w-full gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin",
					children: filteredTape.slice(0, 14).map((c) => {
						const isHeld = book.positions.some((p) => p.tokenId === c.id);
						const clearsScore = c.score >= memory.minScore;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: cn("flex min-w-[220px] flex-col justify-between rounded-xl border p-3 transition-colors", isHeld ? "border-gain/60 bg-gain/5" : clearsScore ? "border-brass/40 bg-panel hover:border-brass" : "border-line bg-panel hover:border-line/80"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-bold text-cream",
										children: c.symbol
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("rounded px-1 text-[9px] font-semibold uppercase", c.venue === "binance" ? "bg-amber-500/20 text-amber-300" : "bg-purple-500/20 text-purple-300"),
										children: c.venue === "binance" ? "Binance" : c.chain
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "num text-xs text-faint",
									children: ["Vol $", Math.round(c.volume24h).toLocaleString()]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "num text-sm font-semibold",
										children: px(c.priceUsd)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: cn("num text-xs font-medium", c.change24h >= 0 ? "text-gain" : "text-loss"),
										children: [
											c.change24h >= 0 ? "+" : "",
											c.change24h.toFixed(2),
											"%"
										]
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2.5 flex items-center justify-between border-t border-line/60 pt-2 text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: cn("font-mono font-medium", clearsScore ? "text-brass" : "text-faint"),
									children: [
										"Score: ",
										c.score,
										"/100"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: isHeld || book.positions.length >= 3,
									onClick: () => manualEnter(c),
									className: cn("rounded px-2 py-0.5 text-[11px] font-medium transition-colors", isHeld ? "cursor-default text-gain" : "bg-panel-2 text-cream hover:bg-brass hover:text-ink"),
									children: isHeld ? "Held" : "Snipe"
								})]
							})]
						}, c.id);
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-5 lg:grid-cols-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-4 lg:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "flex flex-col gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: [
								"Active Bot Positions (",
								book.positions.length,
								"/3)"
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-faint",
								children: "Automatic brackets: Trailing Stop Loss @ -8%, Fast Take Profit @ +6%"
							})] }), book.positions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => flattenAll(),
								className: "rounded-md border border-line px-2.5 py-1 text-xs text-loss hover:bg-loss/10",
								children: "Flatten All"
							})]
						}), book.positions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-12 text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-8 text-faint/60" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm font-medium text-cream",
									children: "No Active Open Positions"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 max-w-sm text-xs text-faint",
									children: power ? "Sniper bot is armed and hunting for setups clearing the adaptive score threshold." : "Bot is on standby. Arm the sniper above or click 'Snipe' on any pair."
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-col gap-2.5",
							children: book.positions.map((p) => {
								const pnl = (p.mark - p.entryPrice) * p.qty;
								const pnlPct = (p.mark - p.entryPrice) / p.entryPrice * 100;
								const targetPx = p.target ?? p.entryPrice * 1.06;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col justify-between gap-3 rounded-xl border border-line bg-panel-2 p-3 sm:flex-row sm:items-center",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-base font-bold text-cream",
												children: p.symbol
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "rounded bg-panel px-1.5 py-0.5 text-[10px] text-faint uppercase",
												children: p.chain
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "rounded bg-gain/10 px-1.5 py-0.5 text-[10px] font-semibold text-gain",
												children: "LONG"
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "num mt-0.5 text-xs text-faint",
										children: [
											"Entry ",
											px(p.entryPrice),
											" · Mark ",
											px(p.mark),
											" · Stop ",
											px(p.stop),
											" · Take Profit ",
											px(targetPx)
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-4 sm:justify-end",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: cn("num text-sm font-bold", pnl >= 0 ? "text-gain" : "text-loss"),
												children: [
													pnl >= 0 ? "+" : "",
													money(pnl),
													" (",
													pnlPct >= 0 ? "+" : "",
													pnlPct.toFixed(2),
													"%)"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "num text-[11px] text-faint",
												children: ["Size: $", p.notional.toFixed(2)]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											onClick: () => flatten(p.id),
											className: "h-8 border border-line text-xs hover:border-loss hover:text-loss",
											children: "Flatten"
										})]
									})]
								}, p.id);
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Recent Closed Trades & Realized P&L" }), book.trades.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs text-faint",
						children: "No closed executions yet in this session."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "border-b border-line text-faint uppercase",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 font-normal",
										children: "Symbol"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 font-normal",
										children: "Reason"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 font-normal",
										children: "Closed At"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 text-right font-normal",
										children: "Realized P&L"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
								className: "divide-y divide-line/60",
								children: book.trades.slice(0, 6).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "hover:bg-panel-2/50",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2.5 font-medium text-cream",
											children: t.symbol
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2.5",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", t.reason === "TARGET" ? "bg-gain/20 text-gain" : t.reason === "STOP" ? "bg-loss/20 text-loss" : "bg-panel text-faint"),
												children: t.reason === "TARGET" ? "Take Profit" : t.reason === "STOP" ? "Stop Loss" : t.reason
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2.5 font-mono text-faint",
											children: new Date(t.closedAt).toLocaleTimeString()
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
											className: cn("py-2.5 text-right font-mono font-semibold", t.pnl >= 0 ? "text-gain" : "text-loss"),
											children: [t.pnl >= 0 ? "+" : "", money(t.pnl)]
										})
									]
								}, t.id))
							})]
						})
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 text-brass",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Automated Risk Gates" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "mt-3 flex flex-col gap-2 text-xs",
							children: [
								portfolioLines(book).map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center justify-between gap-2 border-b border-line/50 pb-1.5 last:border-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: line.pass ? "text-cream" : "text-loss",
										children: line.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("num font-medium", line.pass ? "text-gain" : "text-loss"),
										children: line.detail
									})]
								}, line.id)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center justify-between gap-2 border-b border-line/50 pb-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-cream",
										children: "Adaptive Score Floor"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "num font-medium text-brass",
										children: [memory.minScore, "/100"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-cream",
										children: "Max Idea Allocation"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "num font-medium text-cream",
										children: [
											"20% ($",
											(eq * .2).toFixed(2),
											")"
										]
									})]
								})
							]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "flex flex-1 flex-col",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Sniper Operational Feed" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-faint",
									children: "Live telemetry"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3 flex max-h-80 flex-1 flex-col gap-1.5 overflow-y-auto font-mono text-xs text-faint scrollbar-thin",
								children: log.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Standing by. Telemetry will print here." }) : log.slice(0, 18).map((line, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start gap-1.5 text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-brass/70",
										children: "›"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-cream/90",
										children: line
									})]
								}, `${line}-${idx}`))
							})]
						}),
						mode === "demo" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-xl border border-line p-3 text-xs text-faint",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reset Demo Desk to $500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => resetDemo(),
									className: "rounded border border-line px-2 py-1 text-cream hover:bg-panel-2",
									children: "Reset Demo"
								})]
							})
						})
					]
				})]
			}),
			showReadinessModal && readiness && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex max-h-[90vh] w-full max-w-xl flex-col overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border-b border-line pb-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-9 items-center justify-center rounded-xl bg-brass/10 text-brass",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-lg font-bold text-cream",
									children: "Real-Money Readiness Audit"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-faint",
									children: "Quantitative scorecard for transitioning from Demo Sandbox to Live Funds"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowReadinessModal(false),
								className: "rounded-lg p-1.5 text-faint hover:bg-panel-2 hover:text-cream",
								children: "✕"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "my-5 rounded-xl border border-line bg-panel-2 p-4 text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-faint",
									children: "Overall Readiness Score"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 font-mono text-4xl font-extrabold text-brass",
									children: [readiness.readinessScore, "%"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: cn("mt-1 text-xs font-semibold", readiness.readinessScore >= 85 ? "text-gain" : "text-amber-400"),
									children: readiness.statusMessage
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 h-2 w-full overflow-hidden rounded-full bg-line",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full rounded-full bg-brass transition-all duration-500",
										style: { width: `${readiness.readinessScore}%` }
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "text-xs font-semibold uppercase tracking-wider text-faint",
								children: "Statistical Edge & Discipline Checklist"
							}), readiness.checklist.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-panel-2 p-3 text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2.5",
									children: [item.met ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 shrink-0 text-gain" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-4 shrink-0 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-cream",
										children: item.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-[11px] text-faint",
										children: ["Target: ", item.requiredValue]
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("font-mono font-bold", item.met ? "text-gain" : "text-amber-400"),
									children: item.currentValue
								})]
							}, item.id))]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5 rounded-xl border border-brass/30 bg-brass/5 p-3.5 text-xs text-brass",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold",
								children: "Disciplined Capital Protection Protocol:"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-[11px] leading-relaxed text-cream/80",
								children: readiness.recommendation
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-5 flex justify-end",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "solid",
								onClick: () => setShowReadinessModal(false),
								children: "Close Audit Report"
							})
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveModeTransitionModal, {
				isOpen: showLiveModal,
				onClose: () => setShowLiveModal(false),
				onConfirm: () => {
					setMode("live");
					setShowLiveModal(false);
				}
			})
		]
	});
}
function StatCard({ label, value, sub, tone, accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: cn(accent && "border-brass/40 bg-panel"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[10px] tracking-wider text-faint uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("num mt-1 text-lg font-bold text-gain sm:text-xl", tone === "loss" && "text-loss", accent && "text-brass"),
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "num text-[11px] text-faint",
				children: sub
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Desk, {});
}
//#endregion
export { Home as component };
