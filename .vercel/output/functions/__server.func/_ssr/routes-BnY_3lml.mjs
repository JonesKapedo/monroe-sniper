import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as equity, c as portfolioLines, d as setKill, i as entryVerdict, l as sampleTape, n as emptyBook, o as exposure, r as enter, s as markBook, t as closeOne } from "./paper-DIU7_PCo.mjs";
import { a as Play, i as RotateCcw, n as Shield, o as Pause, r as Search, s as Crosshair } from "../_libs/lucide-react.mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BnY_3lml.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
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
var scanMarket = createServerFn({ method: "POST" }).validator((input) => ({ query: String(input?.query ?? "").trim().slice(0, 64) })).handler(createSsrRpc("b50b27850b6938f67a83fb0f0bbd29df2b9c6e58e4e61262560434ed87e6c4f9"));
var useDesk = create()(persist((set) => ({
	book: emptyBook(),
	tape: [],
	note: "Scan the public tape, or load the sample book.",
	hydrated: false,
	enterName: (c) => set((s) => {
		const r = enter(s.book, c);
		return {
			book: r.book,
			note: r.note
		};
	}),
	flatten: (id) => set((s) => ({
		book: closeOne(s.book, id),
		note: "Closed on the paper book"
	})),
	halt: (on) => set((s) => ({
		book: setKill(s.book, on),
		note: on ? "Kill switch on" : "Kill switch cleared"
	})),
	applyMarks: (prices) => set((s) => ({ book: markBook(s.book, prices) })),
	setTape: (rows, note) => set({
		tape: rows,
		note
	}),
	reset: () => set({
		book: emptyBook(),
		note: "Paper book reset to $25,000"
	}),
	markHydrated: () => set({ hydrated: true })
}), {
	name: "monroe-paper-v1",
	storage: createJSONStorage(() => typeof window === "undefined" ? {
		getItem: () => null,
		setItem: () => void 0,
		removeItem: () => void 0
	} : localStorage),
	partialize: (s) => ({ book: s.book }),
	skipHydration: true
}));
var money = (n) => n.toLocaleString("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0
});
var px = (n) => {
	if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
	return `$${n.toPrecision(3)}`;
};
function Desk() {
	const book = useDesk((s) => s.book);
	const tape = useDesk((s) => s.tape);
	const note = useDesk((s) => s.note);
	const enterName = useDesk((s) => s.enterName);
	const flatten = useDesk((s) => s.flatten);
	const halt = useDesk((s) => s.halt);
	const applyMarks = useDesk((s) => s.applyMarks);
	const setTape = useDesk((s) => s.setTape);
	const reset = useDesk((s) => s.reset);
	const markHydrated = useDesk((s) => s.markHydrated);
	const [tab, setTab] = (0, import_react.useState)("scan");
	const [query, setQuery] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [picked, setPicked] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		useDesk.persist.rehydrate();
		markHydrated();
	}, [markHydrated]);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			const prices = {};
			for (const p of useDesk.getState().book.positions) {
				const drift = 1 + (Math.random() - .48) * .012;
				prices[p.tokenId] = p.mark * drift;
			}
			if (Object.keys(prices).length) applyMarks(prices);
		}, 4e3);
		return () => window.clearInterval(id);
	}, [applyMarks]);
	async function scan(q) {
		setBusy(true);
		try {
			const res = await scanMarket({ data: { query: q } });
			if (res.candidates.length) setTape(res.candidates, res.note);
			else setTape(sampleTape(), `${res.note}. Showing the built-in sample tape.`);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Scan failed";
			setTape(sampleTape(), `${message}. Showing the built-in sample tape.`);
		} finally {
			setBusy(false);
		}
	}
	const eq = equity(book);
	const exp = exposure(book);
	const dd = book.peakEquity > 0 ? Math.max(0, (book.peakEquity - eq) / book.peakEquity) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "num text-xs tracking-widest text-accent uppercase",
						children: "Paper desk"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-1 text-4xl leading-none text-fg",
						children: "Monroe Sniper"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-xl text-base text-muted",
						children: "Public tape, fail-closed gates, simulated fills. Nothing here sends a live order."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							label: "Equity",
							value: money(eq)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							label: "Cash",
							value: money(book.cash)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							label: "Open",
							value: `${book.positions.length}/3`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => halt(!book.kill),
							className: "inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-fg",
							children: [book.kill ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" }), book.kill ? "Clear halt" : "Kill switch"]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "num mt-4 text-sm text-muted",
				children: note
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "mt-4 flex gap-2 overflow-x-auto",
				children: [
					["scan", "Scanner"],
					["book", "Book"],
					["risk", "Risk"],
					["later", "Needs keys"]
				].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(id),
					className: "min-h-11 rounded-full px-4 text-sm " + (tab === id ? "bg-accent text-accent-ink" : "bg-surface text-muted"),
					children: label
				}, id))
			}),
			tab === "scan" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "flex flex-col gap-2 sm:flex-row",
					onSubmit: (e) => {
						e.preventDefault();
						scan(query);
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "sr-only",
							htmlFor: "q",
							children: "Search tokens"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex min-h-11 flex-1 items-center gap-2 rounded-card border border-line bg-surface px-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								id: "q",
								value: query,
								onChange: (e) => setQuery(e.target.value),
								placeholder: "Symbol, name, or contract",
								className: "w-full bg-transparent py-3 text-fg outline-none placeholder:text-muted"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							disabled: busy,
							className: "min-h-11 rounded-card bg-accent px-5 text-sm font-medium text-accent-ink disabled:opacity-60",
							children: busy ? "Scanning…" : "Scan live tape"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setTape(sampleTape(), "Sample tape loaded. Scores are heuristics, not a promise."),
							className: "min-h-11 rounded-card border border-line px-4 text-sm text-fg",
							children: "Sample tape"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-5 grid gap-3",
					children: [tape.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "rounded-card border border-dashed border-line p-6 text-muted",
						children: "No names yet. Scan DexScreener or load the sample tape."
					}), tape.map((c) => {
						const v = entryVerdict(book, c);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-card border border-line bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-start justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-baseline gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-2xl",
												children: c.symbol
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm text-muted",
												children: c.chain
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted",
											children: c.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-2 max-w-xl text-sm text-fg",
											children: c.rationale[0]
										})
									] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-right",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "num text-3xl text-accent",
												children: c.score
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "num text-sm text-muted",
												children: px(c.priceUsd)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "num text-sm text-muted",
												children: ["Liq ", money(c.liquidityUsd)]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex flex-wrap items-center gap-2",
									children: [
										c.flags.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "num rounded-full border border-line px-2 py-1 text-xs text-loss",
											children: f
										}, f)),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setPicked(picked?.id === c.id ? null : c),
											className: "ml-auto min-h-11 rounded-full border border-line px-4 text-sm",
											children: "Gate"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											disabled: !v.allowed,
											onClick: () => enterName(c),
											className: "inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm text-accent-ink disabled:opacity-40",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-4" }), "Paper buy"]
										})
									]
								}),
								picked?.id === c.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-3 grid gap-1 border-t border-line pt-3",
									children: v.lines.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex justify-between gap-3 text-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: line.pass ? "text-ok" : "text-loss",
											children: line.label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "num text-muted",
											children: line.detail
										})]
									}, line.id))
								})
							]
						}, c.id);
					})]
				})]
			}),
			tab === "book" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6 grid gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-2xl",
							children: "Open paper"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: reset,
							className: "inline-flex min-h-11 items-center gap-2 text-sm text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" }), " Reset book"]
						})]
					}),
					book.positions.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "rounded-card border border-dashed border-line p-6 text-muted",
						children: "No open paper positions."
					}),
					book.positions.map((p) => {
						const pnl = (p.mark - p.entryPrice) * p.qty;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "rounded-card border border-line bg-surface p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-2xl",
									children: p.symbol
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "num text-sm text-muted",
									children: [
										p.chain,
										" · qty ",
										p.qty.toPrecision(4),
										" · stop ",
										px(p.stop)
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "num text-xl " + (pnl >= 0 ? "text-ok" : "text-loss"),
										children: [pnl >= 0 ? "+" : "", money(pnl)]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "num text-sm text-muted",
										children: ["Mark ", px(p.mark)]
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => flatten(p.id),
								className: "mt-3 min-h-11 rounded-full border border-line px-4 text-sm",
								children: "Flatten"
							})]
						}, p.id);
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-2 text-2xl",
						children: "Closed"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "grid gap-2",
						children: [book.trades.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-muted",
							children: "No closes yet."
						}), book.trades.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex justify-between rounded-card bg-surface-2 px-4 py-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								t.symbol,
								" · ",
								t.reason
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "num " + (t.pnl >= 0 ? "text-ok" : "text-loss"),
								children: money(t.pnl)
							})]
						}, t.id))]
					})
				]
			}),
			tab === "risk" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6 grid gap-4 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-card border border-line bg-surface p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-accent",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-2xl text-fg",
							children: "Portfolio gates"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 grid gap-2",
						children: portfolioLines(book).map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex justify-between text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: line.pass ? "text-ok" : "text-loss",
								children: line.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "num text-muted",
								children: line.detail
							})]
						}, line.id))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-card border border-line bg-surface p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-2xl",
							children: "Exposure"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-muted",
							children: "Idea cap 5% of equity. Book cap 15%. Hard stop 8% under fill. Six-hour time stop. Three-loss cooldown."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "num mt-4 text-3xl",
							children: money(exp)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "num text-sm text-muted",
							children: [
								"Drawdown ",
								(dd * 100).toFixed(1),
								"% · streak ",
								book.consecutiveLosses
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-4 h-2 overflow-hidden rounded-full bg-surface-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full bg-accent",
								style: { width: `${Math.min(100, exp / Math.max(eq, 1) * 100 * (100 / 15))}%` }
							})
						})
					]
				})]
			}),
			tab === "later" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6 grid gap-3 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Later, {
						title: "Chain RPC",
						body: "Swap this desk's mark loop for a websocket of pool logs. One chain first. Interface: subscribe(pair) → price, liquidity."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Later, {
						title: "Wallet signing",
						body: "Keep keys on a server signer, never in the browser. Strategy proposes; a separate signer checks notional, chain, and router before it signs."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Later, {
						title: "DEX router",
						body: "Plug a quote → simulate → submit adapter behind the same Gate. Testnet only until fills reconcile to the ledger."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Later, {
						title: "Alerts",
						body: "Operator channel for halt, failed exit, and stale feed. The desk already has the events; it only needs a destination."
					})
				]
			})
		]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-24",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs tracking-wide text-muted uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "num text-lg",
			children: value
		})]
	});
}
function Later({ title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-card border border-line bg-surface p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "num text-xs text-accent uppercase",
				children: "Not connected"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-1 text-2xl",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: body
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Desk, {});
}
//#endregion
export { Home as component };
