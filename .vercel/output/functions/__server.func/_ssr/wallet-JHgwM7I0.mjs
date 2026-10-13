import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, n as Card, r as Label, t as Button } from "./ui-9RT2T2XE.mjs";
import { c as equity, l as exposure } from "./paper-MZacH4KP.mjs";
import { r as create } from "../_libs/zustand.mjs";
import { A as ExternalLink, B as Check, C as QrCode, K as ArrowDownLeft, O as History, P as Copy, U as ArrowUpRight, c as Sparkles, z as CircleCheck } from "../_libs/lucide-react.mjs";
import { u as DEPOSIT_NETWORKS } from "./router-BNCp43VR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/wallet-JHgwM7I0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** No-op mascot bus. Wallet actions ping this; the visual is optional. */
var useMascot = create(() => ({ ping: () => {} }));
var NETWORKS = [
	{
		id: "ETH",
		label: "Ethereum (ERC-20)",
		feeUsd: 1.5
	},
	{
		id: "SOL",
		label: "Solana (SPL)",
		feeUsd: .05
	},
	{
		id: "BSC",
		label: "BNB Smart Chain (BEP-20)",
		feeUsd: .2
	},
	{
		id: "BTC",
		label: "Bitcoin (BTC)",
		feeUsd: 2.2
	},
	{
		id: "ARB",
		label: "Arbitrum One",
		feeUsd: .15
	}
];
function WalletView() {
	const mode = useDesk((s) => s.mode);
	const setMode = useDesk((s) => s.setMode);
	const demo = useDesk((s) => s.demo);
	const live = useDesk((s) => s.live);
	const fund = useDesk((s) => s.fund);
	const walletHistory = useDesk((s) => s.walletHistory);
	const book = mode === "live" ? live : demo;
	const eq = equity(book);
	const exp = exposure(book);
	const [tab, setTab] = (0, import_react.useState)("withdraw");
	const [amount, setAmount] = (0, import_react.useState)("50");
	const [address, setAddress] = (0, import_react.useState)("");
	const [network, setNetwork] = (0, import_react.useState)(NETWORKS[0].label);
	const [error, setError] = (0, import_react.useState)("");
	const [success, setSuccess] = (0, import_react.useState)("");
	const [confirming, setConfirming] = (0, import_react.useState)(false);
	const [depositNet, setDepositNet] = (0, import_react.useState)(DEPOSIT_NETWORKS[0]);
	const [depositCopied, setDepositCopied] = (0, import_react.useState)(false);
	const [showDepositQr, setShowDepositQr] = (0, import_react.useState)(false);
	const selectedNet = NETWORKS.find((n) => n.label === network) ?? NETWORKS[0];
	const numAmount = Number(amount) || 0;
	const netAmount = Math.max(0, numAmount - selectedNet.feeUsd);
	function handleWithdraw() {
		setError("");
		setSuccess("");
		if (!address.trim()) {
			setError("Please enter a valid destination withdrawing address.");
			return;
		}
		if (address.trim().length < 10) {
			setError("Destination wallet address appears too short or invalid.");
			return;
		}
		if (!(numAmount > 0)) {
			setError("Please enter a valid withdrawal amount greater than zero.");
			return;
		}
		if (numAmount > book.cash) {
			setError(`Insufficient free cash. Available: $${book.cash.toFixed(2)}`);
			return;
		}
		const res = fund("out", numAmount, address, network);
		if (!res.ok) {
			setError(res.note);
			return;
		}
		setSuccess(`Withdrawal of $${numAmount.toFixed(2)} posted to ${address.slice(0, 6)}…${address.slice(-4)} (${network}).`);
		useMascot.getState().ping("cigar");
		setConfirming(false);
		setAddress("");
	}
	function handleDeposit() {
		setError("");
		setSuccess("");
		if (!(numAmount > 0)) {
			setError("Please enter a valid deposit amount.");
			return;
		}
		const res = fund("in", numAmount, "", network);
		if (!res.ok) {
			setError(res.note);
			return;
		}
		setSuccess(`Successfully credited $${numAmount.toFixed(2)} to ${mode.toUpperCase()} wallet ledger.`);
		useMascot.getState().ping("boost");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-4xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-bold tracking-tight md:text-3xl",
						children: "Trading Wallet & Ledger"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase", mode === "live" ? "border border-amber-500/40 bg-amber-500/15 text-amber-300" : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"),
						children: [mode.toUpperCase(), " WALLET"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-faint md:text-sm",
					children: mode === "live" ? "Live trading ledger. Deposits and withdrawals reflect on-device ledger accounting for the live trading engine." : "Demo sandbox wallet. Starts with $500.00 play funds to test risk sizing, execution speed, and learning memory."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center rounded-xl border border-line bg-panel-2 p-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							setMode("demo");
							setError("");
							setSuccess("");
						},
						className: cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-all", mode === "demo" ? "bg-brass text-ink" : "text-faint hover:text-cream"),
						children: "Demo ($500)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							setMode("live");
							setError("");
							setSuccess("");
						},
						className: cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-all", mode === "live" ? "bg-amber-500 text-ink" : "text-faint hover:text-cream"),
						children: [
							"Live ($",
							live.cash.toFixed(0),
							")"
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: [mode.toUpperCase(), " TOTAL EQUITY"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "usd num mt-1 text-2xl font-bold",
							children: ["$", eq.toFixed(2)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: "Combined balance"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "AVAILABLE CASH"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "num mt-1 text-2xl font-bold text-gain",
							children: ["$", book.cash.toFixed(2)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: "Free to withdraw or size"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "IN ACTIVE POSITIONS"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "usd num mt-1 text-xl font-bold",
							children: ["$", exp.toFixed(2)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11px] text-faint",
							children: [book.positions.length, " active positions"]
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "SESSION REALIZED P&L"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: cn("num mt-1 text-xl font-bold", book.dayPnl >= 0 ? "text-gain" : "text-loss"),
							children: [
								book.dayPnl >= 0 ? "+" : "",
								"$",
								book.dayPnl.toFixed(2)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11px] text-faint",
							children: [book.trades.length, " closes"]
						})
					] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex flex-col gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex border-b border-line pb-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex rounded-lg border border-line bg-panel-2 p-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setTab("withdraw");
								setError("");
								setSuccess("");
							},
							className: cn("flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors", tab === "withdraw" ? "bg-brass text-ink" : "text-faint hover:text-cream"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "size-3.5" }), " Withdraw Capital"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setTab("deposit");
								setError("");
								setSuccess("");
							},
							className: cn("flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors", tab === "deposit" ? "bg-brass text-ink" : "text-faint hover:text-cream"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownLeft, { className: "size-3.5" }), " Deposit Funds"]
						})]
					})
				}), tab === "withdraw" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-base font-semibold text-cream",
							children: "Withdraw to External Address"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-faint",
							children: "Enter your external blockchain or exchange destination wallet address."
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									htmlFor: "withdraw-addr",
									className: "text-xs font-semibold text-faint uppercase",
									children: ["Destination Withdrawing Address ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-loss",
										children: "*"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "relative",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										id: "withdraw-addr",
										value: address,
										onChange: (e) => {
											setAddress(e.target.value);
											setError("");
										},
										placeholder: "Enter destination wallet address (e.g. 0x71C...3a9 or SOL / BTC address)",
										className: "field h-11 w-full rounded-xl border border-line bg-panel-2 px-3.5 text-xs text-cream outline-none focus:border-brass placeholder:text-faint/50"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-faint",
									children: "Supports Ethereum (0x…), Solana Base58, Bitcoin SegWit/Taproot, and BSC addresses."
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								htmlFor: "network-select",
								className: "text-xs font-semibold text-faint uppercase",
								children: "Transfer Network"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								id: "network-select",
								value: network,
								onChange: (e) => setNetwork(e.target.value),
								className: "field h-11 rounded-xl border border-line bg-panel-2 px-3 text-xs text-cream outline-none focus:border-brass",
								children: NETWORKS.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: n.label,
									children: [
										n.label,
										" (Est. fee ~$",
										n.feeUsd.toFixed(2),
										")"
									]
								}, n.id))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										htmlFor: "amount-input",
										className: "text-xs font-semibold text-faint uppercase",
										children: "Amount (USD)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-xs text-faint",
										children: ["Available: $", book.cash.toFixed(2)]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									id: "amount-input",
									inputMode: "decimal",
									value: amount,
									onChange: (e) => {
										setAmount(e.target.value);
										setError("");
									},
									className: "field h-11 rounded-xl border border-line bg-panel-2 px-3.5 font-mono text-base text-cream outline-none focus:border-brass"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2 pt-1",
									children: [[
										25,
										50,
										100
									].map((preset) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setAmount(String(preset)),
										className: "rounded-lg border border-line bg-panel-2 px-3 py-1 text-xs text-faint hover:text-cream",
										children: ["$", preset]
									}, preset)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setAmount(String(Math.floor(book.cash))),
										className: "rounded-lg border border-line bg-panel-2 px-3 py-1 text-xs font-semibold text-brass hover:text-cream",
										children: [
											"MAX ($",
											Math.floor(book.cash),
											")"
										]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-line bg-panel-2 p-3 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between py-1 text-faint",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Withdrawal Amount:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono text-cream",
										children: ["$", numAmount.toFixed(2)]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between py-1 text-faint",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Estimated Network Gas Fee:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono text-cream",
										children: ["-$", selectedNet.feeUsd.toFixed(2)]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between border-t border-line/60 pt-2 font-semibold text-cream",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Net Estimated Receipt:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono text-gain",
										children: ["$", netAmount.toFixed(2)]
									})]
								})
							]
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium text-loss",
							children: error
						}),
						success && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium text-gain",
							children: success
						}),
						confirming ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-brass/60 bg-brass/10 p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-semibold text-brass uppercase",
									children: "Confirm Withdrawal Order"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-xs text-cream",
									children: [
										"Confirm withdrawing ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-bold",
											children: ["$", numAmount.toFixed(2)]
										}),
										" to:"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "num mt-1 break-all rounded bg-panel p-2 text-xs text-cream",
									children: [
										address,
										" (",
										network,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "danger",
										onClick: handleWithdraw,
										children: "Confirm & Dispatch"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										onClick: () => setConfirming(false),
										children: "Cancel"
									})]
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => {
								if (!address.trim()) {
									setError("Destination withdrawing address is required.");
									return;
								}
								if (!(numAmount > 0)) {
									setError("Enter an amount greater than zero.");
									return;
								}
								setConfirming(true);
							},
							disabled: book.cash <= 0,
							className: "mt-2 font-semibold",
							children: "Withdraw Funds"
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-base font-semibold text-cream",
							children: "Deposit Funds & On-Chain Addresses"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-faint",
							children: mode === "live" ? "Send cryptocurrency or stablecoins to your dedicated Live Monroe execution address below." : "Send simulated crypto to test deposit confirmation, ledger auditing, and live equity sizing."
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold text-faint uppercase",
								children: "1. Select Blockchain Network"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 gap-2 sm:grid-cols-5",
								children: DEPOSIT_NETWORKS.map((net) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => {
										setDepositNet(net);
										setDepositCopied(false);
										setShowDepositQr(false);
									},
									className: cn("flex flex-col rounded-xl border p-2.5 text-left transition-all", depositNet.id === net.id ? "border-amber-400 bg-amber-500/15 text-cream shadow-xs" : "border-line bg-panel-2 text-faint hover:border-line/80 hover:text-cream"),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-bold",
											children: net.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-brass",
											children: net.symbol
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-1 text-[9px] text-faint",
											children: net.standard
										})
									]
								}, net.id))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-line bg-panel-2 p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-xs font-bold text-cream",
										children: [
											depositNet.name,
											" Deposit Address (",
											depositNet.standard,
											")"
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11px] text-faint",
										children: depositNet.note
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300",
										children: depositNet.confirmations
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-ink p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-xs font-semibold text-cream break-all select-all",
										children: depositNet.address
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => {
											navigator.clipboard.writeText(depositNet.address);
											setDepositCopied(true);
											setTimeout(() => setDepositCopied(false), 2e3);
										},
										className: "flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition-colors",
										children: depositCopied ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4 text-gain" }), " Copied"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), " Copy Address"] })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3 text-faint",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Min deposit: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
											className: "text-cream",
											children: ["$", depositNet.minDepositUsd]
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Arrival: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
											className: "text-cream",
											children: depositNet.estimatedArrival
										})] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => setShowDepositQr(!showDepositQr),
											className: "flex items-center gap-1 text-brass hover:text-amber-300",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "size-3.5" }), showDepositQr ? "Hide QR" : "Show QR Code"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: `${depositNet.explorerUrl}${depositNet.address}`,
											target: "_blank",
											rel: "noreferrer",
											className: "flex items-center gap-1 text-faint hover:text-cream",
											children: ["Explorer ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
										})]
									})]
								}),
								showDepositQr && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex flex-col items-center justify-center rounded-xl bg-white p-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
										viewBox: "0 0 24 24",
										className: "size-32 text-black",
										fill: "currentColor",
										"aria-label": "Deposit QR Code",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: depositNet.qrSvgPattern })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-2 text-[10px] text-neutral-800 font-mono text-center",
										children: [
											"Deposit ",
											depositNet.name,
											" (",
											depositNet.id,
											")"
										]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-line/80 bg-panel-2/50 p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-semibold text-cream",
											children: "Fast Simulation & Direct Credit"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-faint",
										children: "Immediate Settlement"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-xs text-faint",
									children: [
										"Simulate an incoming on-chain deposit confirmation to fund the ",
										mode.toUpperCase(),
										" desk."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex flex-col gap-2 sm:flex-row sm:items-center",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											id: "deposit-amount",
											inputMode: "decimal",
											value: amount,
											onChange: (e) => {
												setAmount(e.target.value);
												setError("");
											},
											placeholder: "Amount in USD",
											className: "field h-10 w-full rounded-lg border border-line bg-ink px-3 font-mono text-sm text-cream sm:w-48 outline-none focus:border-brass"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex flex-wrap gap-1.5",
											children: [
												100,
												250,
												500,
												1e3
											].map((preset) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => setAmount(String(preset)),
												className: "rounded-lg border border-line bg-panel px-2.5 py-1 text-xs text-faint hover:text-cream",
												children: ["+$", preset]
											}, preset))
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											onClick: handleDeposit,
											className: "h-10 text-xs font-bold ml-auto shrink-0",
											children: ["Confirm & Credit $", numAmount.toFixed(0)]
										})
									]
								})
							]
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium text-loss",
							children: error
						}),
						success && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium text-gain",
							children: success
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-line pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Wallet & Ledger Audit History" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-xs text-faint",
					children: [walletHistory.length, " ledger events"]
				})]
			}), walletHistory.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-faint",
				children: "No transactions posted yet."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-left font-mono text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "border-b border-line text-[10px] tracking-wider text-faint uppercase",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Date / Time"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Type"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Mode"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-normal",
								children: "Destination / Details"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 text-right font-normal",
								children: "Amount"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 text-right font-normal",
								children: "Status"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
						className: "divide-y divide-line/60",
						children: walletHistory.map((tx) => {
							const isDeposit = tx.type === "DEPOSIT";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "hover:bg-panel-2/50",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5 text-faint",
										children: new Date(tx.ts).toLocaleString([], {
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", isDeposit ? "bg-gain/20 text-gain" : "bg-amber-500/20 text-amber-300"),
											children: tx.type
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5 text-cream uppercase",
										children: tx.mode
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5 text-faint",
										title: tx.address || tx.note,
										children: tx.address ? `${tx.address.slice(0, 8)}…${tx.address.slice(-6)} (${tx.network})` : tx.note
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: cn("py-2.5 text-right font-bold", isDeposit ? "text-gain" : "text-loss"),
										children: [
											isDeposit ? "+" : "-",
											"$",
											tx.amount.toFixed(2)
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5 text-right text-gain",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "inline-flex items-center gap-1 rounded bg-gain/10 px-1.5 py-0.5 text-[10px] font-medium text-gain",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3" }), " Confirmed"]
										})
									})
								]
							}, tx.id);
						})
					})]
				})
			})] })
		]
	});
}
var SplitComponent = WalletView;
//#endregion
export { SplitComponent as component };
