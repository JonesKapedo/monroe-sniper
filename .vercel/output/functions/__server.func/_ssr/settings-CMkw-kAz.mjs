import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, n as Card, r as Label, t as Button } from "./ui-9RT2T2XE.mjs";
import { a as kellyFraction, f as useDesk, i as SOURCE_META, o as money, r as useSniper, s as pct } from "./router-BNCp43VR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-CMkw-kAz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SettingsView() {
	const resetDemo = useDesk((s) => s.resetDemo);
	const riskSettings = useDesk((s) => s.riskSettings);
	const updateRiskSettings = useDesk((s) => s.updateRiskSettings);
	const disciplineRules = useDesk((s) => s.disciplineRules);
	const updateDisciplineRules = useDesk((s) => s.updateDisciplineRules);
	useDesk((s) => s.mode);
	const deskBook = useDesk((s) => s[s.mode]);
	const book = useSniper((s) => s.book);
	const update = useSniper((s) => s.updateSettings);
	const setSource = useSniper((s) => s.setSource);
	useSniper((s) => s.runTicks);
	const newSession = useSniper((s) => s.newSession);
	const restore = useSniper((s) => s.restoreOpeningBalance);
	const settings = book.settings;
	const [phrase, setPhrase] = (0, import_react.useState)("");
	const kelly = kellyFraction(book.trades, settings.kellyCap);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-3xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-bold md:text-3xl",
					children: "Professional Trader Settings"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full bg-brass/20 px-2.5 py-0.5 text-xs font-semibold text-brass",
					children: "EAT GMT(+3) Nairobi Desk"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-faint",
				children: "Fine-tune the quantitative sniper engine, dynamic position sizing corridors, capital preservation circuits, and academic research safeguards."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Quantitative Risk Engine & Position Sizing Profile" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-brass font-medium",
						children: "Outperformance Architecture"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-faint",
					children: "Selects the dynamic compounding corridor. Sizes positions wisely based on current balance—never starved in micro $1 pennies, nor reckless with capital."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => updateRiskSettings({
								sizingProfile: "CONSERVATIVE",
								riskPerTrade: .015,
								maxIdeaExposure: .18,
								rewardMultiple: 2.5
							}),
							className: cn("flex flex-col items-start rounded-xl border p-3 text-left transition-all", riskSettings.sizingProfile === "CONSERVATIVE" ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-line bg-panel-2 text-faint hover:text-cream"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-sm",
									children: "🛡️ Conservative"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs mt-1",
									children: "1.5% Risk · 18% Max Slot"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11px] text-faint mt-1",
									children: "Max capital preservation"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => updateRiskSettings({
								sizingProfile: "OPTIMUM_SWEET_SPOT",
								riskPerTrade: .025,
								maxIdeaExposure: .28,
								rewardMultiple: 3
							}),
							className: cn("flex flex-col items-start rounded-xl border p-3 text-left transition-all relative", riskSettings.sizingProfile === "OPTIMUM_SWEET_SPOT" ? "border-brass bg-brass/10 text-brass ring-1 ring-brass/40" : "border-line bg-panel-2 text-faint hover:text-cream"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute -top-2 right-2 rounded bg-brass px-1.5 py-0.2 text-[10px] font-bold text-ink uppercase",
									children: "Recommended"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-sm",
									children: "⭐ Optimum Sweet Spot"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs mt-1",
									children: "2.5% Risk · 28% Max Slot"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11px] text-faint mt-1",
									children: "Dynamic balance compounding"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => updateRiskSettings({
								sizingProfile: "AGGRESSIVE",
								riskPerTrade: .035,
								maxIdeaExposure: .35,
								rewardMultiple: 3.5
							}),
							className: cn("flex flex-col items-start rounded-xl border p-3 text-left transition-all", riskSettings.sizingProfile === "AGGRESSIVE" ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-line bg-panel-2 text-faint hover:text-cream"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-sm",
									children: "⚡ Aggressive Growth"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs mt-1",
									children: "3.5% Risk · 35% Max Slot"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11px] text-faint mt-1",
									children: "High-velocity compounding"
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 border-t border-line/60 pt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs font-semibold text-cream",
							children: "Opening capital"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "usd text-xs",
							children: ["$", deskBook.cash.toFixed(2)]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-faint",
						children: "The practice book opens at $500. Reset it from Safety if a session drifts. Do not treat other amounts as the starting bankroll."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
							label: "Equity Risk Per Trade",
							value: riskSettings.riskPerTrade,
							min: .01,
							max: .05,
							step: .005,
							format: (v) => pct(v, 1),
							onChange: (v) => updateRiskSettings({ riskPerTrade: v })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
							label: "Target Reward Multiple",
							value: riskSettings.rewardMultiple,
							min: 2,
							max: 4.5,
							step: .1,
							format: (v) => `${v.toFixed(1)}R Floor`,
							onChange: (v) => updateRiskSettings({ rewardMultiple: v })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
							label: "Max Concurrent Open Slots",
							value: riskSettings.maxPositions,
							min: 2,
							max: 6,
							step: 1,
							format: (v) => `${Math.round(v)} assets`,
							onChange: (v) => updateRiskSettings({ maxPositions: v })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
							label: "Max Single Position Exposure",
							value: riskSettings.maxIdeaExposure,
							min: .1,
							max: .4,
							step: .02,
							format: (v) => pct(v),
							onChange: (v) => updateRiskSettings({ maxIdeaExposure: v })
						})
					]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Academic Research & Anti-Mistake Safeguards" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-emerald-400 font-medium",
						children: "All 7 Shields Active"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-faint",
					children: "Architectural rules synthesized from Investopedia, Medium Outperformance, ResearchGate, Binance, and AML Watcher:"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-col divide-y divide-line/60",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "py-2.5 flex items-center justify-between gap-3 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold text-cream",
								children: "1 & 2. Anti-FOMO Green Candle Filter (Investopedia)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-faint",
								children: "Rejects buying extended tops with 24h >75% pump and volume/liquidity >2.0x"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300",
								children: "PROTECTED"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "py-2.5 flex items-center justify-between gap-3 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold text-cream",
								children: "3. Trailing Breakeven Stop Ratchet (Medium Outperformance)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-faint",
								children: "Once position gains +3.0%, stop loss automatically lifts to +0.8% to guarantee a risk-free trade"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300",
								children: "ARMED"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "py-2.5 flex items-center justify-between gap-3 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold text-cream",
								children: "5. Rug Pull & Mint Exploit Gate (AML Watcher)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-faint",
								children: "Enforces minimum $12,000 liquidity depth, verified lock, and verifies mint authority revoked"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300",
								children: "ACTIVE"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "py-2.5 flex items-center justify-between gap-3 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold text-cream",
								children: "6 & 7. Insider Anticipated Purchases (IAP) Shield (ResearchGate & Binance)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-faint",
								children: "Flags abnormal pre-announcement volume rushes & order book skew typical of pump-and-dump rings"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300",
								children: "ENFORCED"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "py-2.5 flex items-center justify-between gap-3 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold text-cream",
								children: "4. Fee & Slippage Erosion Guard (Investopedia Mistake #6)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-faint",
								children: "Guarantees potential profit exceeds round-trip gas and exchange fees by at least 4x"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300",
								children: "ACTIVE"
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 pt-3 border-t border-line/60",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
						label: "Intraday Drawdown Circuit Breaker",
						value: disciplineRules.maxDailyDrawdownPct,
						min: .01,
						max: .08,
						step: .005,
						format: (v) => pct(v, 1),
						onChange: (v) => updateDisciplineRules({ maxDailyDrawdownPct: v })
					})
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Risk" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Risk per trade",
					value: settings.riskPerTrade,
					min: .005,
					max: .05,
					step: .005,
					format: (v) => pct(v, 1),
					onChange: (v) => update({ riskPerTrade: v })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Stop distance",
					value: settings.stopPct,
					min: .005,
					max: .05,
					step: .001,
					format: (v) => pct(v, 1),
					onChange: (v) => update({ stopPct: v })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Reward multiple",
					value: settings.rewardMultiple,
					min: 1,
					max: 4,
					step: .1,
					format: (v) => `${v.toFixed(1)}R`,
					onChange: (v) => update({ rewardMultiple: v })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Max positions",
					value: settings.maxPositions,
					min: 1,
					max: 8,
					step: 1,
					format: (v) => `${Math.round(v)}`,
					onChange: (v) => update({ maxPositions: v })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex items-center justify-between gap-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Quarter-Kelly size cap" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": settings.useKelly,
						className: cn("min-h-11 rounded-full border px-3", settings.useKelly ? "border-brass text-brass" : "border-line text-faint"),
						onClick: () => update({ useKelly: !settings.useKelly }),
						children: settings.useKelly ? "On" : "Off"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Kelly ceiling",
					value: settings.kellyCap,
					min: .02,
					max: .2,
					step: .01,
					format: (v) => pct(v),
					onChange: (v) => update({ kellyCap: v })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 text-xs text-faint",
					children: [
						"Current size fraction ",
						pct(kelly, 1),
						" of equity, and never more than free cash split across the open slots."
					]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Sources" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-col gap-4",
				children: Object.keys(SOURCE_META).map((id) => {
					const meta = SOURCE_META[id];
					const src = settings.sources[id];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-b border-line pb-4 last:border-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: meta.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-faint",
								children: meta.role
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": src.enabled,
								className: cn("min-h-11 rounded-full border px-3 text-sm", src.enabled ? "border-brass text-brass" : "border-line text-faint"),
								onClick: () => setSource(id, { enabled: !src.enabled }),
								children: src.enabled ? "On" : "Off"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
							label: "Weight",
							value: src.weight,
							min: 0,
							max: 3,
							step: .1,
							format: (v) => v.toFixed(1),
							onChange: (v) => setSource(id, { weight: v })
						})]
					}, id);
				})
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Safety" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Daily paper withdrawal cap",
					value: settings.dailyWithdrawCap,
					min: 100,
					max: 5e4,
					step: 100,
					format: (v) => money(v),
					onChange: (v) => update({ dailyWithdrawCap: v })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => newSession(),
							children: "Start a flat session"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-faint",
							children: "Keeps cash, the PIN, and learned weights. Clears open risk and starts a new price path."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm font-semibold text-cream",
									children: "Demo Sandbox Reset"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-faint",
									children: "Reset the Demo desk balance back to $500.00 and clear the adaptive learning memory."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => {
										resetDemo();
									},
									className: "mt-1 w-fit",
									children: "Reset Demo Desk to $500.00"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-sm",
							children: ["Type RESET to restore the $500 opening book", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "field mt-2",
								value: phrase,
								onChange: (e) => setPhrase(e.target.value),
								"aria-label": "Type RESET to confirm"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "danger",
							disabled: phrase !== "RESET",
							onClick: () => {
								restore();
								setPhrase("");
							},
							children: "Restore opening balance"
						})
					]
				})
			] })
		]
	});
}
function Slider({ label, value, min, max, step, format, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "mt-4 flex flex-col gap-2 text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-brass",
				children: format(value)
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "range",
			min,
			max,
			step,
			value,
			"aria-label": label,
			onChange: (event) => onChange(Number(event.target.value))
		})]
	});
}
var SplitComponent = SettingsView;
//#endregion
export { SplitComponent as component };
