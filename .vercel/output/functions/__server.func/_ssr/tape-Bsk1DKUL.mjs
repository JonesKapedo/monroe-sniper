import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, n as Card, r as Label } from "./ui-9RT2T2XE.mjs";
import { c as equity } from "./paper-DKIhRqAY.mjs";
import { G as Activity, R as CircleAlert, x as Radio, z as ChartCandlestick } from "../_libs/lucide-react.mjs";
import { g as useDesk, r as loadKlines } from "./router-DMlX_g4f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tape-Bsk1DKUL.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PAIRS = [
	"BTCUSDT",
	"ETHUSDT",
	"SOLUSDT",
	"BNBUSDT",
	"XRPUSDT",
	"DOGEUSDT"
];
var TIMEFRAMES = [
	"1m",
	"5m",
	"15m",
	"1h"
];
var WIDTH = 760;
var HEIGHT = 320;
var LEFT = 18;
var RIGHT = 682;
var TOP = 18;
function formatPrice(value) {
	if (value >= 1e3) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
	if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
	return value.toPrecision(5);
}
function formatUsd(value) {
	return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
}
function matchesPair(position, symbol) {
	const base = symbol.replace(/USDT$/, "");
	return position.symbol.toUpperCase().split(/[/:]/)[0] === base;
}
function levelsFor(position) {
	return [
		{
			label: `ENTRY ${position.symbol}`,
			value: position.entryPrice,
			color: "#d7b56a",
			dash: "0"
		},
		{
			label: "TAKE PROFIT",
			value: position.target,
			color: "#a5d194",
			dash: "5 4"
		},
		{
			label: "STOP",
			value: position.stop,
			color: "#e3a394",
			dash: "3 4"
		}
	].filter((level) => typeof level.value === "number" && Number.isFinite(level.value));
}
function PositionCard({ position, onClose }) {
	const unrealized = (position.mark - position.entryPrice) * position.qty;
	const toTarget = ((position.target ?? position.entryPrice * 1.06) - position.mark) * position.qty;
	const toStop = (position.stop - position.mark) * position.qty;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-xl border border-line bg-panel-2 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-semibold",
					children: position.symbol
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-faint",
					children: [
						"Entry ",
						formatPrice(position.entryPrice),
						" · Last mark ",
						formatPrice(position.mark),
						" · Quantity ",
						position.qty.toPrecision(5)
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: cn("font-mono text-sm font-semibold", unrealized >= 0 ? "text-gain" : "text-loss"),
					children: [formatUsd(unrealized), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1 text-[10px] font-normal text-faint",
						children: "unrealized"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-faint",
					children: [
						"At target",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("ml-1 font-mono font-semibold", toTarget >= 0 ? "text-gain" : "text-loss"),
							children: formatUsd(toTarget)
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-faint",
					children: [
						"At stop",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("ml-1 font-mono font-semibold", toStop >= 0 ? "text-gain" : "text-loss"),
							children: formatUsd(toStop)
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[11px] text-faint",
				children: "Paper scenarios from the last quote; not forecasts. Standby leaves this position open."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => onClose(position.id),
				className: "mt-3 min-h-10 rounded-lg border border-loss/40 px-3 text-xs font-semibold text-loss hover:bg-loss/10",
				children: [
					"Close ",
					position.symbol,
					" at last paper mark"
				]
			})
		]
	});
}
function TapeView() {
	const demo = useDesk((state) => state.demo);
	const executions = useDesk((state) => state.executions);
	const log = useDesk((state) => state.log);
	const power = useDesk((state) => state.power);
	const flatten = useDesk((state) => state.flatten);
	const eq = equity(demo);
	const trades = demo.trades;
	const positions = demo.positions;
	const net = trades.reduce((sum, trade) => sum + trade.pnl, 0);
	const [selectedPair, setSelectedPair] = (0, import_react.useState)(PAIRS[0]);
	const [timeframe, setTimeframe] = (0, import_react.useState)("5m");
	const [candles, setCandles] = (0, import_react.useState)([]);
	const [feedNote, setFeedNote] = (0, import_react.useState)("Loading public market candles…");
	const [lastUpdated, setLastUpdated] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let current = true;
		const refresh = async () => {
			try {
				const result = await loadKlines({ data: {
					symbol: selectedPair,
					interval: timeframe
				} });
				if (!current) return;
				setCandles(result.candles);
				setFeedNote(result.note);
				setLastUpdated(result.candles.length ? Date.now() : null);
			} catch (error) {
				if (!current) return;
				setCandles([]);
				setLastUpdated(null);
				setFeedNote(error instanceof Error ? error.message : "Public market data unavailable.");
			}
		};
		refresh();
		const timer = window.setInterval(() => void refresh(), 15e3);
		return () => {
			current = false;
			window.clearInterval(timer);
		};
	}, [selectedPair, timeframe]);
	const currentCandle = candles.at(-1);
	const previousCandle = candles.at(-2);
	const priceChange = currentCandle && previousCandle?.close ? (currentCandle.close - previousCandle.close) / previousCandle.close * 100 : 0;
	const relevantPositions = positions.filter((position) => position.venue === "binance" && matchesPair(position, selectedPair));
	const closedExecutions = executions.filter((execution) => execution.type !== "MARKET_FLOW");
	const wins = trades.filter((trade) => trade.pnl > 0).length;
	const chart = (0, import_react.useMemo)(() => {
		if (candles.length === 0) return null;
		const rawMin = Math.min(...candles.map((candle) => candle.low));
		const rawMax = Math.max(...candles.map((candle) => candle.high));
		const padding = (rawMax - rawMin) * .08 || rawMax * .005;
		const min = Math.max(0, rawMin - padding);
		const max = rawMax + padding;
		const range = max - min || 1;
		const x = (index) => LEFT + index / Math.max(1, candles.length - 1) * 664;
		const y = (price) => TOP + (max - price) / range * 264;
		return {
			min,
			max,
			x,
			y,
			barWidth: Math.max(3, Math.min(12, 664 / candles.length * .56))
		};
	}, [candles]);
	const unrealized = positions.reduce((sum, position) => sum + (position.mark - position.entryPrice) * position.qty, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-bold tracking-tight md:text-3xl",
						children: "Market & Paper Activity"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-xs font-semibold uppercase text-brass",
						children: "Paper simulation"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-2xl text-xs leading-relaxed text-faint md:text-sm",
					children: "Public market candles and simulated paper fills. No brokerage connection or real-money orders are available."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 self-start rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs sm:self-auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("size-2 rounded-full", power ? "bg-gain" : "bg-faint"),
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: power ? "Paper bot armed" : "Standby"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-faint",
							children: [
								"· ",
								positions.length,
								" held"
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Paper equity"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "num mt-1 text-xl font-bold text-cream",
							children: ["$", eq.toFixed(2)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: "Simulation balance"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Unrealized P&L"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: cn("num mt-1 text-xl font-bold", unrealized >= 0 ? "text-gain" : "text-loss"),
							children: formatUsd(unrealized)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11px] text-faint",
							children: [positions.length, " open paper positions"]
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Realized P&L"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: cn("num mt-1 text-xl font-bold", net >= 0 ? "text-gain" : "text-loss"),
							children: formatUsd(net)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11px] text-faint",
							children: [
								wins,
								" wins / ",
								trades.length,
								" closes"
							]
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Paper fills"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "num mt-1 text-xl font-bold text-cream",
							children: closedExecutions.length
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: "This browser session"
						})
					] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex min-w-0 flex-col gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCandlestick, {
								className: "size-4 text-brass",
								"aria-hidden": "true"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Market price chart" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-faint",
							children: [
								selectedPair,
								" · Binance public candlestick feed",
								positions.some((position) => position.venue === "dex" && matchesPair(position, selectedPair)) ? " · DEX positions are not plotted against this market" : ""
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "min-w-0 text-right",
							children: currentCandle ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-lg font-semibold text-cream",
								children: ["$", formatPrice(currentCandle.close)]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: cn("font-mono text-xs", priceChange >= 0 ? "text-gain" : "text-loss"),
								children: [
									priceChange >= 0 ? "+" : "",
									priceChange.toFixed(2),
									"% last candle"
								]
							})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-faint",
								children: "Quote unavailable"
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-1.5",
							"aria-label": "Market pair",
							children: PAIRS.map((pair) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": selectedPair === pair,
								onClick: () => setSelectedPair(pair),
								className: cn("min-h-9 rounded-lg px-2.5 text-xs font-semibold", selectedPair === pair ? "bg-brass text-ink" : "border border-line bg-panel-2 text-faint hover:text-cream"),
								children: pair.replace("USDT", "/USDT")
							}, pair))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex rounded-lg border border-line bg-panel-2 p-0.5 text-xs",
							"aria-label": "Chart timeframe",
							children: TIMEFRAMES.map((period) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": timeframe === period,
								onClick: () => setTimeframe(period),
								className: cn("min-h-8 rounded px-2 font-medium uppercase", timeframe === period ? "bg-panel text-cream" : "text-faint hover:text-cream"),
								children: period
							}, period))
						})]
					}),
					chart ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative min-w-0 overflow-hidden rounded-lg border border-line bg-ink p-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
							role: "img",
							"aria-label": `${selectedPair} ${timeframe} real market candlestick chart with paper position levels`,
							className: "block h-64 w-full sm:h-80",
							viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
							preserveAspectRatio: "none",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("clipPath", {
									id: "market-chart-clip",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
										x: LEFT,
										y: TOP,
										width: 664,
										height: 264
									})
								}) }),
								[
									0,
									1,
									2,
									3,
									4
								].map((index) => {
									const ratio = index / 4;
									const y = TOP + ratio * 264;
									const price = chart.max - ratio * (chart.max - chart.min);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
										x1: LEFT,
										y1: y,
										x2: RIGHT,
										y2: y,
										stroke: "var(--theme-line)",
										strokeDasharray: "3 5"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
										x: 690,
										y: y + 4,
										fill: "var(--theme-faint)",
										fontSize: "10",
										fontFamily: "monospace",
										children: formatPrice(price)
									})] }, index);
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
									clipPath: "url(#market-chart-clip)",
									children: [
										candles.map((candle, index) => {
											const x = chart.x(index);
											const color = candle.close >= candle.open ? "var(--theme-gain)" : "var(--theme-loss)";
											const bodyTop = chart.y(Math.max(candle.open, candle.close));
											const bodyBottom = chart.y(Math.min(candle.open, candle.close));
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
												x1: x,
												y1: chart.y(candle.high),
												x2: x,
												y2: chart.y(candle.low),
												stroke: color,
												strokeWidth: "1.2"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
												x: x - chart.barWidth / 2,
												y: bodyTop,
												width: chart.barWidth,
												height: Math.max(1.5, bodyBottom - bodyTop),
												fill: color,
												rx: "0.5"
											})] }, `${candle.time}-${index}`);
										}),
										relevantPositions.flatMap((position) => levelsFor(position).map((level) => {
											if (level.value < chart.min || level.value > chart.max) return null;
											const y = chart.y(level.value);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
												x1: LEFT,
												y1: y,
												x2: RIGHT,
												y2: y,
												stroke: level.color,
												strokeDasharray: level.dash,
												strokeWidth: "1.25",
												opacity: "0.9"
											}) }, `${position.id}-${level.label}`);
										})),
										currentCandle ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
											x1: LEFT,
											y1: chart.y(currentCandle.close),
											x2: RIGHT,
											y2: chart.y(currentCandle.close),
											stroke: "var(--theme-brass)",
											strokeDasharray: "2 4",
											strokeWidth: "1"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
											cx: chart.x(candles.length - 1),
											cy: chart.y(currentCandle.close),
											r: "3",
											fill: "var(--theme-brass)"
										})] }) : null
									]
								}),
								[
									candles[0],
									candles[Math.floor(candles.length / 2)],
									candles.at(-1)
								].map((candle, index) => candle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
									x: [
										LEFT,
										350,
										RIGHT
									][index],
									y: 315,
									textAnchor: [
										"start",
										"middle",
										"end"
									][index],
									fill: "var(--theme-faint)",
									fontSize: "10",
									fontFamily: "monospace",
									children: new Date(candle.time).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit"
									})
								}, `${candle.time}-${index}`) : null)
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2 text-[10px] text-faint",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "inline-flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "size-2 rounded-full bg-brass" }), "Last price"]
								}),
								relevantPositions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "inline-flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "size-2 rounded-full bg-brass" }), "Entry"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "inline-flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "size-2 rounded-full bg-gain" }), "Target"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "inline-flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "size-2 rounded-full bg-loss" }), "Stop"]
									})
								] }) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "ml-auto",
									children: [feedNote, lastUpdated ? ` · Updated ${new Date(lastUpdated).toLocaleTimeString()}` : ""]
								})
							]
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-ink px-5 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, {
								className: "size-5 text-warn",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium text-cream",
								children: "Market candles are unavailable"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "max-w-md text-xs leading-relaxed text-faint",
								children: [feedNote, ". No synthetic prices are shown as a substitute."]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-5 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex min-w-0 flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border-b border-line pb-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
									className: "size-4 text-brass",
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Open paper positions" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("text-xs", power ? "text-gain" : "text-faint"),
								children: power ? "Bot armed" : "Held on standby"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs leading-relaxed text-faint",
							children: power ? "Paper brackets are active while armed." : "Standby pauses automated entries and exits. Positions stay open; close them individually when ready."
						}),
						positions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-3",
							children: positions.map((position) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PositionCard, {
								position,
								onClose: flatten
							}, position.id))
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-faint",
							children: "No open paper positions."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex min-w-0 flex-col gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-line pb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {
								className: "size-4 text-brass",
								"aria-hidden": "true"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Paper fill ledger" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-faint",
							children: [closedExecutions.length, " session fills"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto",
						children: closedExecutions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[440px] text-left text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "border-b border-line text-faint uppercase",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 font-normal",
										children: "Time"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "pb-2 font-normal",
										children: "Pair"
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
										children: "Notional"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
								className: "divide-y divide-line/60",
								children: closedExecutions.slice(0, 20).map((execution) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 font-mono text-faint",
										children: new Date(execution.ts).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
											second: "2-digit"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 font-semibold text-cream",
										children: execution.symbol
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: cn("py-2 font-semibold", execution.side === "BUY" ? "text-gain" : "text-loss"),
										children: execution.side
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 text-right font-mono",
										children: formatPrice(execution.price)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: "py-2 text-right font-mono",
										children: ["$", execution.notional.toFixed(2)]
									})
								] }, execution.id))
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "py-8 text-center text-sm text-faint",
							children: "No paper fills have been recorded this session."
						})
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex flex-col gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 border-b border-line pb-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
							className: "size-4 text-brass",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Bot activity" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-auto text-xs text-faint",
							children: power ? "Running in paper mode" : "Paused"
						})
					]
				}), log.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-2 font-mono text-xs",
					children: log.slice(0, 8).map((line, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-2 text-faint",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-brass",
							"aria-hidden": "true",
							children: "›"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-cream/80",
							children: line
						})]
					}, `${line}-${index}`))
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-faint",
					children: "No bot activity yet."
				})]
			})
		]
	});
}
var SplitComponent = TapeView;
//#endregion
export { SplitComponent as component };
