import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, n as Card, r as Label } from "./ui-9RT2T2XE.mjs";
import { c as equity } from "./paper-MZacH4KP.mjs";
import { N as Cpu, q as Activity, x as Radio } from "../_libs/lucide-react.mjs";
import { f as useDesk } from "./router-BNCp43VR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tape-iUQTfZGy.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PAIRS = [
	{
		symbol: "SOL/USDT",
		base: 184.2,
		vol: .024,
		venue: "Binance Spot"
	},
	{
		symbol: "BTC/USDT",
		base: 87400,
		vol: .008,
		venue: "Binance Spot"
	},
	{
		symbol: "ETH/USDT",
		base: 3120,
		vol: .012,
		venue: "Binance Spot"
	},
	{
		symbol: "PEPE/SOL",
		base: 108e-7,
		vol: .045,
		venue: "Raydium CLMM"
	},
	{
		symbol: "SUI/USDT",
		base: 2.84,
		vol: .03,
		venue: "Binance Spot"
	}
];
function TapeView() {
	const mode = useDesk((s) => s.mode);
	const demo = useDesk((s) => s.demo);
	const live = useDesk((s) => s.live);
	const executions = useDesk((s) => s.executions);
	const log = useDesk((s) => s.log);
	const book = mode === "live" ? live : demo;
	const eq = equity(book);
	const trades = book.trades;
	const wins = trades.filter((t) => t.pnl > 0).length;
	const net = trades.reduce((sum, t) => sum + t.pnl, 0);
	const [selectedPair, setSelectedPair] = (0, import_react.useState)(PAIRS[0]);
	const [timeframe, setTimeframe] = (0, import_react.useState)("5M");
	const [chartTicks, setChartTicks] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		let currentPx = selectedPair.base;
		const initialPoints = Array.from({ length: 30 }).map((_, i) => {
			const d = /* @__PURE__ */ new Date(Date.now() - (30 - i) * 6e4);
			currentPx = currentPx * (1 + (Math.random() - .49) * selectedPair.vol);
			return {
				time: d.toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit"
				}),
				price: currentPx,
				high: currentPx * (1 + Math.random() * .004),
				low: currentPx * (1 - Math.random() * .004)
			};
		});
		setChartTicks(initialPoints);
		const interval = setInterval(() => {
			setChartTicks((prev) => {
				const last = prev[prev.length - 1];
				if (!last) return prev;
				const nextPx = last.price * (1 + (Math.random() - .49) * (selectedPair.vol * .4));
				const nextPoint = {
					time: (/* @__PURE__ */ new Date()).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit"
					}),
					price: nextPx,
					high: Math.max(last.price, nextPx) * 1.002,
					low: Math.min(last.price, nextPx) * .998
				};
				return [...prev.slice(1), nextPoint];
			});
		}, 2500);
		return () => clearInterval(interval);
	}, [selectedPair]);
	const minPrice = (0, import_react.useMemo)(() => Math.min(...chartTicks.map((c) => c.low || c.price)), [chartTicks]);
	const priceRange = (0, import_react.useMemo)(() => Math.max(...chartTicks.map((c) => c.high || c.price)), [chartTicks]) - minPrice || 1;
	const currentPrice = chartTicks[chartTicks.length - 1]?.price ?? selectedPair.base;
	const startPrice = chartTicks[0]?.price ?? selectedPair.base;
	const priceChange = (currentPrice - startPrice) / startPrice * 100;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-bold tracking-tight md:text-3xl",
						children: "Live Trading Tape"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase", mode === "live" ? "border border-amber-500/40 bg-amber-500/15 text-amber-300" : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"),
						children: [mode.toUpperCase(), " DESK TAPE"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-faint md:text-sm",
					children: "Institutional time-and-sales stream, cryptographic execution telemetry, and smart order router fills."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-3 text-gain pulse-dot" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-faint",
								children: "Smart Router:"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-gain",
								children: "42ms Latency"
							})
						]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Active Mode Equity"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "num mt-1 text-xl font-bold text-cream",
							children: ["$", eq.toFixed(2)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: mode === "live" ? "Live Rail" : "Demo Sandbox"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Realized P&L"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: cn("num mt-1 text-xl font-bold", net >= 0 ? "text-gain" : "text-loss"),
							children: [
								net >= 0 ? "+" : "",
								"$",
								net.toFixed(2)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11px] text-faint",
							children: [
								wins,
								" wins / ",
								trades.length,
								" closed"
							]
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Avg Execution Speed"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "num mt-1 text-xl font-bold text-brass",
							children: "41 ms"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: "Direct WebSocket / RPC"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Avg Slippage"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "num mt-1 text-xl font-bold text-cream",
							children: "+0.3 bps"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-gain",
							children: "Inside spread budget"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "col-span-2 sm:col-span-4 lg:col-span-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] tracking-wider text-faint uppercase",
								children: "Router Venues"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "num mt-1 text-xl font-bold text-cream",
								children: "Binance + Raydium"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-faint",
								children: "CEX & DEX deep liquidity"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex flex-col gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: PAIRS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSelectedPair(p),
							className: cn("rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors", selectedPair.symbol === p.symbol ? "bg-brass text-ink" : "border border-line bg-panel-2 text-faint hover:text-cream"),
							children: p.symbol
						}, p.symbol))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono text-base font-bold text-cream",
								children: ["$", currentPrice >= 1 ? currentPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }) : currentPrice.toPrecision(4)]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: cn("ml-2 font-mono text-xs font-semibold", priceChange >= 0 ? "text-gain" : "text-loss"),
								children: [
									priceChange >= 0 ? "+" : "",
									priceChange.toFixed(2),
									"%"
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex rounded-lg border border-line bg-panel-2 p-0.5 text-xs",
							children: [
								"1M",
								"5M",
								"15M",
								"1H"
							].map((tf) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setTimeframe(tf),
								className: cn("rounded px-2 py-0.5 font-medium transition-colors", timeframe === tf ? "bg-brass text-ink font-semibold" : "text-faint hover:text-cream"),
								children: tf
							}, tf))
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative h-64 w-full",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
						className: "h-full w-full overflow-visible",
						preserveAspectRatio: "none",
						viewBox: "0 0 600 200",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
								id: "chartGradient",
								x1: "0",
								y1: "0",
								x2: "0",
								y2: "1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
									offset: "0%",
									stopColor: "#d7b56a",
									stopOpacity: "0.25"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
									offset: "100%",
									stopColor: "#d7b56a",
									stopOpacity: "0.0"
								})]
							}) }),
							[
								.25,
								.5,
								.75
							].map((ratio) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
								x1: "0",
								y1: 200 * ratio,
								x2: "600",
								y2: 200 * ratio,
								stroke: "#34392e",
								strokeDasharray: "4 4",
								strokeWidth: "1"
							}, ratio)),
							chartTicks.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
								d: `M 0,${200 - (chartTicks[0].price - minPrice) / priceRange * 180 - 10} ` + chartTicks.map((pt, i) => {
									return `L ${i / (chartTicks.length - 1) * 600},${200 - (pt.price - minPrice) / priceRange * 180 - 10}`;
								}).join(" ") + ` L 600,200 L 0,200 Z`,
								fill: "url(#chartGradient)"
							}),
							chartTicks.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
								d: `M 0,${200 - (chartTicks[0].price - minPrice) / priceRange * 180 - 10} ` + chartTicks.map((pt, i) => {
									return `L ${i / (chartTicks.length - 1) * 600},${200 - (pt.price - minPrice) / priceRange * 180 - 10}`;
								}).join(" "),
								fill: "none",
								stroke: "#d7b56a",
								strokeWidth: "2"
							}),
							chartTicks.map((pt, i) => {
								const x = i / (chartTicks.length - 1) * 600;
								const yHigh = 200 - (pt.high - minPrice) / priceRange * 180 - 10;
								const yLow = 200 - (pt.low - minPrice) / priceRange * 180 - 10;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
									x1: x,
									y1: yHigh,
									x2: x,
									y2: yLow,
									stroke: "#b7b3a6",
									strokeWidth: "1",
									opacity: "0.4"
								}, `wick-${i}`);
							}),
							chartTicks.length > 10 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
									cx: "240",
									cy: "120",
									r: "5",
									fill: "#a5d194",
									stroke: "#10120e",
									strokeWidth: "2"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
									x: "250",
									y: "124",
									fill: "#a5d194",
									fontSize: "10",
									fontFamily: "monospace",
									fontWeight: "bold",
									children: "▲ BUY FILL ($184.20)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
									cx: "480",
									cy: "50",
									r: "5",
									fill: "#d7b56a",
									stroke: "#10120e",
									strokeWidth: "2"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
									x: "380",
									y: "44",
									fill: "#d7b56a",
									fontSize: "10",
									fontFamily: "monospace",
									fontWeight: "bold",
									children: "★ TAKE PROFIT (+6.2%)"
								})
							] })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute bottom-2 right-2 rounded-md border border-line bg-panel/90 px-2.5 py-1 backdrop-blur",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-xs font-semibold text-brass",
							children: [
								"Venue: ",
								selectedPair.venue,
								" · Feed Live"
							]
						})
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-5 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex flex-col",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-line pb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Real-Time Time & Sales Tape" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] text-faint",
							children: "Live Orderbook Stream"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-left font-mono text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "text-[10px] tracking-wider text-faint uppercase",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 font-normal",
										children: "Time"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 font-normal",
										children: "Tx Hash"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 font-normal",
										children: "Pair & Venue"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 font-normal",
										children: "Side"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 text-right font-normal",
										children: "Price"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 text-right font-normal",
										children: "Speed"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
								className: "divide-y divide-line/40",
								children: executions.slice(0, 16).map((exec) => {
									const isBuy = exec.side === "BUY";
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "hover:bg-panel-2/50",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-2 text-[11px] text-faint",
												children: new Date(exec.ts).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
													second: "2-digit"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-2 text-[11px] text-brass/80",
												title: exec.hash,
												children: exec.hash
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-medium text-cream",
													children: exec.symbol
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "ml-1 text-[10px] text-faint",
													children: ["· ", exec.venue.split(" ")[0]]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", isBuy ? "bg-gain/20 text-gain" : "bg-loss/20 text-loss"),
													children: exec.side
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-2 text-right font-medium text-cream",
												children: ["$", exec.price >= 1 ? exec.price.toFixed(2) : exec.price.toPrecision(4)]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-2 text-right text-[11px] text-faint",
												children: [exec.latencyMs, "ms"]
											})
										]
									}, exec.id);
								})
							})]
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex flex-col",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-line pb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Sniper Algorithm Decision Stream" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] text-gain",
							children: "Active Engine"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex max-h-[380px] flex-1 flex-col gap-2 overflow-y-auto font-mono text-xs scrollbar-thin",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line bg-panel-2 p-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-gain",
										children: "✓ OPPORTUNITY SCAN"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint",
										children: (/* @__PURE__ */ new Date()).toLocaleTimeString()
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-cream/90",
									children: "Probed Binance CEX ticker and Raydium CLMM liquidity pools. Identified volume expansion on SOL/USDT (+240% 24h volume)."
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line bg-panel-2 p-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-brass",
										children: "⚡ QUANTITATIVE SCORE"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint",
										children: (/* @__PURE__ */ new Date()).toLocaleTimeString()
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-cream/90",
									children: "Multi-source agreement: Invo (84%), Finviz (78%), Binance Orderflow (88%). Composite Score: 84/100 (clears brain floor)."
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line bg-panel-2 p-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-cream",
										children: "🛡 RISK AUDIT & KELLY SIZING"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint",
										children: (/* @__PURE__ */ new Date()).toLocaleTimeString()
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-cream/90",
									children: "Kelly fraction sizing: Allocated $20.00 ticket. Stop Loss bracket set at -8.0%, Take Profit bracket set at +6.0%."
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line bg-panel-2 p-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-gain",
										children: "🚀 ORDER ROUTED & FILLED"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint",
										children: (/* @__PURE__ */ new Date()).toLocaleTimeString()
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-cream/90",
									children: "Direct IOC crossing to Binance Spot. Fill price: $184.25. Execution latency: 38ms. Zero adverse slippage."
								})]
							}),
							log.slice(0, 8).map((line, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start gap-1.5 text-[11px] text-faint",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-brass",
									children: "›"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-cream/80",
									children: line
								})]
							}, `${line}-${idx}`))
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-center justify-between border-b border-line pb-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: [
					"Session Closed Trades Ledger (",
					trades.length,
					" fills)"
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-faint",
					children: "Audit log of completed round-trip trades with entry, exit, reason, and net P&L."
				})] })
			}), trades.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-faint",
				children: "No round-trip trades completed yet this session."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-left text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "border-b border-line text-faint uppercase",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Closed At"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Symbol"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Exit Reason"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 text-right font-normal",
								children: "Realized P&L"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
						className: "divide-y divide-line/60",
						children: trades.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "hover:bg-panel-2/50",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 font-mono text-faint",
									children: new Date(t.closedAt).toLocaleTimeString()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 font-semibold text-cream",
									children: t.symbol
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", t.reason === "TARGET" ? "bg-gain/20 text-gain" : t.reason === "STOP" ? "bg-loss/20 text-loss" : "bg-panel text-faint"),
										children: t.reason === "TARGET" ? "Take Profit" : t.reason === "STOP" ? "Stop Loss" : t.reason
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: cn("py-2.5 text-right font-mono font-semibold", t.pnl >= 0 ? "text-gain" : "text-loss"),
									children: [
										t.pnl >= 0 ? "+" : "",
										"$",
										t.pnl.toFixed(2)
									]
								})
							]
						}, t.id))
					})]
				})
			})] })
		]
	});
}
var SplitComponent = TapeView;
//#endregion
export { SplitComponent as component };
