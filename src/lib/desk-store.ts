import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type Book,
  type Candidate,
  type ClosedTrade,
  type Memory,
  chooseEntry,
  closeOne,
  deposit,
  emptyBook,
  emptyMemory,
  enter,
  learn,
  markBook,
  setKill,
  withdraw,
  equity,
  DEMO_START,
} from "./paper";
import {
  evaluateRiskAndSize,
  defaultRiskSettings,
  type RiskEngineSettings,
  type SizingVerdict,
} from "./sniper/risk-engine";
import { getDbHealth, saveTradeLearning, type TradeLearningEvent } from "./trade-memory.functions";
import type { AvenueCategory, DisciplineRules, PaperReadiness } from "./avenues/types";
import {
  defaultDisciplineRules,
  scanAllAvenues,
  calculatePaperReadiness,
} from "./avenues/engine";
import { assessEdge } from "./intel/emh";

export type Mode = "demo" | "live";
export type DbSource = "neon" | "pglite" | "unknown";

export type TapeExecution = {
  id: string;
  hash: string;
  ts: number;
  symbol: string;
  venue: "Binance Spot" | "Raydium CLMM" | "Uniswap v3" | "Orca" | "PancakeSwap";
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  notional: number;
  latencyMs: number;
  slippageBps: number;
  type: "BOT_ENTRY" | "BOT_TAKE_PROFIT" | "BOT_STOP" | "MARKET_FLOW";
  note: string;
  atr?: number;
  riskReward?: number;
  avenue?: AvenueCategory;
};

export type WalletTx = {
  id: string;
  ts: number;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRADE_PNL";
  amount: number;
  address?: string;
  network?: string;
  mode: Mode;
  status: "CONFIRMED" | "PROCESSING";
  note: string;
};

type DeskState = {
  power: boolean;
  mode: Mode;
  demo: Book;
  live: Book;
  memory: Memory;
  tape: Candidate[];
  note: string;
  log: string[];
  executions: TapeExecution[];
  walletHistory: WalletTx[];
  riskSettings: RiskEngineSettings;
  disciplineRules: DisciplineRules;
  tradeLearningDbCount: number;
  dbSource: DbSource;
  dbOk: boolean;
  dbError: string | null;
  dbLastWriteAt: number | null;
  /** Most recent persisted closes (newest first) — survives local resets via the DB. */
  dbEvents: TradeLearningEvent[];
  /** Gross sums across persisted closes — profit-factor inputs for readiness. */
  dbGrossWin: number;
  dbGrossLoss: number;
  botStartedAt: number;
  restoreLearningState: (memory: Memory, storedTradeCount: number, source?: DbSource) => void;
  setDbStatus: (patch: { source?: DbSource; ok?: boolean; error?: string | null }) => void;
  setDbHistory: (events: TradeLearningEvent[], grossWin: number, grossLoss: number) => void;
  refreshDbStats: () => void;
  setPower: (on: boolean) => void;
  setMode: (mode: Mode) => void;
  setTape: (rows: Candidate[], note: string) => void;
  tick: (prices: Record<string, number>, monitorOnly?: boolean) => void;
  autoStep: () => void;
  manualEnter: (c: Candidate) => { ok: boolean; note: string; verdict?: SizingVerdict };
  flatten: (id: string) => void;
  flattenAll: () => void;
  halt: (on: boolean) => void;
  fund: (
    side: "in" | "out",
    amount: number,
    address?: string,
    network?: string,
  ) => { ok: boolean; note: string };
  resetDemo: () => void;
  setDemoBalance: (amount: number) => void;
  simulateBatchTicks: (count?: number) => void;
  updateRiskSettings: (patch: Partial<RiskEngineSettings>) => void;
  updateDisciplineRules: (patch: Partial<DisciplineRules>) => void;
  getReadiness: () => PaperReadiness;
};

function pushLog(log: string[], line: string): string[] {
  return [line, ...log].slice(0, 50);
}

