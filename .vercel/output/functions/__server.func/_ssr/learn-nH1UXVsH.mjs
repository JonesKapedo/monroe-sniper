import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, Y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as cn, n as Card, r as Label, t as Button } from "./ui-9RT2T2XE.mjs";
import { A as ExternalLink, E as Link, H as Ban, V as Bookmark, a as Twitter, b as RefreshCw, c as Sparkles, f as ShieldCheck, h as Search, i as Unlink, k as FileText, m as Share2, o as TriangleAlert, p as ShieldAlert, v as RotateCcw, x as Radio } from "../_libs/lucide-react.mjs";
import { f as useDesk, l as useDyorStore } from "./router-BNCp43VR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/learn-nH1UXVsH.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LearnView() {
	const instruments = useDyorStore((s) => s.instruments);
	const connectedProfiles = useDyorStore((s) => s.connectedProfiles);
	const filterStatus = useDyorStore((s) => s.filterStatus);
	const selectedInstrumentId = useDyorStore((s) => s.selectedInstrumentId);
	const searchQuery = useDyorStore((s) => s.searchQuery);
	const isScanning = useDyorStore((s) => s.isScanning);
	const setFilterStatus = useDyorStore((s) => s.setFilterStatus);
	const setSelectedInstrument = useDyorStore((s) => s.setSelectedInstrument);
	const setSearchQuery = useDyorStore((s) => s.setSearchQuery);
	const saveInstrument = useDyorStore((s) => s.saveInstrument);
	const blacklistInstrument = useDyorStore((s) => s.blacklistInstrument);
	const runDeepEvaluation = useDyorStore((s) => s.runDeepEvaluation);
	const triggerGlobalScan = useDyorStore((s) => s.triggerGlobalScan);
	const connectProfile = useDyorStore((s) => s.connectProfile);
	const disconnectProfile = useDyorStore((s) => s.disconnectProfile);
	const resetCatalog = useDyorStore((s) => s.resetDyorCatalog);
	const tape = useDesk((s) => s.tape);
	const memory = useDesk((s) => s.memory);
	const [activeTab, setActiveTab] = (0, import_react.useState)("INSTRUMENTS");
	const [connectModalProvider, setConnectModalProvider] = (0, import_react.useState)(null);
	const [profileInputHandle, setProfileInputHandle] = (0, import_react.useState)("");
	const filteredInstruments = instruments.filter((inst) => {
		if (filterStatus !== "ALL" && inst.status !== filterStatus) return false;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			return inst.symbol.toLowerCase().includes(q) || inst.name.toLowerCase().includes(q) || inst.chain.toLowerCase().includes(q) || inst.address.toLowerCase().includes(q);
		}
		return true;
	});
	const selectedInst = instruments.find((i) => i.id === selectedInstrumentId) ?? filteredInstruments[0] ?? instruments[0];
	const savedCount = instruments.filter((i) => i.status === "SAVED").length;
	const blacklistedCount = instruments.filter((i) => i.status === "BLACKLISTED").length;
	const evaluatingCount = instruments.filter((i) => i.status === "EVALUATING").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-bold tracking-tight md:text-3xl",
						children: "DYOR Intelligence Engine"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full border border-brass/50 bg-brass/10 px-2.5 py-0.5 text-xs font-semibold text-brass uppercase",
						children: "Multi-Source Verification & Safety Gate"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-faint md:text-sm",
					children: "Continuous deep research on every financial instrument the sniper interacts with. Cross-checks honeypots across multiple security engines, monitors social velocity on X & Decrypt, and automatically quarantines blacklisted contracts."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						onClick: triggerGlobalScan,
						disabled: isScanning,
						className: "text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("mr-1.5 size-3.5", isScanning && "animate-spin text-brass") }), isScanning ? "Evaluating Markets..." : "Re-Scan All Feeds"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						onClick: resetCatalog,
						className: "text-xs text-faint hover:text-cream",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "mr-1.5 size-3.5" }), " Reset Catalog"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "border-brass/40",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] tracking-wider text-faint uppercase",
								children: "Verified Saved Universe"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex items-baseline gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "num text-2xl font-bold text-gain",
									children: savedCount
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-faint",
									children: "Approved"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-faint",
								children: "Cleared all multi-engine safety gates"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "border-loss/40",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] tracking-wider text-faint uppercase",
								children: "Blacklisted Quarantined"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex items-baseline gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "num text-2xl font-bold text-loss",
									children: blacklistedCount
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-faint",
									children: "Blocked"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-faint",
								children: "Honeypots, predatory fees & scams"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Active Evaluations"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 flex items-baseline gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "num text-2xl font-bold text-brass",
								children: evaluatingCount
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-faint",
								children: "In Progress"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: "Discovered on live market feeds"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-wider text-faint uppercase",
							children: "Connected Profiles"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 flex items-baseline gap-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "num text-2xl font-bold text-cream",
								children: [
									connectedProfiles.filter((p) => p.connected).length,
									" / ",
									connectedProfiles.length
								]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: "Twitter [X], Decrypt & Feeds"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "col-span-2 sm:col-span-4 lg:col-span-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] tracking-wider text-faint uppercase",
								children: "Self-Learning Memory"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex items-baseline gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "num text-2xl font-bold text-cream",
									children: memory.seen
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-faint",
									children: "Fills Studied"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[11px] text-faint",
								children: [
									"Score Floor: ",
									memory.minScore,
									"/100"
								]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex border-b border-line",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setActiveTab("INSTRUMENTS"),
						className: cn("flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition", activeTab === "INSTRUMENTS" ? "border-brass text-cream" : "border-transparent text-faint hover:text-cream"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "size-3.5" }),
							" Evaluated Instruments (",
							instruments.length,
							")"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setActiveTab("INTEGRATIONS"),
						className: cn("flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition", activeTab === "INTEGRATIONS" ? "border-brass text-cream" : "border-transparent text-faint hover:text-cream"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "size-3.5" }), " Social Profiles & Decrypt Integration"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setActiveTab("INTELLIGENCE"),
						className: cn("flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition", activeTab === "INTELLIGENCE" ? "border-brass text-cream" : "border-transparent text-faint hover:text-cream"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), " Multi-Source Pipeline & Brain Logic"]
					})
				]
			}),
			activeTab === "INSTRUMENTS" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-5 lg:grid-cols-12",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-3 lg:col-span-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 rounded-xl border border-line bg-panel p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute top-3 left-3 size-4 text-faint" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "Filter by token symbol, name, address, or chain...",
								value: searchQuery,
								onChange: (e) => setSearchQuery(e.target.value),
								className: "field h-10 w-full rounded-lg border border-line bg-panel-2 pr-3 pl-9 text-xs text-cream outline-none focus:border-brass"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-4 gap-1 pt-1 text-[11px] font-semibold",
							children: [
								"ALL",
								"SAVED",
								"BLACKLISTED",
								"EVALUATING"
							].map((status) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setFilterStatus(status),
								className: cn("rounded-lg px-2 py-1.5 transition text-center", filterStatus === status ? "bg-brass text-ink font-bold" : "bg-panel-2 text-faint hover:text-cream"),
								children: [
									status === "ALL" && "All",
									status === "SAVED" && "Saved",
									status === "BLACKLISTED" && "Blocked",
									status === "EVALUATING" && "Scanning"
								]
							}, status))
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex max-h-[580px] flex-col gap-2 overflow-y-auto pr-1",
						children: filteredInstruments.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-xl border border-line bg-panel p-6 text-center text-xs text-faint",
							children: "No instruments matching the current criteria."
						}) : filteredInstruments.map((inst) => {
							const isSelected = inst.id === selectedInst?.id;
							const isBlacklisted = inst.status === "BLACKLISTED";
							const isSaved = inst.status === "SAVED";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								onClick: () => setSelectedInstrument(inst.id),
								className: cn("cursor-pointer rounded-xl border p-3.5 transition", isSelected ? "border-brass bg-brass/10" : "border-line bg-panel hover:border-line/90 hover:bg-panel-2"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-bold text-sm text-cream",
												children: inst.symbol
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-xs text-faint",
												children: [
													"(",
													inst.name,
													")"
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase font-mono text-faint",
												children: inst.chain
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-0.5 font-mono text-[11px] text-faint",
										children: [
											inst.address.slice(0, 10),
											"…",
											inst.address.slice(-6)
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-right",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", isSaved && "bg-gain/20 text-gain border border-gain/40", isBlacklisted && "bg-loss/20 text-loss border border-loss/40", inst.status === "EVALUATING" && "bg-brass/20 text-brass border border-brass/40"),
											children: inst.status
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-1 font-mono text-xs",
											children: [
												"Safety:",
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: cn("font-bold", inst.overallSafetyScore >= 80 && "text-gain", inst.overallSafetyScore < 80 && inst.overallSafetyScore >= 50 && "text-brass", inst.overallSafetyScore < 50 && "text-loss"),
													children: [inst.overallSafetyScore, "%"]
												})
											]
										})]
									})]
								}), inst.autoBlacklistedReason && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 rounded bg-loss/10 p-1.5 text-[11px] text-loss flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: inst.autoBlacklistedReason
									})]
								})]
							}, inst.id);
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col gap-4 lg:col-span-7",
					children: selectedInst ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 md:p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-center md:justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "text-xl font-bold text-cream",
											children: selectedInst.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono text-brass font-bold",
											children: [
												"($",
												selectedInst.symbol,
												")"
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", selectedInst.status === "SAVED" && "bg-gain/20 text-gain border border-gain/40", selectedInst.status === "BLACKLISTED" && "bg-loss/20 text-loss border border-loss/40", selectedInst.status === "EVALUATING" && "bg-brass/20 text-brass border border-brass/40"),
											children: selectedInst.status
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 flex flex-wrap items-center gap-3 text-xs text-faint",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Chain: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
											className: "text-cream uppercase",
											children: selectedInst.chain
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Venue: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
											className: "text-cream uppercase",
											children: selectedInst.venue
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono",
											children: ["Address: ", selectedInst.address]
										})
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [
										selectedInst.status !== "SAVED" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "solid",
											onClick: () => saveInstrument(selectedInst.id),
											className: "bg-gain text-ink hover:bg-gain/90 text-xs font-semibold",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "mr-1.5 size-3.5" }), " Save Instrument"]
										}),
										selectedInst.status !== "BLACKLISTED" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "danger",
											onClick: () => blacklistInstrument(selectedInst.id, "Flagged during manual DYOR audit"),
											className: "text-xs font-semibold",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ban, { className: "mr-1.5 size-3.5" }), " Blacklist Instrument"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "ghost",
											onClick: () => runDeepEvaluation(selectedInst.id),
											disabled: isScanning,
											className: "text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("mr-1.5 size-3.5", isScanning && "animate-spin") }), "Re-Audit"]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-line bg-panel-2 p-3 font-mono text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint text-[10px] uppercase font-sans",
										children: "Security Score"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: cn("text-lg font-bold", selectedInst.overallSafetyScore >= 80 ? "text-gain" : selectedInst.overallSafetyScore >= 50 ? "text-brass" : "text-loss"),
										children: [selectedInst.overallSafetyScore, " / 100"]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint text-[10px] uppercase font-sans",
										children: "Audit Confidence"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-lg font-bold text-cream",
										children: [selectedInst.overallConfidence, "%"]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint text-[10px] uppercase font-sans",
										children: "Multi-Engine Sources"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-lg font-bold text-brass",
										children: [selectedInst.honeypotMultiSource.length, " Verified"]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint text-[10px] uppercase font-sans",
										children: "Social Presence"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-lg font-bold text-cream",
										children: [selectedInst.socialIntelligence.length, " Feeds"]
									})] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 border-b border-line pb-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Multi-Engine Honeypot & Contract Exploitation Analysis" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-col gap-2",
									children: selectedInst.honeypotMultiSource.map((check, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: cn("rounded-lg border p-3 text-xs", check.isHoneypot ? "border-loss/60 bg-loss/10" : "border-line bg-panel-2"),
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-cream",
													children: check.source
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", check.isHoneypot ? "bg-loss text-ink" : "bg-gain/20 text-gain border border-gain/40"),
													children: check.verdict
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Buy Tax: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: check.buyTaxPct > 5 ? "text-loss" : "text-cream",
														children: [check.buyTaxPct, "%"]
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Sell Tax: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: check.sellTaxPct > 10 ? "text-loss" : "text-cream",
														children: [check.sellTaxPct, "%"]
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["LP Locked: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
														className: check.liquidityLockedPct < 50 ? "text-loss" : "text-gain",
														children: [check.liquidityLockedPct, "%"]
													})] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Mintable: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
														className: check.isMintable ? "text-loss" : "text-gain",
														children: check.isMintable ? "YES (Warning)" : "NO"
													})] })
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mt-2 text-faint text-[11px] font-sans",
												children: check.details
											})
										]
									}, idx))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 border-b border-line pb-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Social Media Presence & Decrypt News Wire" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid gap-2 sm:grid-cols-2",
									children: selectedInst.socialIntelligence.map((social, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-lg border border-line bg-panel-2 p-3 text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-1.5",
													children: [social.platform === "X_TWITTER" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Twitter, { className: "size-3.5 text-[#1DA1F2]" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-3.5 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-semibold text-cream",
														children: social.platform === "X_TWITTER" ? "X / Twitter Velocity" : "Decrypt Intelligence"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", social.sentimentLabel === "BULLISH" && "text-gain bg-gain/10", social.sentimentLabel === "BEARISH" && "text-loss bg-loss/10", social.sentimentLabel === "ASTROTURFED" && "text-loss bg-loss/20 border border-loss", social.sentimentLabel === "NEUTRAL" && "text-faint"),
													children: social.sentimentLabel
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-2 flex items-center justify-between font-mono text-[11px]",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Organic Ratio: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [Math.round(social.organicEngagementRatio * 100), "%"] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Velocity: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [social.mentionVelocity24h, "/hr"] })] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "mt-2 flex flex-col gap-1 border-t border-line/60 pt-2 text-[11px] text-faint font-sans",
												children: social.recentHeadlines.map((h, hIdx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "line-clamp-2",
													children: ["• ", h]
												}, hIdx))
											})
										]
									}, idx))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 border-b border-line pb-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Real Market Evaluations Across Liquidity Venues" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-col gap-2",
									children: selectedInst.marketEvaluations.map((mkt, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center justify-between rounded-lg border border-line bg-panel-2 p-2.5 font-mono text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-cream font-sans",
											children: mkt.source
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "ml-2 text-faint",
											children: ["Price: $", mkt.priceUsd < .01 ? mkt.priceUsd.toFixed(6) : mkt.priceUsd.toFixed(2)]
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3 text-faint text-[11px]",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Liq: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "text-cream",
													children: ["$", mkt.liquidityUsd.toLocaleString()]
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["24h Vol: ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
													className: "text-cream",
													children: ["$", mkt.volume24h.toLocaleString()]
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Regime: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "text-brass",
													children: mkt.volatilityRegime
												})] })
											]
										})]
									}, idx))
								})]
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex h-64 items-center justify-center rounded-xl border border-line bg-panel text-xs text-faint",
						children: "Select an instrument from the catalog to inspect."
					})
				})]
			}),
			activeTab === "INTEGRATIONS" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-between border-b border-line pb-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "External Social Profiles & Intelligence Integrations" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-faint",
						children: "Connect your personal or bot social profiles on Twitter [X], Decrypt feeds, and Telegram channels. This gives Monroe live API access to track community sentiment, detect coordinated bot shills, and verify breaking team announcements."
					})] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 grid gap-4 md:grid-cols-2",
					children: connectedProfiles.map((prof) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: cn("flex flex-col justify-between rounded-xl border p-4 transition", prof.connected ? "border-gain/40 bg-gain/5" : "border-line bg-panel-2"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex size-10 items-center justify-center rounded-lg bg-panel border border-line",
										children: [
											prof.provider === "X_TWITTER" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Twitter, { className: "size-5 text-[#1DA1F2]" }),
											prof.provider === "DECRYPT" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-5 text-brass" }),
											prof.provider === "TELEGRAM" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-5 text-blue-400" }),
											prof.provider === "LUNARCRUSH" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-5 text-purple-400" })
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "font-bold text-sm text-cream",
										children: prof.displayName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-mono text-xs text-faint",
										children: prof.username
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", prof.connected ? "bg-gain/20 text-gain border border-gain/40" : "bg-panel text-faint border border-line"),
									children: prof.connected ? "Connected" : "Disconnected"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex flex-col gap-1 border-t border-line/60 pt-3 text-xs text-faint",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between font-mono text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Rate Limit Budget:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "text-cream",
										children: [prof.rateLimitRemaining, " req/hr"]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between font-mono text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Granted Scopes:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
										className: "text-brass",
										children: [prof.scopes.length, " API scopes"]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-4",
								children: prof.connected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "ghost",
									onClick: () => disconnectProfile(prof.provider),
									className: "w-full text-xs text-loss hover:bg-loss/10 hover:text-loss border-line",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Unlink, { className: "mr-1.5 size-3.5" }), " Disconnect Integration"]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "solid",
									onClick: () => {
										setConnectModalProvider(prof.provider);
										setProfileInputHandle(prof.username || "@");
									},
									className: "w-full text-xs font-semibold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, { className: "mr-1.5 size-3.5" }), " Connect Account"]
								})
							})
						]
					}, prof.id))
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between border-b border-line pb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Decrypt Live Market Editorial Wire Stream" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded bg-gain/20 px-2 py-0.5 text-[10px] font-bold text-gain",
						children: "LIVE STREAMING"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-line bg-panel-2 p-3 text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-[11px] text-faint",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Source: Decrypt Breaking News API" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "2 mins ago" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "mt-1 font-semibold text-cream",
								children: "SEC Commissioner Hints at Clearer Token Classification Guidelines for DEX Aggregators"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-faint",
								children: "Regulatory clarity expected for automated market maker liquidity providers and on-chain routing engines."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-line bg-panel-2 p-3 text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-[11px] text-faint",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Source: Decrypt On-Chain Analysis" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "14 mins ago" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "mt-1 font-semibold text-cream",
								children: "Solana Memecoin Deployments Surge 40%, but Over 92% Fail Honeypot Safety Audits"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-faint",
								children: "Independent investigation highlights the necessity of multi-source contract verification and proxy simulation before automated trade entries."
							})
						]
					})]
				})] })]
			}),
			activeTab === "INTELLIGENCE" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-5 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 border-b border-line pb-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "How the Multi-Source Honeypot Gate Works" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-faint",
							children: "Before placing any trade order, the sniper runs the token contract through a multi-vendor evaluation pipeline:"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2.5 text-xs font-mono",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-line bg-panel-2 p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-bold text-cream font-sans",
										children: "1. Bytecode & Static Simulation"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-faint font-sans",
										children: "Tests buy/sell transactions against an isolated EVM/SVM VM to measure actual tax slippage and check whether token transfers can be frozen or blacklisted."
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-line bg-panel-2 p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-bold text-cream font-sans",
										children: "2. Liquidity Lock & Ownership Timelocks"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-faint font-sans",
										children: "Verifies that pool LP tokens are either burned or locked in verified escrow contracts (e.g. Unicrypt, Team Finance) for at least 60 days."
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-line bg-panel-2 p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-bold text-cream font-sans",
										children: "3. Real-Time Quarantine"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-faint font-sans",
										children: "If any single security engine flags the token as a honeypot or if taxes exceed 10%, the instrument is instantly blacklisted across both Demo and Live trading modes."
									})]
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 border-b border-line pb-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Social Sentiment & Sybil Bot Detection" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-faint",
							children: "Organic community engagement vs. coordinated sybil bot farming:"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2.5 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line bg-panel-2 p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-cream",
									children: "Organic Engagement Threshold"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-faint",
									children: [
										"Measures account age, follower distribution, and quote-tweet variety. Projects with over 70% automated bot replies are tagged as ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "ASTROTURFED" }),
										" and penalized in scoring."
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-line bg-panel-2 p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-cream",
									children: "Live Tape Integration"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-faint",
									children: [
										"As the scanner discovers new pairs across Binance and DexScreener (",
										tape.length,
										" pairs currently on tape), they are continuously fed into DYOR for autonomous verification."
									]
								})]
							})]
						})
					]
				})]
			}),
			connectModalProvider && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-2xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-lg font-bold text-cream",
							children: "Connect Profile"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-faint",
							children: [
								"Authorize Monroe to stream social mentions and project velocity for your ",
								connectModalProvider,
								" profile."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-col gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								htmlFor: "profile-handle-input",
								className: "text-xs font-semibold text-faint uppercase",
								children: "Account Handle / API ID"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								id: "profile-handle-input",
								type: "text",
								value: profileInputHandle,
								onChange: (e) => setProfileInputHandle(e.target.value),
								placeholder: "@YourAccountHandle",
								className: "field h-11 rounded-xl border border-line bg-panel-2 px-3 text-xs text-cream outline-none focus:border-brass"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5 flex items-center justify-end gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: () => setConnectModalProvider(null),
								className: "text-xs",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "solid",
								onClick: () => {
									if (profileInputHandle.trim()) connectProfile(connectModalProvider, profileInputHandle.trim());
									setConnectModalProvider(null);
								},
								className: "text-xs font-semibold",
								children: "Confirm Connection"
							})]
						})
					]
				})
			})
		]
	});
}
var SplitComponent = LearnView;
//#endregion
export { SplitComponent as component };
