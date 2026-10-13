import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, n as Card, r as Label, t as Button } from "./ui-9RT2T2XE.mjs";
import { c as equity, l as exposure } from "./paper-DKIhRqAY.mjs";
import { H as ArrowUpRight, O as History, T as LockKeyhole, W as ArrowDownLeft, r as Wallet } from "../_libs/lucide-react.mjs";
import { a as LiveModeTransitionModal, g as useDesk, o as useMascot } from "./router-DMlX_g4f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/wallet-DFMwUWTb.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function WalletView() {
	const demo = useDesk((state) => state.demo);
	const fund = useDesk((state) => state.fund);
	const walletHistory = useDesk((state) => state.walletHistory);
	const [operation, setOperation] = (0, import_react.useState)("in");
	const [amount, setAmount] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [success, setSuccess] = (0, import_react.useState)("");
	const [showLiveStatus, setShowLiveStatus] = (0, import_react.useState)(false);
	const amountValue = Number(amount);
	const amountIsValid = Number.isFinite(amountValue) && amountValue > 0;
	const totalEquity = equity(demo);
	const currentExposure = exposure(demo);
	function postPaperAdjustment() {
		setError("");
		setSuccess("");
		if (!amountIsValid) {
			setError("Enter an amount greater than zero.");
			return;
		}
		const result = fund(operation, amountValue);
		if (!result.ok) {
			setError(result.note);
			return;
		}
		setSuccess(operation === "in" ? `$${amountValue.toFixed(2)} added to the local paper balance.` : `$${amountValue.toFixed(2)} removed from the local paper balance.`);
		useMascot.getState().ping(operation === "in" ? "bright" : "focus");
		setAmount("");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-4xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-bold tracking-tight md:text-3xl",
						children: "Paper Wallet & Ledger"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-faint",
						children: "SIMULATION"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 max-w-2xl text-sm leading-relaxed text-faint",
					children: "No wallet or broker is connected. Adjustments on this page change only the paper-trading balance; no real deposits, withdrawals, or on-chain transfers occur."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "ghost",
					onClick: () => setShowLiveStatus(true),
					className: "min-h-11 shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockKeyhole, {
						className: "mr-2 size-4",
						"aria-hidden": "true"
					}), "Live unavailable"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
				"aria-label": "Paper account summary",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "PAPER EQUITY"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "num mt-1 text-2xl font-bold",
							children: ["$", totalEquity.toFixed(2)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[11px] text-faint",
							children: "Simulated balance"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "AVAILABLE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "num mt-1 text-2xl font-bold text-gain",
							children: ["$", demo.cash.toFixed(2)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[11px] text-faint",
							children: "Paper cash"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "EXPOSURE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "num mt-1 text-2xl font-bold",
							children: ["$", currentExposure.toFixed(2)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-[11px] text-faint",
							children: [demo.positions.length, " paper positions"]
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "REALIZED P&L"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: cn("num mt-1 text-2xl font-bold", demo.dayPnl >= 0 ? "text-gain" : "text-loss"),
							children: [
								demo.dayPnl >= 0 ? "+" : "",
								"$",
								demo.dayPnl.toFixed(2)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-[11px] text-faint",
							children: [demo.trades.length, " paper closes"]
						})
					] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex flex-col gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 border-b border-line pb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, {
							className: "size-4 text-brass",
							"aria-hidden": "true"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Paper balance adjustment" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex w-fit rounded-lg border border-line bg-panel-2 p-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setOperation("in");
								setError("");
								setSuccess("");
							},
							"aria-pressed": operation === "in",
							className: cn("flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-semibold", operation === "in" ? "bg-brass text-ink" : "text-faint hover:text-cream"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownLeft, {
								className: "size-3.5",
								"aria-hidden": "true"
							}), "Add paper funds"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setOperation("out");
								setError("");
								setSuccess("");
							},
							"aria-pressed": operation === "out",
							className: cn("flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-semibold", operation === "out" ? "bg-brass text-ink" : "text-faint hover:text-cream"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, {
								className: "size-3.5",
								"aria-hidden": "true"
							}), "Remove paper funds"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex flex-col gap-1.5 text-xs font-semibold text-faint",
							htmlFor: "paper-amount",
							children: ["Amount (simulation only)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								id: "paper-amount",
								type: "number",
								min: "0",
								step: "any",
								inputMode: "decimal",
								value: amount,
								onChange: (event) => {
									setAmount(event.target.value);
									setError("");
									setSuccess("");
								},
								placeholder: "Enter an amount",
								className: "field h-11 rounded-xl border border-line bg-panel-2 px-3.5 font-mono text-base text-cream outline-none focus:border-brass"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: postPaperAdjustment,
							className: "min-h-11 sm:min-w-44",
							children: operation === "in" ? "Add to paper balance" : "Remove from paper balance"
						})]
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "alert",
						className: "text-xs font-medium text-loss",
						children: error
					}) : null,
					success ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "status",
						className: "text-xs font-medium text-gain",
						children: success
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-line pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, {
						className: "size-4 text-brass",
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Paper ledger history" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-xs text-faint",
					children: [walletHistory.length, " local records"]
				})]
			}), walletHistory.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-faint",
				children: "No paper ledger adjustments recorded."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[34rem] text-left text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "border-b border-line text-[10px] tracking-wider text-faint uppercase",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Time"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Entry"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Details"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 text-right font-normal",
								children: "Paper amount"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 text-right font-normal",
								children: "Record"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
						className: "divide-y divide-line/60",
						children: walletHistory.map((transaction) => {
							const isDeposit = transaction.type === "DEPOSIT";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "hover:bg-panel-2/50",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5 text-faint",
										children: new Date(transaction.ts).toLocaleString([], {
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5 text-cream",
										children: isDeposit ? "Add" : "Remove"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5 text-faint",
										children: transaction.note
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: cn("py-2.5 text-right font-mono font-semibold", isDeposit ? "text-gain" : "text-loss"),
										children: [
											isDeposit ? "+" : "-",
											"$",
											transaction.amount.toFixed(2)
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5 text-right text-faint",
										children: "Local only"
									})
								]
							}, transaction.id);
						})
					})]
				})
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveModeTransitionModal, {
				isOpen: showLiveStatus,
				onClose: () => setShowLiveStatus(false)
			})
		]
	});
}
var SplitComponent = WalletView;
//#endregion
export { SplitComponent as component };