function makeHash(prefix = "0x"): string {
  const chars = "0123456789abcdef";
  let str = prefix;
  for (let i = 0; i < 8; i++) str += chars[Math.floor(Math.random() * chars.length)];
  str += "…";
  for (let i = 0; i < 4; i++) str += chars[Math.floor(Math.random() * chars.length)];
  return str;
}

function makeSolHash(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let str = "Sol: ";
  for (let i = 0; i < 6; i++) str += chars[Math.floor(Math.random() * chars.length)];
  str += "…";
  for (let i = 0; i < 4; i++) str += chars[Math.floor(Math.random() * chars.length)];
  return str;
}

function venueFor(c: Candidate): "Binance Spot" | "Raydium CLMM" | "Uniswap v3" | "Orca" | "PancakeSwap" {
  if (c.venue === "binance") return "Binance Spot";
  if (c.chain === "solana") return Math.random() > 0.4 ? "Raydium CLMM" : "Orca";
  if (c.chain === "bsc") return "PancakeSwap";
  return "Uniswap v3";
}

function absorb(
  book: Book,
  prices: Record<string, number>,
  memory: Memory,
  monitorOnly = false,
): { book: Book; memory: Memory; newTrades: typeof book.trades } {
  const priorIds = new Set(book.trades.map((trade) => trade.id));
  const next = markBook(book, prices, Date.now(), !monitorOnly);
  let mem = memory;
  const newTrades = next.trades.filter((trade) => !priorIds.has(trade.id));
  for (const trade of newTrades) {
    mem = learn(mem, trade.pnl);
  }
  return { book: next, memory: mem, newTrades };
}

