import { useCallback, useEffect, useRef, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Bookmark,
  Ban,
  Share2,
  RefreshCw,
  ExternalLink,
  Twitter,
  Radio,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { useDyorStore } from "@/lib/dyor/store";
import { useDesk } from "@/lib/desk-store";
import { searchInstruments } from "@/lib/market.functions";
import { getTradeLearningEvents } from "@/lib/trade-memory.functions";
import { Card, Label, Button } from "@/components/ui";
import { cn } from "@/lib/cn";

export function LearnView() {
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

  // Desk state integration
  const tape = useDesk((s) => s.tape);
  const memory = useDesk((s) => s.memory);
  const dbEvents = useDesk((s) => s.dbEvents);
  const dbSource = useDesk((s) => s.dbSource);
  const dbOk = useDesk((s) => s.dbOk);
  const dbError = useDesk((s) => s.dbError);
  const dbGrossWin = useDesk((s) => s.dbGrossWin);
  const dbGrossLoss = useDesk((s) => s.dbGrossLoss);
  const tradeLearningDbCount = useDesk((s) => s.tradeLearningDbCount);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalNote, setGlobalNote] = useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);
  const debounceRef = useRef(0);

  const runGlobalSearch = useCallback(async (q: string) => {
    const query = q.trim();
    if (query.length < 2 || useDyorStore.getState().isScanning) return;
    setGlobalBusy(true);
    try {
      const res = await searchInstruments({ data: { query } });
      const api = useDyorStore.getState();
      res.candidates.slice(0, 5).forEach((c) => api.ingestCandidate(c));
      const first = res.candidates[0];
      if (first) {
        api.setSelectedInstrument(first.id);
        api.runDeepEvaluation(first.id);
      }
      setGlobalNote(res.note);
    } catch {
      setGlobalNote("Search failed — public feeds may be rate-limited. Try again shortly.");
    } finally {
      setGlobalBusy(false);
    }
  }, []);

  // Fire automatically as the user types (debounced); the button submits now.
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    if (globalQuery.trim().length < 2) return;
    debounceRef.current = window.setTimeout(() => void runGlobalSearch(globalQuery), 600);
    return () => window.clearTimeout(debounceRef.current);
  }, [globalQuery, runGlobalSearch]);

  const refreshHistory = () => {
    setHistoryBusy(true);
    getTradeLearningEvents({ data: { limit: 200 } })
      .then((pack) => {
        useDesk.getState().setDbHistory(pack.events, useDesk.getState().dbGrossWin, useDesk.getState().dbGrossLoss);
        useDesk.getState().refreshDbStats();
      })
      .catch(() => undefined)
      .finally(() => setHistoryBusy(false));
  };

  // Modals / forms
  const [activeTab, setActiveTab] = useState<"INSTRUMENTS" | "INTEGRATIONS" | "INTELLIGENCE">("INSTRUMENTS");
  const [connectModalProvider, setConnectModalProvider] = useState<string | null>(null);
  const [profileInputHandle, setProfileInputHandle] = useState("");

  const filteredInstruments = instruments.filter((inst) => {
    if (filterStatus !== "ALL" && inst.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        inst.symbol.toLowerCase().includes(q) ||
        inst.name.toLowerCase().includes(q) ||
        inst.chain.toLowerCase().includes(q) ||
        inst.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedInst =
    instruments.find((i) => i.id === selectedInstrumentId) ??
    filteredInstruments[0] ??
    instruments[0];

  const savedCount = instruments.filter((i) => i.status === "SAVED").length;
  const blacklistedCount = instruments.filter((i) => i.status === "BLACKLISTED").length;
  const evaluatingCount = instruments.filter((i) => i.status === "EVALUATING").length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      {/* DYOR Main Mission Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">DYOR Intelligence Engine</h1>
            <span className="rounded-full border border-brass/50 bg-brass/10 px-2.5 py-0.5 text-xs font-semibold text-brass uppercase">
              Multi-Source Verification & Safety Gate
            </span>
          </div>
          <p className="mt-1 text-xs text-faint md:text-sm">
            Continuous deep research on every financial instrument the sniper interacts with. Cross-checks honeypots across multiple security engines, monitors social velocity on X & Decrypt, and automatically quarantines blacklisted contracts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={triggerGlobalScan}
            disabled={isScanning}
            className="text-xs"
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", isScanning && "animate-spin text-brass")} />
            {isScanning ? "Evaluating Markets..." : "Re-Scan All Feeds"}
          </Button>

          <Button
            variant="ghost"
            onClick={resetCatalog}
            className="text-xs text-faint hover:text-cream"
          >
            <RotateCcw className="mr-1.5 size-3.5" /> Reset Catalog
          </Button>
        </div>
      </div>

      {/* Top Level Metric Chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Card className="border-brass/40">
          <p className="text-[10px] tracking-wider text-faint uppercase">Verified Saved Universe</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-gain">{savedCount}</span>
            <span className="text-xs text-faint">Approved</span>
          </div>
          <p className="text-[11px] text-faint">Cleared all multi-engine safety gates</p>
        </Card>

        <Card className="border-loss/40">
          <p className="text-[10px] tracking-wider text-faint uppercase">Blacklisted Quarantined</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-loss">{blacklistedCount}</span>
            <span className="text-xs text-faint">Blocked</span>
          </div>
          <p className="text-[11px] text-faint">Honeypots, predatory fees & scams</p>
        </Card>

        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Active Evaluations</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-brass">{evaluatingCount}</span>
            <span className="text-xs text-faint">In Progress</span>
          </div>
          <p className="text-[11px] text-faint">Discovered on live market feeds</p>
        </Card>

        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Connected Profiles</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-cream">
              {connectedProfiles.filter((p) => p.connected).length} / {connectedProfiles.length}
            </span>
          </div>
          <p className="text-[11px] text-faint">Twitter [X], Decrypt & Feeds</p>
        </Card>

        <Card className="col-span-2 sm:col-span-4 lg:col-span-1">
          <p className="text-[10px] tracking-wider text-faint uppercase">Self-Learning Memory</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-cream">{memory.seen}</span>
            <span className="text-xs text-faint">Fills Studied</span>
          </div>
          <p className="text-[11px] text-faint">Score Floor: {memory.minScore}/100</p>
        </Card>
      </div>

      {/* Persisted trade history (database-backed learning) */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brass" />
            <Label>Persisted Trade History</Label>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                dbOk && dbSource === "neon" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                dbOk && dbSource !== "neon" && "border-line bg-panel-2 text-faint",
                !dbOk && "border-amber-500/40 bg-amber-500/10 text-amber-300",
              )}
            >
              {dbOk ? (dbSource === "neon" ? `Neon · ${tradeLearningDbCount}` : `Local DB · ${tradeLearningDbCount}`) : "DB offline"}
            </span>
          </div>
          <Button variant="ghost" onClick={refreshHistory} disabled={historyBusy} className="text-xs">
            <RefreshCw className={cn("mr-1.5 size-3.5", historyBusy && "animate-spin")} />
            {historyBusy ? "Syncing…" : "Sync from database"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-faint">
          Every simulated close is written to the database and restored on boot — this is the
          memory the bot actually learns from. Score floor {memory.minScore}/100 · Gross win $
          {dbGrossWin.toFixed(2)} · Gross loss ${dbGrossLoss.toFixed(2)}
          {!dbOk && dbError ? ` · Last error: ${dbError.slice(0, 120)}` : ""}
        </p>
        {dbEvents.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-line p-4 text-center text-xs text-faint">
            {dbOk
              ? "No persisted closes yet. Arm the bot and let it trade — each close lands here."
              : "History unavailable until the database link is healthy."}
          </p>
        ) : (
          <div className="mt-3 max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-line bg-panel text-faint uppercase">
                <tr>
                  <th className="pb-2 font-normal">Closed</th>
                  <th className="pb-2 font-normal">Symbol</th>
                  <th className="pb-2 font-normal">Reason</th>
                  <th className="pb-2 text-right font-normal">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {dbEvents.slice(0, 30).map((t) => (
                  <tr key={t.id} className="hover:bg-panel-2/50">
                    <td className="py-2 font-mono text-faint">{new Date(t.closedAt).toLocaleString()}</td>
                    <td className="py-2 font-medium text-cream">{t.symbol}</td>
                    <td className="py-2">
                      <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-faint">
                        {t.reason}
                      </span>
                    </td>
                    <td className={cn("py-2 text-right font-mono font-semibold", t.pnl >= 0 ? "text-gain" : "text-loss")}>
                      {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-line">
        <button
          onClick={() => setActiveTab("INSTRUMENTS")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition",
            activeTab === "INSTRUMENTS"
              ? "border-brass text-cream"
              : "border-transparent text-faint hover:text-cream",
          )}
        >
          <Bookmark className="size-3.5" /> Evaluated Instruments ({instruments.length})
        </button>

        <button
          onClick={() => setActiveTab("INTEGRATIONS")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition",
            activeTab === "INTEGRATIONS"
              ? "border-brass text-cream"
              : "border-transparent text-faint hover:text-cream",
          )}
        >
          <Share2 className="size-3.5" /> Social Profiles & Decrypt Integration
        </button>

        <button
          onClick={() => setActiveTab("INTELLIGENCE")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition",
            activeTab === "INTELLIGENCE"
              ? "border-brass text-cream"
              : "border-transparent text-faint hover:text-cream",
          )}
        >
          <Sparkles className="size-3.5" /> Multi-Source Pipeline & Brain Logic
        </button>
      </div>

      {/* Tab 1: Instruments Catalog & Detailed Inspector */}
      {activeTab === "INSTRUMENTS" && (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left Column: Instruments List & Filters */}
          <div className="flex flex-col gap-3 lg:col-span-5">
            {/* Universal search: any coin, token, or contract address */}
            <div className="flex flex-col gap-2 rounded-xl border border-brass/40 bg-panel p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  window.clearTimeout(debounceRef.current);
                  void runGlobalSearch(globalQuery);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute top-3 left-3 size-4 text-brass" />
                  <input
                    type="text"
                    placeholder="Search any coin, token, or paste a contract address…"
                    value={globalQuery}
                    onChange={(e) => setGlobalQuery(e.target.value)}
                    className="field h-10 w-full rounded-lg border border-line bg-panel-2 pr-3 pl-9 text-xs text-cream outline-none focus:border-brass"
                  />
                </div>
                <Button
                  type="submit"
                  variant="solid"
                  disabled={globalBusy || globalQuery.trim().length < 2}
                  className="h-10 shrink-0 px-4 text-xs font-semibold"
                >
                  <Search className={cn("mr-1.5 size-3.5", globalBusy && "animate-pulse")} />
                  {globalBusy ? "Searching…" : "Search"}
                </Button>
              </form>
              {globalNote && (
                <p className="text-[11px] text-faint" aria-live="polite">
                  {globalBusy ? "Scanning live feeds… " : ""}{globalNote}
                </p>
              )}
            </div>
            {/* Search and Filters */}
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-3">
              <div className="relative">
                <Search className="absolute top-3 left-3 size-4 text-faint" />
                <input
                  type="text"
                  placeholder="Filter by token symbol, name, address, or chain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="field h-10 w-full rounded-lg border border-line bg-panel-2 pr-3 pl-9 text-xs text-cream outline-none focus:border-brass"
                />
              </div>

              <div className="grid grid-cols-4 gap-1 pt-1 text-[11px] font-semibold">
                {(["ALL", "SAVED", "BLACKLISTED", "EVALUATING"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={cn(
                      "rounded-lg px-2 py-1.5 transition text-center",
                      filterStatus === status
                        ? "bg-brass text-ink font-bold"
                        : "bg-panel-2 text-faint hover:text-cream",
                    )}
                  >
                    {status === "ALL" && "All"}
                    {status === "SAVED" && "Saved"}
                    {status === "BLACKLISTED" && "Blocked"}
                    {status === "EVALUATING" && "Scanning"}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Instruments */}
            <div className="flex max-h-[580px] flex-col gap-2 overflow-y-auto pr-1">
              {filteredInstruments.length === 0 ? (
                <div className="rounded-xl border border-line bg-panel p-6 text-center text-xs text-faint">
                  No instruments matching the current criteria.
                </div>
              ) : (
                filteredInstruments.map((inst) => {
                  const isSelected = inst.id === selectedInst?.id;
                  const isBlacklisted = inst.status === "BLACKLISTED";
                  const isSaved = inst.status === "SAVED";

                  return (
                    <div
                      key={inst.id}
                      onClick={() => setSelectedInstrument(inst.id)}
                      className={cn(
                        "cursor-pointer rounded-xl border p-3.5 transition",
                        isSelected
                          ? "border-brass bg-brass/10"
                          : "border-line bg-panel hover:border-line/90 hover:bg-panel-2",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-cream">{inst.symbol}</span>
                            <span className="text-xs text-faint">({inst.name})</span>
                            <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase font-mono text-faint">
                              {inst.chain}
                            </span>
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-faint">
                            {inst.address.slice(0, 10)}…{inst.address.slice(-6)}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                              isSaved && "bg-gain/20 text-gain border border-gain/40",
                              isBlacklisted && "bg-loss/20 text-loss border border-loss/40",
                              inst.status === "EVALUATING" && "bg-brass/20 text-brass border border-brass/40",
                            )}
                          >
                            {inst.status}
                          </span>
                          <div className="mt-1 font-mono text-xs">
                            Safety:{" "}
                            <span
                              className={cn(
                                "font-bold",
                                inst.overallSafetyScore >= 80 && "text-gain",
                                inst.overallSafetyScore < 80 && inst.overallSafetyScore >= 50 && "text-brass",
                                inst.overallSafetyScore < 50 && "text-loss",
                              )}
                            >
                              {inst.overallSafetyScore}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {inst.autoBlacklistedReason && (
                        <div className="mt-2 rounded bg-loss/10 p-1.5 text-[11px] text-loss flex items-center gap-1.5">
                          <AlertTriangle className="size-3 shrink-0" />
                          <span className="truncate">{inst.autoBlacklistedReason}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Deep Instrument Inspector */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            {selectedInst ? (
              <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 md:p-5">
                {/* Header with Title and Action Buttons */}
                <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-cream">{selectedInst.name}</h2>
                      <span className="font-mono text-brass font-bold">(${selectedInst.symbol})</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          selectedInst.status === "SAVED" && "bg-gain/20 text-gain border border-gain/40",
                          selectedInst.status === "BLACKLISTED" && "bg-loss/20 text-loss border border-loss/40",
                          selectedInst.status === "EVALUATING" && "bg-brass/20 text-brass border border-brass/40",
                        )}
                      >
                        {selectedInst.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-faint">
                      <span>Chain: <strong className="text-cream uppercase">{selectedInst.chain}</strong></span>
                      <span>Venue: <strong className="text-cream uppercase">{selectedInst.venue}</strong></span>
                      <span className="font-mono">Address: {selectedInst.address}</span>
                    </div>
                  </div>

                  {/* Actions: Save / Blacklist / Re-evaluate */}
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedInst.status !== "SAVED" && (
                      <Button
                        variant="solid"
                        onClick={() => saveInstrument(selectedInst.id)}
                        className="bg-gain text-ink hover:bg-gain/90 text-xs font-semibold"
                      >
                        <ShieldCheck className="mr-1.5 size-3.5" /> Save Instrument
                      </Button>
                    )}

                    {selectedInst.status !== "BLACKLISTED" && (
                      <Button
                        variant="danger"
                        onClick={() => blacklistInstrument(selectedInst.id, "Flagged during manual DYOR audit")}
                        className="text-xs font-semibold"
                      >
                        <Ban className="mr-1.5 size-3.5" /> Blacklist Instrument
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      onClick={() => runDeepEvaluation(selectedInst.id)}
                      disabled={isScanning}
                      className="text-xs"
                    >
                      <RefreshCw className={cn("mr-1.5 size-3.5", isScanning && "animate-spin")} />
                      Re-Audit
                    </Button>
                  </div>
                </div>

                {/* Score Breakdown Bar */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-line bg-panel-2 p-3 font-mono text-xs">
                  <div>
                    <span className="text-faint text-[10px] uppercase font-sans">Security Score</span>
                    <p
                      className={cn(
                        "text-lg font-bold",
                        selectedInst.overallSafetyScore >= 80 ? "text-gain" : selectedInst.overallSafetyScore >= 50 ? "text-brass" : "text-loss",
                      )}
                    >
                      {selectedInst.overallSafetyScore} / 100
                    </p>
                  </div>
                  <div>
                    <span className="text-faint text-[10px] uppercase font-sans">Audit Confidence</span>
                    <p className="text-lg font-bold text-cream">{selectedInst.overallConfidence}%</p>
                  </div>
                  <div>
                    <span className="text-faint text-[10px] uppercase font-sans">Multi-Engine Sources</span>
                    <p className="text-lg font-bold text-brass">{selectedInst.honeypotMultiSource.length} Verified</p>
                  </div>
                  <div>
                    <span className="text-faint text-[10px] uppercase font-sans">Social Presence</span>
                    <p className="text-lg font-bold text-cream">{selectedInst.socialIntelligence.length} Feeds</p>
                  </div>
                </div>

                {/* Multi-Engine Honeypot & Safety Checks */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 border-b border-line pb-1.5">
                    <ShieldAlert className="size-4 text-brass" />
                    <Label>Multi-Engine Honeypot & Contract Exploitation Analysis</Label>
                  </div>

                  <div className="flex flex-col gap-2">
                    {selectedInst.honeypotMultiSource.map((check, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-lg border p-3 text-xs",
                          check.isHoneypot
                            ? "border-loss/60 bg-loss/10"
                            : "border-line bg-panel-2",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-cream">{check.source}</span>
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                              check.isHoneypot
                                ? "bg-loss text-ink"
                                : "bg-gain/20 text-gain border border-gain/40",
                            )}
                          >
                            {check.verdict}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
                          <div>Buy Tax: <strong className={check.buyTaxPct > 5 ? "text-loss" : "text-cream"}>{check.buyTaxPct}%</strong></div>
                          <div>Sell Tax: <strong className={check.sellTaxPct > 10 ? "text-loss" : "text-cream"}>{check.sellTaxPct}%</strong></div>
                          <div>LP Locked: <strong className={check.liquidityLockedPct < 50 ? "text-loss" : "text-gain"}>{check.liquidityLockedPct}%</strong></div>
                          <div>Mintable: <strong className={check.isMintable ? "text-loss" : "text-gain"}>{check.isMintable ? "YES (Warning)" : "NO"}</strong></div>
                        </div>

                        <p className="mt-2 text-faint text-[11px] font-sans">{check.details}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social Media & Decrypt News Scan */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 border-b border-line pb-1.5">
                    <Radio className="size-4 text-brass" />
                    <Label>Social Media Presence & Decrypt News Wire</Label>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedInst.socialIntelligence.map((social, idx) => (
                      <div key={idx} className="rounded-lg border border-line bg-panel-2 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {social.platform === "X_TWITTER" ? (
                              <Twitter className="size-3.5 text-[#1DA1F2]" />
                            ) : (
                              <FileText className="size-3.5 text-brass" />
                            )}
                            <span className="font-semibold text-cream">
                              {social.platform === "X_TWITTER" ? "X / Twitter Velocity" : "Decrypt Intelligence"}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                              social.sentimentLabel === "BULLISH" && "text-gain bg-gain/10",
                              social.sentimentLabel === "BEARISH" && "text-loss bg-loss/10",
                              social.sentimentLabel === "ASTROTURFED" && "text-loss bg-loss/20 border border-loss",
                              social.sentimentLabel === "NEUTRAL" && "text-faint",
                            )}
                          >
                            {social.sentimentLabel}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
                          <span>Organic Ratio: <strong>{Math.round(social.organicEngagementRatio * 100)}%</strong></span>
                          <span>Velocity: <strong>{social.mentionVelocity24h}/hr</strong></span>
                        </div>

                        <div className="mt-2 flex flex-col gap-1 border-t border-line/60 pt-2 text-[11px] text-faint font-sans">
                          {social.recentHeadlines.map((h, hIdx) => (
                            <p key={hIdx} className="line-clamp-2">
                              • {h}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real Market Liquidity & Depth Evaluations */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 border-b border-line pb-1.5">
                    <ExternalLink className="size-4 text-brass" />
                    <Label>Real Market Evaluations Across Liquidity Venues</Label>
                  </div>

                  <div className="flex flex-col gap-2">
                    {selectedInst.marketEvaluations.map((mkt, idx) => (
                      <div key={idx} className="flex flex-wrap items-center justify-between rounded-lg border border-line bg-panel-2 p-2.5 font-mono text-xs">
                        <div>
                          <span className="font-bold text-cream font-sans">{mkt.source}</span>
                          <span className="ml-2 text-faint">Price: ${mkt.priceUsd < 0.01 ? mkt.priceUsd.toFixed(6) : mkt.priceUsd.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-faint text-[11px]">
                          <span>Liq: <strong className="text-cream">${mkt.liquidityUsd.toLocaleString()}</strong></span>
                          <span>24h Vol: <strong className="text-cream">${mkt.volume24h.toLocaleString()}</strong></span>
                          <span>Regime: <strong className="text-brass">{mkt.volatilityRegime}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-line bg-panel text-xs text-faint">
                Select an instrument from the catalog to inspect.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Profile Connections & External Integrations */}
      {activeTab === "INTEGRATIONS" && (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <Label>External Social Profiles & Intelligence Integrations</Label>
                <p className="text-xs text-faint">
                  Connect your personal or bot social profiles on Twitter [X], Decrypt feeds, and Telegram channels. This gives Monroe live API access to track community sentiment, detect coordinated bot shills, and verify breaking team announcements.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {connectedProfiles.map((prof) => (
                <div
                  key={prof.id}
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-4 transition",
                    prof.connected
                      ? "border-gain/40 bg-gain/5"
                      : "border-line bg-panel-2",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-panel border border-line">
                        {prof.provider === "X_TWITTER" && <Twitter className="size-5 text-[#1DA1F2]" />}
                        {prof.provider === "DECRYPT" && <FileText className="size-5 text-brass" />}
                        {prof.provider === "TELEGRAM" && <Radio className="size-5 text-blue-400" />}
                        {prof.provider === "LUNARCRUSH" && <Sparkles className="size-5 text-purple-400" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-cream">{prof.displayName}</h3>
                        <p className="font-mono text-xs text-faint">{prof.username}</p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        prof.connected
                          ? "bg-gain/20 text-gain border border-gain/40"
                          : "bg-panel text-faint border border-line",
                      )}
                    >
                      {prof.connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-1 border-t border-line/60 pt-3 text-xs text-faint">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span>Rate Limit Budget:</span>
                      <strong className="text-cream">{prof.rateLimitRemaining} req/hr</strong>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span>Granted Scopes:</span>
                      <strong className="text-brass">{prof.scopes.length} API scopes</strong>
                    </div>
                  </div>

                  <div className="mt-4">
                    {prof.connected ? (
                      <Button
                        variant="ghost"
                        onClick={() => disconnectProfile(prof.provider)}
                        className="w-full text-xs text-loss hover:bg-loss/10 hover:text-loss border-line"
                      >
                        <Unlink className="mr-1.5 size-3.5" /> Disconnect Integration
                      </Button>
                    ) : (
                      <Button
                        variant="solid"
                        onClick={() => {
                          setConnectModalProvider(prof.provider);
                          setProfileInputHandle(prof.username || "@");
                        }}
                        className="w-full text-xs font-semibold"
                      >
                        <LinkIcon className="mr-1.5 size-3.5" /> Connect Account
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Decrypt Wire & Social Feeds Live Status */}
          <Card>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-brass" />
                <Label>Decrypt Live Market Editorial Wire Stream</Label>
              </div>
              <span className="rounded bg-gain/20 px-2 py-0.5 text-[10px] font-bold text-gain">LIVE STREAMING</span>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="rounded-lg border border-line bg-panel-2 p-3 text-xs">
                <div className="flex items-center justify-between text-[11px] text-faint">
                  <span>Source: Decrypt Breaking News API</span>
                  <span>2 mins ago</span>
                </div>
                <h4 className="mt-1 font-semibold text-cream">
                  SEC Commissioner Hints at Clearer Token Classification Guidelines for DEX Aggregators
                </h4>
                <p className="mt-1 text-faint">
                  Regulatory clarity expected for automated market maker liquidity providers and on-chain routing engines.
                </p>
              </div>

              <div className="rounded-lg border border-line bg-panel-2 p-3 text-xs">
                <div className="flex items-center justify-between text-[11px] text-faint">
                  <span>Source: Decrypt On-Chain Analysis</span>
                  <span>14 mins ago</span>
                </div>
                <h4 className="mt-1 font-semibold text-cream">
                  Solana Memecoin Deployments Surge 40%, but Over 92% Fail Honeypot Safety Audits
                </h4>
                <p className="mt-1 text-faint">
                  Independent investigation highlights the necessity of multi-source contract verification and proxy simulation before automated trade entries.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Intelligence Pipeline Architecture */}
      {activeTab === "INTELLIGENCE" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-line pb-2.5">
              <ShieldCheck className="size-4 text-brass" />
              <Label>How the Multi-Source Honeypot Gate Works</Label>
            </div>
            <p className="text-xs text-faint">
              Before placing any trade order, the sniper runs the token contract through a multi-vendor evaluation pipeline:
            </p>

            <div className="flex flex-col gap-2.5 text-xs font-mono">
              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <span className="font-bold text-cream font-sans">1. Bytecode & Static Simulation</span>
                <p className="mt-1 text-faint font-sans">
                  Tests buy/sell transactions against an isolated EVM/SVM VM to measure actual tax slippage and check whether token transfers can be frozen or blacklisted.
                </p>
              </div>

              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <span className="font-bold text-cream font-sans">2. Liquidity Lock & Ownership Timelocks</span>
                <p className="mt-1 text-faint font-sans">
                  Verifies that pool LP tokens are either burned or locked in verified escrow contracts (e.g. Unicrypt, Team Finance) for at least 60 days.
                </p>
              </div>

              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <span className="font-bold text-cream font-sans">3. Real-Time Quarantine</span>
                <p className="mt-1 text-faint font-sans">
                  If any single security engine flags the token as a honeypot or if taxes exceed 10%, the instrument is instantly blacklisted across both Demo and Live trading modes.
                </p>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-line pb-2.5">
              <Radio className="size-4 text-brass" />
              <Label>Social Sentiment & Sybil Bot Detection</Label>
            </div>
            <p className="text-xs text-faint">
              Organic community engagement vs. coordinated sybil bot farming:
            </p>

            <div className="flex flex-col gap-2.5 text-xs">
              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <span className="font-bold text-cream">Organic Engagement Threshold</span>
                <p className="mt-1 text-faint">
                  Measures account age, follower distribution, and quote-tweet variety. Projects with over 70% automated bot replies are tagged as <strong>ASTROTURFED</strong> and penalized in scoring.
                </p>
              </div>

              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <span className="font-bold text-cream">Live Tape Integration</span>
                <p className="mt-1 text-faint">
                  As the scanner discovers new pairs across Binance and DexScreener ({tape.length} pairs currently on tape), they are continuously fed into DYOR for autonomous verification.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal for connecting profile */}
      {connectModalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-cream">Connect Profile</h3>
            <p className="mt-1 text-xs text-faint">
              Authorize Monroe to stream social mentions and project velocity for your {connectModalProvider} profile.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <label htmlFor="profile-handle-input" className="text-xs font-semibold text-faint uppercase">Account Handle / API ID</label>
              <input
                id="profile-handle-input"
                type="text"
                value={profileInputHandle}
                onChange={(e) => setProfileInputHandle(e.target.value)}
                placeholder="@YourAccountHandle"
                className="field h-11 rounded-xl border border-line bg-panel-2 px-3 text-xs text-cream outline-none focus:border-brass"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConnectModalProvider(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                onClick={() => {
                  if (profileInputHandle.trim()) {
                    connectProfile(connectModalProvider as any, profileInputHandle.trim());
                  }
                  setConnectModalProvider(null);
                }}
                className="text-xs font-semibold"
              >
                Confirm Connection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
