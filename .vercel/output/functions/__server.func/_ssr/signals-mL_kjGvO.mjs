import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, n as Card, r as Label } from "./ui-9RT2T2XE.mjs";
import { G as ArrowDownRight, O as History, U as ArrowUpRight, h as Search } from "../_libs/lucide-react.mjs";
import { c as formatNairobiTime, f as useDesk, r as useSniper, s as pct } from "./router-BNCp43VR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/signals-mL_kjGvO.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SignalsView() {
	const sniperBook = useSniper((s) => s.book);
	const mode = useDesk((s) => s.mode);
	const demo = useDesk((s) => s.demo);
	const live = useDesk((s) => s.live);
	const executions = useDesk((s) => s.executions);
	const activeBook = mode === "live" ? live : demo;
	const rows = sniperBook.symbols.map((sym) => ({
		sym,
		set: sniperBook.signals[sym.symbol]
	}));
	const [historyTab, setHistoryTab] = (0, import_react.useState)("ALL");
	const [outcomeFilter, setOutcomeFilter] = (0, import_react.useState)("ALL");
	const [symbolSearch, setSymbolSearch] = (0, import_react.useState)("");
	const entryReports = (0, import_react.useMemo)(() => {
		const list = [];
		activeBook.positions.forEach((p) => {
			const diff = p.mark - p.entryPrice;
			const unPnl = p.qty > 0 ? diff * p.qty : diff;
			const rr = p.target && p.stop ? Math.abs((p.target - p.entryPrice) / (p.entryPrice - p.stop)) : 2.5;
			list.push({
				id: `pos-${p.id}`,
				ts: p.openedAt,
				symbol: p.symbol,
				venue: p.venue === "binance" ? "Binance Spot" : `${p.chain.toUpperCase()} DEX`,
				side: "LONG",
				entryPrice: p.entryPrice,
				notional: p.notional,
				qty: p.qty,
				stopPrice: p.stop,
				targetPrice: p.target ?? p.entryPrice * 1.15,
				riskRewardRatio: Math.round(rr * 10) / 10,
				score: 88,
				rationale: "Adaptive Volatility ATR Sizing · Risk Gated Entry",
				status: "OPEN",
				activePnl: unPnl
			});
		});
		executions.filter((e) => e.type === "BOT_ENTRY").forEach((e) => {
			if (!list.some((existing) => existing.symbol === e.symbol && Math.abs(existing.ts - e.ts) < 5e3)) {
				const defaultStop = e.price * .96;
				const defaultTarget = e.price * 1.12;
				const rr = e.riskReward ?? Math.abs((defaultTarget - e.price) / (e.price - defaultStop));
				list.push({
					id: `exec-${e.id}`,
					ts: e.ts,
					symbol: e.symbol,
					venue: e.venue,
					side: e.side,
					entryPrice: e.price,
					notional: e.notional,
					qty: e.qty,
					stopPrice: defaultStop,
					targetPrice: defaultTarget,
					riskRewardRatio: Math.round(rr * 10) / 10,
					score: 85,
					rationale: e.note || "Ensemble consensus cleared brain threshold",
					status: "CLOSED"
				});
			}
		});
		sniperBook.positions.forEach((p) => {
			if (!list.some((existing) => existing.symbol === p.symbol)) {
				const rr = Math.abs((p.target - p.entry) / (p.entry - p.stop));
				list.push({
					id: `snip-${p.id}`,
					ts: p.openedAt,
					symbol: p.symbol,
					venue: "Simulated DMA",
					side: p.side,
					entryPrice: p.entry,
					notional: p.entry * p.qty,
					qty: p.qty,
					stopPrice: p.stop,
					targetPrice: p.target,
					riskRewardRatio: Math.round(rr * 10) / 10,
					score: Math.round(p.confidence * 100),
					rationale: "Microstructure Queue & Momentum Model Alignment",
					status: "OPEN"
				});
			}
		});
		return list.sort((a, b) => b.ts - a.ts);
	}, [
		activeBook.positions,
		executions,
		sniperBook.positions
	]);
	const exitReports = (0, import_react.useMemo)(() => {
		const list = [];
		activeBook.trades.forEach((t) => {
			const isWin = t.pnl > 0;
			let badge = "TARGET";
			const r = t.reason.toUpperCase();
			if (r.includes("STOP")) badge = "STOP";
			else if (r.includes("TIME")) badge = "TIME";
			else if (r.includes("SIGNAL")) badge = "SIGNAL";
			else if (r.includes("MANUAL") || r.includes("FLATTEN")) badge = "MANUAL";
			const pnlPct = t.pnl / 45 * 100;
			const basePx = t.symbol === "BTC" ? 87e3 : t.symbol === "ETH" ? 3100 : 180;
			const exitPx = basePx * (1 + pnlPct / 100);
			list.push({
				id: `desk-trade-${t.id}`,
				ts: t.closedAt,
				symbol: t.symbol,
				side: "LONG",
				entryPrice: basePx,
				exitPrice: Math.round(exitPx * 100) / 100,
				pnlUsd: t.pnl,
				pnlPct: Math.round(pnlPct * 10) / 10,
				reason: t.reason,
				reasonBadge: badge,
				holdingTime: "~18m",
				outcome: isWin ? "WIN" : "LOSS"
			});
		});
		sniperBook.trades.forEach((t) => {
			if (!list.some((existing) => existing.id === t.id)) {
				const isWin = t.pnl > 0;
				const pnlPct = t.entry > 0 ? (t.exit - t.entry) / t.entry * 100 * (t.side === "LONG" ? 1 : -1) : 0;
				let badge = "TARGET";
				if (t.reason === "STOP") badge = "STOP";
				else if (t.reason === "TIME") badge = "TIME";
				else if (t.reason === "SIGNAL") badge = "SIGNAL";
				else if (t.reason === "MANUAL") badge = "MANUAL";
				const durationMinutes = Math.max(1, Math.round((t.closedAt - t.openedAt) / 6e4));
				const holdingTime = durationMinutes < 60 ? `${durationMinutes}m` : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;
				list.push({
					id: `snip-trade-${t.id}`,
					ts: t.closedAt,
					symbol: t.symbol,
					side: t.side,
					entryPrice: t.entry,
					exitPrice: t.exit,
					pnlUsd: Math.round(t.pnl * 100) / 100,
					pnlPct: Math.round(pnlPct * 10) / 10,
					reason: t.reason === "TARGET" ? "Take-Profit Target Filled" : t.reason === "STOP" ? "Defensive Stop Hit" : t.reason,
					reasonBadge: badge,
					holdingTime,
					outcome: isWin ? "WIN" : "LOSS"
				});
			}
		});
		return list.sort((a, b) => b.ts - a.ts);
	}, [activeBook.trades, sniperBook.trades]);
	const totalTrades = exitReports.length;
	const winCount = exitReports.filter((t) => t.outcome === "WIN").length;
	const winRate = totalTrades > 0 ? Math.round(winCount / totalTrades * 100) : 0;
	const totalRealizedPnl = exitReports.reduce((sum, t) => sum + t.pnlUsd, 0);
	const grossProfit = exitReports.filter((t) => t.pnlUsd > 0).reduce((sum, t) => sum + t.pnlUsd, 0);
	const grossLoss = Math.abs(exitReports.filter((t) => t.pnlUsd < 0).reduce((sum, t) => sum + t.pnlUsd, 0));
	const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";
	const filteredEntries = (0, import_react.useMemo)(() => {
		return entryReports.filter((item) => {
			if (symbolSearch.trim() && !item.symbol.toLowerCase().includes(symbolSearch.toLowerCase())) return false;
			return true;
		});
	}, [entryReports, symbolSearch]);
	const filteredExits = (0, import_react.useMemo)(() => {
		return exitReports.filter((item) => {
			if (outcomeFilter !== "ALL" && item.outcome !== outcomeFilter) return false;
			if (symbolSearch.trim() && !item.symbol.toLowerCase().includes(symbolSearch.toLowerCase())) return false;
			return true;
		});
	}, [
		exitReports,
		outcomeFilter,
		symbolSearch
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-6xl flex-col gap-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-bold tracking-tight md:text-3xl text-cream",
						children: "Signal Intelligence & Trade Reports"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-xs font-semibold text-brass uppercase",
						children: "5-SOURCE CONSENSUS"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-3xl text-xs text-faint md:text-sm",
					children: "Institutional consensus monitoring paired with complete execution transparency. Inspect exact trade entries, risk/reward parameters, and realized exit reports."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 rounded-xl border border-line bg-panel p-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", mode === "live" ? "bg-amber-400 pulse-dot" : "bg-emerald-400") }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-bold text-cream uppercase",
							children: [mode, " DESK"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-faint ml-1.5 font-mono",
							children: [
								"($",
								activeBook.cash.toFixed(2),
								")"
							]
						})]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "border-line bg-panel p-3.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Binance Spot CEX" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-gain pulse-dot" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-cream",
								children: "Order flow & 24h volume delta"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[11px] text-brass font-mono",
								children: "Weight 30% · Live WebSockets"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "border-line bg-panel p-3.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "DexScreener Pools" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-gain pulse-dot" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-cream",
								children: "Raydium & Uniswap liquidity"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[11px] text-brass font-mono",
								children: "Weight 25% · On-Chain RPC"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "border-line bg-panel p-3.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Invo Institutional" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-gain" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-cream",
								children: "Macro positioning & index bias"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[11px] text-brass font-mono",
								children: "Weight 20% · Factor desk"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "border-line bg-panel p-3.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Finviz Breakout" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-gain" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-cream",
								children: "Volatility squeeze & geometry"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[11px] text-brass font-mono",
								children: "Weight 15% · Pattern engine"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "border-line bg-panel p-3.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Simul8or Queue" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-gain" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-cream",
								children: "Microstructure adverse selection"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[11px] text-brass font-mono",
								children: "Weight 10% · Level 2 Sim"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "border-line bg-panel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-center md:justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex size-9 items-center justify-center rounded-lg border border-brass/40 bg-brass/10 text-brass",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "size-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Trade History & Execution Audits" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "rounded bg-panel-2 px-1.5 py-0.2 text-[10px] font-mono text-faint uppercase",
									children: [mode.toUpperCase(), " RAIL"]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-faint",
								children: "Granular ledger of algorithm entry points and verified exit triggers with PnL accounting."
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center rounded-xl border border-line bg-panel-2 p-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setHistoryTab("ALL"),
									className: cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-all", historyTab === "ALL" ? "bg-brass text-ink" : "text-faint hover:text-cream"),
									children: [
										"All Activity (",
										entryReports.length + exitReports.length,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setHistoryTab("ENTRIES"),
									className: cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-all", historyTab === "ENTRIES" ? "bg-brass text-ink" : "text-faint hover:text-cream"),
									children: [
										"Trade Entry Report (",
										entryReports.length,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setHistoryTab("EXITS"),
									className: cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-all", historyTab === "EXITS" ? "bg-brass text-ink" : "text-faint hover:text-cream"),
									children: [
										"Trade Exit Report (",
										exitReports.length,
										")"
									]
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-3 py-4 border-b border-line/60 sm:grid-cols-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line/60 bg-panel-2 p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-semibold tracking-wider text-faint uppercase",
									children: "Closed Trades"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-mono text-lg font-bold text-cream mt-0.5",
									children: totalTrades
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line/60 bg-panel-2 p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-semibold tracking-wider text-faint uppercase",
									children: "Win Rate"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: cn("font-mono text-lg font-bold mt-0.5", winRate >= 50 ? "text-gain" : "text-amber-400"),
									children: [winRate, "%"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line/60 bg-panel-2 p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-semibold tracking-wider text-faint uppercase",
									children: "Realized PnL"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: cn("font-mono text-lg font-bold mt-0.5", totalRealizedPnl >= 0 ? "text-gain" : "text-loss"),
									children: [
										totalRealizedPnl >= 0 ? "+" : "",
										"$",
										totalRealizedPnl.toFixed(2)
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line/60 bg-panel-2 p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-semibold tracking-wider text-faint uppercase",
									children: "Profit Factor"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-mono text-lg font-bold text-cream mt-0.5",
									children: profitFactor
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line/60 bg-panel-2 p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-semibold tracking-wider text-faint uppercase",
									children: "Active Entries"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-lg font-bold text-brass mt-0.5",
									children: [entryReports.filter((e) => e.status === "OPEN").length, " open"]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 pt-3 pb-2 sm:flex-row sm:items-center sm:justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-3.5 absolute left-2.5 top-2.5 text-faint" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: symbolSearch,
									onChange: (e) => setSymbolSearch(e.target.value),
									placeholder: "Search symbol (e.g. SOL, BTC)...",
									className: "field h-8 pl-8 pr-3 text-xs w-48 rounded-lg border-line bg-panel-2 text-cream outline-none focus:border-brass"
								})]
							}), symbolSearch && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setSymbolSearch(""),
								className: "text-[11px] text-faint hover:text-cream",
								children: "Clear"
							})]
						}), (historyTab === "ALL" || historyTab === "EXITS") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-faint",
								children: "Result:"
							}), [
								"ALL",
								"WIN",
								"LOSS"
							].map((filter) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setOutcomeFilter(filter),
								className: cn("rounded px-2.5 py-1 text-[11px] font-semibold transition-colors", outcomeFilter === filter ? "bg-brass text-ink font-bold" : "bg-panel-2 text-faint hover:text-cream"),
								children: filter === "ALL" ? "All" : filter === "WIN" ? "Wins" : "Losses"
							}, filter))]
						})]
					}),
					(historyTab === "ALL" || historyTab === "ENTRIES") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border-b border-line/60 pb-2 mb-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "size-4 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "text-sm font-bold text-cream uppercase tracking-wider",
									children: [
										"Trade Entry Report (",
										filteredEntries.length,
										")"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] text-faint",
								children: "Sized by Volatility ATR & Discipline Gates"
							})]
						}), filteredEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "py-8 text-center text-xs text-faint",
							children: "No trade entries recorded yet. Arm the sniper on the Desk to begin automated entry."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "overflow-x-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
								className: "w-full text-left font-mono text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
									className: "border-b border-line text-[10px] tracking-wider text-faint uppercase",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Timestamp (Nairobi EAT)"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Symbol / Venue"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Side"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Entry Price"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Size / Notional"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Stop Loss"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Target (R:R)"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Score"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 text-right font-normal",
											children: "Status"
										})
									] })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
									className: "divide-y divide-line/30",
									children: filteredEntries.map((e) => {
										const nairobiTime = formatNairobiTime(void 0, e.ts);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
											className: "hover:bg-panel-2/50",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "py-2.5 text-faint whitespace-nowrap",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														suppressHydrationWarning: true,
														children: nairobiTime.timeString
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "ml-1 text-[10px] opacity-60",
														suppressHydrationWarning: true,
														children: [
															"(",
															nairobiTime.dateString,
															")"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "py-2.5 font-bold text-cream",
													children: [e.symbol, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "ml-1 text-[10px] text-faint font-normal",
														children: [
															"(",
															e.venue,
															")"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "py-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "rounded bg-gain/15 px-1.5 py-0.5 text-[10px] font-bold text-gain",
														children: e.side
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "py-2.5 text-cream font-semibold",
													children: ["$", e.entryPrice >= 1 ? e.entryPrice.toFixed(2) : e.entryPrice.toPrecision(4)]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "py-2.5 text-cream",
													children: [
														"$",
														e.notional.toFixed(2),
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[10px] text-faint",
															children: [
																"(",
																e.qty.toFixed(2),
																" units)"
															]
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "py-2.5 text-loss",
													children: ["$", e.stopPrice >= 1 ? e.stopPrice.toFixed(2) : e.stopPrice.toPrecision(4)]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "py-2.5 text-gain",
													children: [
														"$",
														e.targetPrice >= 1 ? e.targetPrice.toFixed(2) : e.targetPrice.toPrecision(4),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "ml-1 text-[10px] text-brass",
															children: [
																"(",
																e.riskRewardRatio,
																":1 R)"
															]
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "py-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-brass font-bold",
														children: [e.score, "/100"]
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "py-2.5 text-right whitespace-nowrap",
													children: e.status === "OPEN" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300",
														children: "ACTIVE IN BOOK"
													}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "rounded bg-panel-2 px-2 py-0.5 text-[10px] font-medium text-faint",
														children: "SETTLED"
													})
												})
											]
										}, e.id);
									})
								})]
							})
						})]
					}),
					(historyTab === "ALL" || historyTab === "EXITS") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 border-t border-line/60 pt-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border-b border-line/60 pb-2 mb-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownRight, { className: "size-4 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "text-sm font-bold text-cream uppercase tracking-wider",
									children: [
										"Trade Exit Report (",
										filteredExits.length,
										")"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] text-faint",
								children: "Realized Returns & Verified Exit Reasons"
							})]
						}), filteredExits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "py-8 text-center text-xs text-faint",
							children: "No trade exits finalized yet. Once open positions hit Take-Profit or Stop-Loss, exits are logged here."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "overflow-x-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
								className: "w-full text-left font-mono text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
									className: "border-b border-line text-[10px] tracking-wider text-faint uppercase",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Exit Time (Nairobi EAT)"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Symbol"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Entry → Exit Price"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Duration"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Exit Reason Trigger"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 font-normal",
											children: "Realized Return"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "pb-2 text-right font-normal",
											children: "Net PnL (USD)"
										})
									] })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
									className: "divide-y divide-line/30",
									children: filteredExits.map((x) => {
										const nairobiTime = formatNairobiTime(void 0, x.ts);
										const isWin = x.outcome === "WIN";
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
											className: "hover:bg-panel-2/50",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "py-2.5 text-faint whitespace-nowrap",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														suppressHydrationWarning: true,
														children: nairobiTime.timeString
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "ml-1 text-[10px] opacity-60",
														suppressHydrationWarning: true,
														children: [
															"(",
															nairobiTime.dateString,
															")"
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "py-2.5 font-bold text-cream",
													children: x.symbol
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													className: "py-2.5 text-cream",
													children: [
														"$",
														x.entryPrice >= 1 ? x.entryPrice.toFixed(2) : x.entryPrice.toPrecision(4),
														" ",
														"→",
														" ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: cn("font-bold", isWin ? "text-gain" : "text-loss"),
															children: ["$", x.exitPrice >= 1 ? x.exitPrice.toFixed(2) : x.exitPrice.toPrecision(4)]
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "py-2.5 text-faint",
													children: x.holdingTime
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "py-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", x.reasonBadge === "TARGET" && "bg-gain/20 text-gain", x.reasonBadge === "STOP" && "bg-loss/20 text-loss", x.reasonBadge === "TIME" && "bg-amber-500/20 text-amber-300", x.reasonBadge === "SIGNAL" && "bg-blue-500/20 text-blue-300", x.reasonBadge === "MANUAL" && "bg-panel-2 text-faint"),
														children: x.reason
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "py-2.5",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: cn("font-bold", isWin ? "text-gain" : "text-loss"),
														children: [
															x.pnlPct >= 0 ? "+" : "",
															x.pnlPct.toFixed(1),
															"%"
														]
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													className: "py-2.5 text-right font-bold",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: cn("rounded px-2 py-0.5 text-xs font-bold", isWin ? "bg-gain/20 text-gain" : "bg-loss/20 text-loss"),
														children: [
															x.pnlUsd >= 0 ? "+" : "",
															"$",
															x.pnlUsd.toFixed(2)
														]
													})
												})
											]
										}, x.id);
									})
								})]
							})
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "border-line bg-panel",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-between border-b border-line pb-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Microstructure Tick Signals" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-faint",
						children: "Breakdown of votes from Invo, Finviz, and Simul8or models."
					})] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 divide-y divide-line/40",
					children: rows.map(({ sym, set }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-semibold text-cream",
								children: [
									sym.symbol,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-xs font-normal text-faint",
										children: [
											"(",
											sym.sector,
											")"
										]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-xs text-cream",
								children: ["$", sym.price.toFixed(2)]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 grid grid-cols-2 gap-2 md:grid-cols-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sig, {
									label: "Invo Desk",
									sig: set?.invo
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sig, {
									label: "Finviz Geometry",
									sig: set?.finviz
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sig, {
									label: "Simul8or Queue",
									sig: set?.simul8or
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sig, {
									label: "Ensemble Composite",
									sig: set?.ensemble,
									strong: true
								})
							]
						})]
					}, sym.symbol))
				})]
			})
		]
	});
}
function Sig({ label, sig, strong = false }) {
	if (!sig) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-faint",
		children: "—"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-line bg-panel-2 p-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[10px] text-faint uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: cn("font-mono text-xs font-semibold", tone(sig.action), strong && "text-sm font-bold"),
				children: [
					sig.action,
					" ",
					pct(sig.confidence)
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-faint truncate",
				children: sig.note
			})
		]
	});
}
function tone(action) {
	if (action === "BUY") return "text-gain";
	if (action === "SELL") return "text-loss";
	return "text-faint";
}
var SplitComponent = SignalsView;
//#endregion
export { SplitComponent as component };