function archiveClosedTrades(records: Array<{ trade: ClosedTrade; mode: Mode }>): void {
  for (const { trade, mode } of records) {
    void saveTradeLearning({
      data: {
        id: trade.id,
        symbol: trade.symbol,
        chain: trade.chain ?? "unknown",
        venue: trade.venue ?? "unknown",
        entryPrice: trade.entryPrice ?? 0,
        exitPrice: trade.exitPrice ?? 0,
        qty: trade.qty ?? 0,
        pnl: trade.pnl,
        score: trade.entryScore ?? 0,
        change24h: trade.entryChange24h ?? 0,
        liquidityUsd: trade.entryLiquidityUsd ?? 0,
        volume24h: trade.entryVolume24h ?? 0,
        pairAgeHours: trade.pairAgeHours ?? null,
        mode,
        reason: trade.reason,
        openedAt: trade.openedAt ?? trade.closedAt,
        closedAt: trade.closedAt,
      },
    })
      .then(({ inserted, state }) => {
        if (inserted) {
          const event: TradeLearningEvent = {
            id: trade.id,
            symbol: trade.symbol,
            chain: trade.chain ?? "unknown",
            venue: typeof trade.venue === "string" ? trade.venue : "unknown",
            entryPrice: trade.entryPrice ?? 0,
            exitPrice: trade.exitPrice ?? 0,
            qty: trade.qty ?? 0,
            pnl: trade.pnl,
            score: trade.entryScore ?? 0,
            mode,
            reason: trade.reason,
            openedAt: trade.openedAt ?? trade.closedAt,
            closedAt: trade.closedAt,
          };
          useDesk.setState((prev) => ({
            tradeLearningDbCount: state.seen,
            // The database is the shared source of truth for the adaptive
            // floor: adopt its aggregate so local + Neon never diverge.
            memory: {
              seen: state.seen,
              wins: state.wins,
              losses: state.losses,
              realized: state.realized,
              minScore: state.minScore,
            },
            dbEvents: [event, ...prev.dbEvents].slice(0, 200),
            dbGrossWin: prev.dbGrossWin + (trade.pnl > 0 ? trade.pnl : 0),
            dbGrossLoss: prev.dbGrossLoss + (trade.pnl < 0 ? -trade.pnl : 0),
            dbSource: state.dbSource,
            dbOk: true,
            dbError: null,
            dbLastWriteAt: Date.now(),
          }));
          // Reconcile gross sums with the server (cheap, closes are infrequent).
          void getDbHealth().then((health) => {
            if (!health.ok) return;
            useDesk.setState({
              dbGrossWin: health.grossWin,
              dbGrossLoss: health.grossLoss,
              tradeLearningDbCount: health.events,
            });
          }).catch(() => undefined);
        } else {
          // Duplicate id: row already counted, just mark the link healthy.
          useDesk.setState((prev) => ({
            dbSource: state.dbSource,
            dbOk: true,
            dbError: null,
            dbLastWriteAt: prev.dbLastWriteAt ?? Date.now(),
          }));
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[trade-learning] Failed to persist a closed trade:", error);
        useDesk.setState((state) => ({
          note: "Trade closed, but its learning record could not be saved. Check the database link.",
          log: pushLog(state.log, `Trade learning save failed: ${trade.symbol} (${message.slice(0, 120)})`),
          dbOk: false,
          dbError: message.slice(0, 300),
        }));
      });
  }
}

export const useDesk = create<DeskState>()(
  persist(
    (set, get) => ({
      power: false,
      mode: "demo",
      demo: emptyBook(DEMO_START),
      live: emptyBook(0),
      memory: emptyMemory(),
      tape: [],
      note: `Paper trading sandbox active ($${DEMO_START}). Arm power to auto-snipe.`,
      log: [`System initialized. Demo balance: $${DEMO_START}.00`, "Risk engine active: Volatility-adjusted ATR sizing"],
      executions: [],
      riskSettings: defaultRiskSettings,
      disciplineRules: defaultDisciplineRules,
      tradeLearningDbCount: 0,
      dbSource: "unknown",
      dbOk: false,
      dbError: null,
      dbLastWriteAt: null,
      dbEvents: [],
      dbGrossWin: 0,
      dbGrossLoss: 0,
      botStartedAt: Date.now() - 3600000,
      walletHistory: [
        {
          id: "tx-init-demo",
          ts: Date.now() - 3600000,
          type: "DEPOSIT",
          amount: DEMO_START,
          mode: "demo",
          status: "CONFIRMED",
          note: `Demo desk opening grant: $${DEMO_START}.00 USD`,
        },
      ],

      restoreLearningState: (memory, storedTradeCount, source = "unknown") =>
        set({
          memory,
          tradeLearningDbCount: storedTradeCount,
          dbSource: source,
          dbOk: true,
          dbError: null,
        }),

      setDbStatus: (patch) =>
        set((s) => ({
          dbSource: patch.source ?? s.dbSource,
          dbOk: patch.ok ?? s.dbOk,
          dbError: patch.error !== undefined ? patch.error : s.dbError,
        })),

      setDbHistory: (events, grossWin, grossLoss) =>
        set((s) => ({
          dbEvents: events.slice(0, 200),
          dbGrossWin: grossWin,
          dbGrossLoss: grossLoss,
          tradeLearningDbCount: Math.max(s.tradeLearningDbCount, events.length),
        })),

      refreshDbStats: () => {
        void getDbHealth().then((health) => {
          if (!health.ok || !health.state) {
            get().setDbStatus({
              source: health.source,
              ok: false,
              error: health.error,
            });
            return;
          }
          set({
            dbSource: health.source,
            dbOk: true,
            dbError: null,
            dbGrossWin: health.grossWin,
            dbGrossLoss: health.grossLoss,
            tradeLearningDbCount: health.events,
          });
        }).catch(() => undefined);
      },

      setPower: (on) =>
        set((s) => ({
          power: s.mode === "live" ? false : on,
          note: on
            ? s.mode === "live"
              ? "Live execution is unavailable. The desk only supports paper simulation."
              : "Armed. Sniper is actively scanning simulated markets."
            : s.demo.positions.length
              ? "Standby. Automated entries and exits are paused; open paper positions remain held."
              : "Standby. Automated trading is paused.",
          log: pushLog(
            s.log,
            on && s.mode !== "live" ? "Sniper ARMED [DEMO]" : on ? "Live execution blocked" : "Sniper DISARMED",
          ),
        })),

      setMode: (mode) =>
        set((s) => {
          if (mode === "live") {
            return {
              mode: "demo",
              power: false,
              note: "Live execution is unavailable. No broker is connected; this desk is simulation-only.",
              log: pushLog(s.log, "Live mode blocked: no broker execution integration"),
            };
          }
          return {
            mode,
            power: mode === "demo" ? s.power : false,
            note: `Switched to paper simulation. Balance: $${s.demo.cash.toFixed(2)}.`,
            log: pushLog(s.log, "Mode switched to DEMO"),
          };
        }),

      setTape: (rows, note) => {
        set({ tape: rows, note });
        // Automatically feed top discovered candidate instruments into DYOR evaluation engine
        if (typeof window !== "undefined" && rows.length > 0) {
          try {
            import("./dyor/store").then(({ useDyorStore }) => {
              const ingest = useDyorStore.getState().ingestCandidate;
              rows.slice(0, 5).forEach((cand) => ingest(cand));
            });
          } catch {
            // Ignore in SSR
          }
        }
      },

      updateRiskSettings: (patch) =>
        set((s) => ({
          riskSettings: { ...s.riskSettings, ...patch },
          log: pushLog(s.log, "Risk parameters updated"),
        })),

      updateDisciplineRules: (patch) =>
        set((s) => ({
          disciplineRules: { ...s.disciplineRules, ...patch },
          log: pushLog(s.log, "Discipline parameters updated"),
        })),

      getReadiness: () => {
        const s = get();
        const book = s[s.mode];
        // Merge persisted closes with local ones (dedupe by id): a cleared
        // browser or a fresh device still counts the database's history, so
        // every close keeps moving the readiness bar.
        const seenIds = new Set(book.trades.map((t) => t.id));
        const history = [
          ...book.trades.map((t) => ({ pnl: t.pnl })),
          ...s.dbEvents.filter((e) => !seenIds.has(e.id)).map((e) => ({ pnl: e.pnl })),
        ];
        return calculatePaperReadiness(book, history);
      },

      tick: (prices, monitorOnly = false) => {
        const s = get();
        const demoAbs = absorb(s.demo, prices, s.memory, monitorOnly);
        const liveAbs = absorb(s.live, prices, demoAbs.memory, monitorOnly);
        const closedTrades = [
          ...demoAbs.newTrades.map((trade) => ({ trade, mode: "demo" as const })),
          ...liveAbs.newTrades.map((trade) => ({ trade, mode: "live" as const })),
        ];
        let nextExecs = s.executions;
        let nextLog = s.log;

        for (const { trade, mode } of closedTrades) {
          const isProfit = trade.pnl > 0;
          const verb =
            trade.reason === "TARGET" ? "TAKE PROFIT" : trade.reason === "STOP" ? "STOP LOSS" : "CLOSED";
          const noteLine = `${verb}: ${trade.symbol} ${isProfit ? "+" : ""}$${trade.pnl.toFixed(2)} (${trade.reason})`;
          nextLog = pushLog(nextLog, noteLine);

          const exec: TapeExecution = {
            id: `exit-${trade.closedAt}-${Math.random().toString(36).slice(2, 6)}`,
            hash: trade.symbol.includes("SOL") || trade.symbol.includes("WIF") ? makeSolHash() : makeHash(),
            ts: trade.closedAt,
            symbol: trade.symbol,
            venue: trade.symbol.includes("USDT") ? "Binance Spot" : "Raydium CLMM",
            side: "SELL",
            price: trade.exitPrice ?? 0,
            qty: trade.qty ?? 0,
            notional: Math.abs(trade.pnl),
            latencyMs: 38 + Math.floor(Math.random() * 25),
            slippageBps: 0.3,
            type: isProfit ? "BOT_TAKE_PROFIT" : "BOT_STOP",
            note: `[${mode.toUpperCase()}] ${noteLine}`,
          };
          nextExecs = [exec, ...nextExecs].slice(0, 100);
        }

        set({
          demo: demoAbs.book,
          live: liveAbs.book,
          memory: liveAbs.memory,
          executions: nextExecs,
          log: nextLog,
        });
        archiveClosedTrades(closedTrades);
      },

      autoStep: () => {
        const s = get();
        if (!s.power || s.mode !== "demo") return;
        const targetKey = s.mode;
        const currentBook = s[targetKey];
        if (currentBook.positions.length >= s.riskSettings.maxPositions) return;

        // Capital Discipline: Daily Drawdown Circuit Breaker
        const currentEq = equity(currentBook);
        const peak = Math.max(currentBook.peakEquity, currentEq);
        const currentDd = peak > 0 ? (peak - currentEq) / peak : 0;
        if (currentDd >= s.disciplineRules.maxDailyDrawdownPct) {
          return; // Intraday loss limit circuit breaker triggers
        }

        // 1. Check all money-making avenues (Perps, Arbitrage, Early IPOs, Yield Basis)
        const avenues = scanAllAvenues(currentBook, s.disciplineRules);
        const unheldAvenue = avenues.find(
          (a) =>
            !currentBook.positions.some((p) => p.tokenId === a.id) &&
            a.disciplineApproved &&
            a.confidenceScore >= 80,
        );

        // If an avenue setup is available, execute with disciplined parameters
        if (unheldAvenue && Math.random() > 0.35) {
          const aveCand: Candidate = {
            id: unheldAvenue.id,
            symbol: unheldAvenue.symbol,
            name: unheldAvenue.symbol,
            address: unheldAvenue.id,
            chain: unheldAvenue.chain,
            venue: unheldAvenue.venueA.toLowerCase().includes("binance") ? "binance" : "dex",
            priceUsd: unheldAvenue.priceA,
            change24h:
              (unheldAvenue.grossSpreadPct ?? 2.5) *
              (unheldAvenue.perpSide === "SHORT" ? -1 : 1),
            volume24h: 850_000,
            liquidityUsd: 420_000,
            score: unheldAvenue.confidenceScore,
            pairAgeHours: 24,
            url: null,
            flags: [],
            rationale: [unheldAvenue.title, ...(unheldAvenue.disciplineNotes ?? [])],
          };

          const verdict = evaluateRiskAndSize(
            currentBook,
            aveCand,
            s.riskSettings,
            s.memory.minScore,
            Date.now(),
          );

          if (verdict.allowed && verdict.notional > 0) {
            const notional = Math.min(verdict.notional, unheldAvenue.maxCapitalAllocationUsd);
            const result = enter(currentBook, aveCand, Date.now(), s.memory.minScore, {
              notional,
              stop: unheldAvenue.stopLossPrice,
              target: unheldAvenue.targetPrice,
            });

            if (result.ok) {
              const hashStr = unheldAvenue.chain === "solana" ? makeSolHash() : makeHash();
              const exec: TapeExecution = {
                id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                hash: hashStr,
                ts: Date.now(),
                symbol: unheldAvenue.symbol,
                venue: (unheldAvenue.venueA.includes("Binance") ? "Binance Spot" : "Raydium CLMM") as any,
                side: unheldAvenue.perpSide === "SHORT" ? "SELL" : "BUY",
                price: unheldAvenue.priceA,
                qty: notional / unheldAvenue.priceA,
                notional,
                latencyMs: 28,
                slippageBps: 0.2,
                type: "BOT_ENTRY",
                avenue: unheldAvenue.category,
                note: `[${unheldAvenue.category}] ${unheldAvenue.title} · Sized $${notional.toFixed(2)} (R:R ${unheldAvenue.riskRewardRatio}R)`,
                atr: unheldAvenue.estimatedAtrPct,
                riskReward: unheldAvenue.riskRewardRatio,
              };

              const noteLine = `[${unheldAvenue.category}] Disciplined Sizing: ${unheldAvenue.symbol} $${notional.toFixed(2)} on ${unheldAvenue.venueA} (Stop $${unheldAvenue.stopLossPrice.toFixed(4)}, Target $${unheldAvenue.targetPrice.toFixed(4)})`;

              set({
                [targetKey]: result.book,
                note: noteLine,
                log: pushLog(s.log, noteLine),
                executions: [exec, ...s.executions].slice(0, 100),
              });
              return;
            }
          }
        }

        // 2. Otherwise pick from market tape
        const pick = chooseEntry(currentBook, s.tape, s.memory.minScore);
        if (!pick) return;

        // Run through the quantitative risk engine
        const verdict = evaluateRiskAndSize(
          currentBook,
          pick,
          s.riskSettings,
          s.memory.minScore,
          Date.now(),
        );

        if (!verdict.allowed || verdict.notional <= 0) return;

        // Execute with risk-engine volatility-adjusted sizing and brackets
        const result = enter(currentBook, pick, Date.now(), s.memory.minScore, {
          notional: verdict.notional,
          stop: verdict.stopPrice,
          target: verdict.targetPrice,
        });

        if (!result.ok) return;

        const venueName = venueFor(pick);
        const hashStr = pick.chain === "solana" ? makeSolHash() : makeHash();
        const latency = 32 + Math.floor(Math.random() * 40);

        const exec: TapeExecution = {
          id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hash: hashStr,
          ts: Date.now(),
          symbol: pick.symbol,
          venue: venueName,
          side: "BUY",
          price: pick.priceUsd,
          qty: verdict.qty,
          notional: verdict.notional,
          latencyMs: latency,
          slippageBps: 0.4,
          type: "BOT_ENTRY",
          avenue: "SPOT_MOMENTUM",
          note: `Sniper BUY ${pick.symbol} · Vol Sized $${verdict.notional.toFixed(2)} (ATR ${(verdict.atr * 100).toFixed(2)}%, R:R ${verdict.riskRewardRatio}R)`,
          atr: verdict.atr,
          riskReward: verdict.riskRewardRatio,
        };

        const edge = assessEdge(pick);
        const noteLine = `${edge.stance === "EARLY" ? "Early position" : "Risk-sized buy"}: ${pick.symbol} $${verdict.notional.toFixed(2)} on ${venueName}. ${edge.why}`;

        set({
          [targetKey]: result.book,
          note: noteLine,
          log: pushLog(s.log, noteLine),
          executions: [exec, ...s.executions].slice(0, 100),
        });
      },

      manualEnter: (c: Candidate) => {
        const s = get();
        if (s.mode !== "demo") {
          return { ok: false, note: "Live execution is unavailable; this desk only supports paper simulation." };
        }
        const targetKey = s.mode;
        const currentBook = s[targetKey];

        // Evaluate sizing with risk engine
        const verdict = evaluateRiskAndSize(
          currentBook,
          c,
          s.riskSettings,
          Math.min(s.memory.minScore, c.score),
          Date.now(),
        );

        const notional = verdict.allowed ? verdict.notional : 20;
        const result = enter(currentBook, c, Date.now(), Math.min(s.memory.minScore, c.score), {
          notional,
          stop: verdict.stopPrice,
          target: verdict.targetPrice,
        });

        if (!result.ok) {
          return { ok: false, note: result.note, verdict };
        }

        const venueName = venueFor(c);
        const exec: TapeExecution = {
          id: `manual-${Date.now()}`,
          hash: c.chain === "solana" ? makeSolHash() : makeHash(),
          ts: Date.now(),
          symbol: c.symbol,
          venue: venueName,
          side: "BUY",
          price: c.priceUsd,
          qty: notional / c.priceUsd,
          notional,
          latencyMs: 35,
          slippageBps: 0.5,
          type: "BOT_ENTRY",
          note: `Manual Snipe ${c.symbol} · Sized $${notional.toFixed(2)} [${s.mode.toUpperCase()}]`,
          atr: verdict.atr,
          riskReward: verdict.riskRewardRatio,
        };

        const note = `Filled ${c.symbol} $${notional.toFixed(2)} [${s.mode.toUpperCase()}]`;
        set({
          [targetKey]: result.book,
          note,
          log: pushLog(s.log, note),
          executions: [exec, ...s.executions].slice(0, 100),
        });
        return { ok: true, note, verdict };
      },

      flatten: (id: string) => {
        const s = get();
        const mode = s.mode;
        const book = closeOne(s[mode], id);
        const didClose = book.positions.length < s[mode].positions.length;
        const closed = didClose ? book.trades[0] : undefined;
        const memory = didClose && closed ? learn(s.memory, closed.pnl) : s.memory;
        set({
          [mode]: book,
          memory,
          note: didClose && closed ? `Flattened ${closed.symbol}: PnL $${closed.pnl.toFixed(2)}` : "Position closed",
          log: pushLog(
            s.log,
            didClose && closed
              ? `Flattened ${closed.symbol} (${closed.pnl >= 0 ? "+" : ""}$${closed.pnl.toFixed(2)})`
              : "Flattened",
          ),
        });
        if (didClose && closed) archiveClosedTrades([{ trade: closed, mode }]);
      },

      flattenAll: () => {
        const s = get();
        const mode = s.mode;
        let book = s[mode];
        let memory = s.memory;
        const closedTrades: ClosedTrade[] = [];
        for (const position of [...book.positions]) {
          book = closeOne(book, position.id);
          const closed = book.trades[0];
          if (closed) {
            closedTrades.push(closed);
            memory = learn(memory, closed.pnl);
          }
        }
        set({
          [mode]: book,
          memory,
          note: "All open paper positions flattened.",
          log: pushLog(s.log, `Flattened all [${mode.toUpperCase()}]`),
        });
        archiveClosedTrades(closedTrades.map((trade) => ({ trade, mode })));
      },

      halt: (on: boolean) =>
        set((s) => ({
          demo: setKill(s.demo, on),
          live: setKill(s.live, on),
          note: on ? "Kill switch activated. All new entries blocked." : "Kill switch cleared.",
          log: pushLog(s.log, on ? "Kill switch ON" : "Kill switch cleared"),
        })),

      fund: (side, amount) => {
        const s = get();
        if (s.mode === "live") {
          return {
            ok: false,
            note: "External deposits and withdrawals are unavailable; this app has no connected broker or funds rail.",
          };
        }
        if (!(amount > 0)) {
          return { ok: false, note: "Amount must be greater than zero." };
        }

        const now = Date.now();
        const targetBook = s.demo;

        if (side === "in") {
          const updatedBook = deposit(targetBook, amount);
          const tx: WalletTx = {
            id: `tx-dep-${now}`,
            ts: now,
            type: "DEPOSIT",
            amount,
            mode: "demo",
            network: "Paper simulation",
            status: "CONFIRMED",
            note: `Paper balance increased by $${amount.toFixed(2)}.`,
          };
          set({
            demo: updatedBook,
            walletHistory: [tx, ...s.walletHistory],
            note: `Added $${amount.toFixed(2)} to the paper balance.`,
            log: pushLog(s.log, `Paper balance +$${amount.toFixed(2)}`),
          });
          return { ok: true, note: `Added $${amount.toFixed(2)} to the paper balance.` };
        }

        if (amount > targetBook.cash + 0.0001) {
          return { ok: false, note: `Insufficient free cash. Available: $${targetBook.cash.toFixed(2)}` };
        }

        const wResult = withdraw(targetBook, amount);
        if (!wResult.ok) {
          return wResult;
        }

        const tx: WalletTx = {
          id: `tx-wth-${now}`,
          ts: now,
          type: "WITHDRAWAL",
          amount,
          mode: "demo",
          network: "Paper simulation",
          status: "CONFIRMED",
          note: `Paper balance decreased by $${amount.toFixed(2)}.`,
        };

        set({
          demo: wResult.book,
          walletHistory: [tx, ...s.walletHistory],
          note: `Removed $${amount.toFixed(2)} from the paper balance.`,
          log: pushLog(s.log, `Paper balance -$${amount.toFixed(2)}`),
        });
        return { ok: true, note: `Removed $${amount.toFixed(2)} from the paper balance.` };
      },

      resetDemo: () =>
        set((s) => ({
          demo: emptyBook(DEMO_START),
          note: `Paper ledger reset to $${DEMO_START}.00. Archived trade learning remains intact.`,
          log: pushLog(s.log, `Demo reset to $${DEMO_START}.00`),
        })),

      setDemoBalance: (amount: number) =>
        set((s) => {
          const val = Math.max(50, amount);
          return {
            demo: emptyBook(val),
            note: `Demo desk capital rebalanced to $${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}. Dynamic sweet-spot sizing active.`,
            log: pushLog(s.log, `Demo balance rebalanced to $${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}`),
          };
        }),

      simulateBatchTicks: (count = 5) => {
        if (!get().power || get().mode !== "demo") return;
        for (let i = 0; i < count; i++) {
          const s = get();
          const targetKey = s.mode;
          const currentBook = s[targetKey];
          const prices: Record<string, number> = {};
          currentBook.positions.forEach((p) => {
            // Skew slightly positive for disciplined setups (win rate ~65%)
            const drift = Math.random() > 0.35 ? 1 + (0.015 + Math.random() * 0.035) : 1 - (0.012 + Math.random() * 0.025);
            prices[p.tokenId] = Math.max(0.000001, p.mark * drift);
          });
          s.tape.forEach((c) => {
            const drift = 1 + (Math.random() - 0.47) * 0.03;
            prices[c.id] = Math.max(0.000001, c.priceUsd * drift);
          });
          get().tick(prices);
          if (get().power) {
            get().autoStep();
          }
        }
      },
    }),
    {
      name: "monroe-sniper-v4",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
          : localStorage,
      ),
      partialize: (s) => ({
        power: s.power,
        mode: s.mode,
        demo: s.demo,
        live: s.live,
        memory: s.memory,
        log: s.log,
        walletHistory: s.walletHistory,
        riskSettings: s.riskSettings,
        disciplineRules: s.disciplineRules,
        tradeLearningDbCount: s.tradeLearningDbCount,
        dbSource: s.dbSource,
        dbLastWriteAt: s.dbLastWriteAt,
        dbGrossWin: s.dbGrossWin,
        dbGrossLoss: s.dbGrossLoss,
        botStartedAt: s.botStartedAt,
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.mode = "demo";
          // Never disarm on refresh: the persisted power switch is the
          // owner's intent. The loop in Frame resumes auto-stepping.
          if (typeof state.power !== "boolean") state.power = false;
          if (state.demo && state.demo.cash === 100 && state.demo.trades.length === 0) {
            state.demo.cash = DEMO_START;
            state.demo.peakEquity = DEMO_START;
          }
        }
      },
    },
  ),
);

/** Helper hook returning the active book based on whether mode is live or demo */
export function useActiveBook(): Book {
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  return mode === "live" ? live : demo;
}

export function useActiveEquity(): number {
  const book = useActiveBook();
  return equity(book);
}
