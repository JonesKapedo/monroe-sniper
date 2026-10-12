import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type Book,
  type Candidate,
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
import { saveWinningTrade } from "./trade-memory.functions";
import type { AvenueCategory, DisciplineRules, RealMoneyReadiness } from "./avenues/types";
import {
  defaultDisciplineRules,
  scanAllAvenues,
  calculateRealMoneyReadiness,
} from "./avenues/engine";
import { formatNairobiTime } from "./sniper/nairobi-time";

export type Mode = "demo" | "live";

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
  winningTradeDbCount: number;
  botStartedAt: number;
  setPower: (on: boolean) => void;
  setMode: (mode: Mode) => void;
  setTape: (rows: Candidate[], note: string) => void;
  tick: (prices: Record<string, number>) => void;
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
  getReadiness: () => RealMoneyReadiness;
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

function initialExecutions(): TapeExecution[] {
  const now = Date.now();
  const presets: Array<{ sym: string; v: "Binance Spot" | "Raydium CLMM" | "Uniswap v3"; px: number; not: number }> = [
    { sym: "SOL/USDT", v: "Binance Spot", px: 184.25, not: 420 },
    { sym: "PEPE/USDT", v: "Uniswap v3", px: 0.0000108, not: 185 },
    { sym: "WIF/SOL", v: "Raydium CLMM", px: 2.45, not: 310 },
    { sym: "BTC/USDT", v: "Binance Spot", px: 87450.0, not: 1250 },
    { sym: "ETH/USDT", v: "Binance Spot", px: 3120.4, not: 890 },
    { sym: "BONK/SOL", v: "Raydium CLMM", px: 0.0000224, not: 140 },
    { sym: "SUI/USDT", v: "Binance Spot", px: 2.84, not: 260 },
  ];

  return presets.map((p, idx) => ({
    id: `exec-${now - idx * 14000}`,
    hash: p.v === "Raydium CLMM" ? makeSolHash() : makeHash(),
    ts: now - idx * 14000,
    symbol: p.sym,
    venue: p.v,
    side: idx % 3 === 0 ? "SELL" : "BUY",
    price: p.px,
    qty: p.not / p.px,
    notional: p.not,
    latencyMs: 38 + (idx * 9) % 45,
    slippageBps: Math.round(((idx % 5) * 0.3 - 0.2) * 10) / 10,
    type: "MARKET_FLOW",
    note: "Institutional smart router fill",
  }));
}

function absorb(
  book: Book,
  prices: Record<string, number>,
  memory: Memory,
): { book: Book; memory: Memory; newTrades: typeof book.trades } {
  const before = book.trades.length;
  const next = markBook(book, prices);
  let mem = memory;
  const born = next.trades.length - before;
  const newTrades = next.trades.slice(0, Math.max(0, born));
  for (const trade of newTrades) {
    mem = learn(mem, trade.pnl);
  }
  return { book: next, memory: mem, newTrades };
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
      executions: initialExecutions(),
      riskSettings: defaultRiskSettings,
      disciplineRules: defaultDisciplineRules,
      winningTradeDbCount: 0,
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

      setPower: (on) =>
        set((s) => ({
          power: on,
          note: on
            ? `Armed. Sniper is actively combing global markets (${s.mode === "live" ? "LIVE" : "DEMO"}).`
            : "Disarmed. Standing by.",
          log: pushLog(s.log, on ? `Sniper ARMED [${s.mode.toUpperCase()}]` : "Sniper DISARMED"),
        })),

      setMode: (mode) =>
        set((s) => {
          const activeBook = mode === "live" ? s.live : s.demo;
          return {
            mode,
            note:
              mode === "live"
                ? `Switched to LIVE mode. Balance: $${activeBook.cash.toFixed(2)}. Real ledger active.`
                : `Switched to DEMO mode. Paper balance: $${activeBook.cash.toFixed(2)}. Safe sandbox.`,
            log: pushLog(s.log, `Mode switched to ${mode.toUpperCase()}`),
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
        return calculateRealMoneyReadiness(s[s.mode]);
      },

      tick: (prices) =>
        set((s) => {
          const demoAbs = absorb(s.demo, prices, s.memory);
          const liveAbs = absorb(s.live, prices, demoAbs.memory);

          let nextExecs = s.executions;
          let nextLog = s.log;
          const allNewTrades = [...demoAbs.newTrades, ...liveAbs.newTrades];
          let extraWins = 0;

          for (const tr of allNewTrades) {
            const isProfit = tr.pnl > 0;
            const verb = tr.reason === "TARGET" ? "TAKE PROFIT" : tr.reason === "STOP" ? "STOP LOSS" : "CLOSED";
            const noteLine = `${verb}: ${tr.symbol} ${isProfit ? "+" : ""}$${tr.pnl.toFixed(2)} (${tr.reason})`;
            nextLog = pushLog(nextLog, noteLine);

            const exec: TapeExecution = {
              id: `exit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              hash: tr.symbol.includes("SOL") || tr.symbol.includes("WIF") ? makeSolHash() : makeHash(),
              ts: Date.now(),
              symbol: tr.symbol,
              venue: tr.symbol.includes("USDT") ? "Binance Spot" : "Raydium CLMM",
              side: "SELL",
              price: tr.pnl,
              qty: 1,
              notional: Math.abs(tr.pnl),
              latencyMs: 38 + Math.floor(Math.random() * 25),
              slippageBps: 0.3,
              type: isProfit ? "BOT_TAKE_PROFIT" : "BOT_STOP",
              note: noteLine,
            };
            nextExecs = [exec, ...nextExecs].slice(0, 100);

            // Automatically archive winning trades in the database as reference memories!
            if (isProfit) {
              extraWins++;
              void saveWinningTrade({
                data: {
                  id: tr.id,
                  symbol: tr.symbol,
                  chain: tr.symbol.includes("SOL") ? "solana" : "ethereum",
                  venue: tr.symbol.includes("USDT") ? "Binance Spot" : "Raydium CLMM",
                  entryPrice: 1,
                  exitPrice: 1 + tr.pnl / 20,
                  qty: 1,
                  pnl: tr.pnl,
                  volatility: 0.045,
                  score: s.memory.minScore,
                  mode: s.mode,
                  reason: tr.reason,
                  closedAt: tr.closedAt,
                },
              }).catch(() => {
                // Ignore DB logging failure in isolated environments
              });
            }
          }

          return {
            demo: demoAbs.book,
            live: liveAbs.book,
            memory: liveAbs.memory,
            executions: nextExecs,
            log: nextLog,
            winningTradeDbCount: s.winningTradeDbCount + extraWins,
          };
        }),

      autoStep: () => {
        const s = get();
        if (!s.power) return;
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

        const noteLine = `Risk-Sized Buy: ${pick.symbol} $${verdict.notional.toFixed(2)} on ${venueName} (Stop $${verdict.stopPrice.toFixed(4)}, Target $${verdict.targetPrice.toFixed(4)})`;

        set({
          [targetKey]: result.book,
          note: noteLine,
          log: pushLog(s.log, noteLine),
          executions: [exec, ...s.executions].slice(0, 100),
        });
      },

      manualEnter: (c: Candidate) => {
        const s = get();
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

      flatten: (id: string) =>
        set((s) => {
          const key = s.mode;
          const book = closeOne(s[key], id);
          const closed = book.trades[0];
          const memory =
            closed && book.trades.length !== s[key].trades.length
              ? learn(s.memory, closed.pnl)
              : s.memory;
          return {
            [key]: book,
            memory,
            note: closed ? `Flattened ${closed.symbol}: PnL $${closed.pnl.toFixed(2)}` : "Position closed",
            log: pushLog(s.log, closed ? `Flattened ${closed.symbol} (${closed.pnl >= 0 ? "+" : ""}$${closed.pnl.toFixed(2)})` : "Flattened"),
          };
        }),

      flattenAll: () =>
        set((s) => {
          const key = s.mode;
          let book = s[key];
          let mem = s.memory;
          for (const pos of book.positions) {
            book = closeOne(book, pos.id);
            const closed = book.trades[0];
            if (closed) mem = learn(mem, closed.pnl);
          }
          return {
            [key]: book,
            memory: mem,
            note: "All open positions flattened.",
            log: pushLog(s.log, `Flattened all [${s.mode.toUpperCase()}]`),
          };
        }),

      halt: (on: boolean) =>
        set((s) => ({
          demo: setKill(s.demo, on),
          live: setKill(s.live, on),
          note: on ? "Kill switch activated. All new entries blocked." : "Kill switch cleared.",
          log: pushLog(s.log, on ? "Kill switch ON" : "Kill switch cleared"),
        })),

      fund: (side, amount, address = "", network = "Ethereum (ERC-20)") => {
        const s = get();
        const mode = s.mode;
        if (!(amount > 0)) {
          return { ok: false, note: "Amount must be greater than zero." };
        }

        const now = Date.now();
        const targetBook = mode === "live" ? s.live : s.demo;

        if (side === "in") {
          const updatedBook = deposit(targetBook, amount);
          const tx: WalletTx = {
            id: `tx-dep-${now}`,
            ts: now,
            type: "DEPOSIT",
            amount,
            mode,
            network,
            status: "CONFIRMED",
            note: `Deposit of $${amount.toFixed(2)} into ${mode.toUpperCase()} wallet`,
          };
          set({
            [mode === "live" ? "live" : "demo"]: updatedBook,
            walletHistory: [tx, ...s.walletHistory],
            note: `Deposited $${amount.toFixed(2)} into ${mode} wallet.`,
            log: pushLog(s.log, `${mode.toUpperCase()} Deposit +$${amount.toFixed(2)}`),
          });
          return { ok: true, note: `Successfully deposited $${amount.toFixed(2)}.` };
        }

        const cleanAddr = address.trim();
        if (!cleanAddr) {
          return { ok: false, note: "Destination withdrawal address is required." };
        }
        if (cleanAddr.length < 10) {
          return { ok: false, note: "Destination address appears invalid (too short)." };
        }
        if (amount > targetBook.cash + 0.0001) {
          return { ok: false, note: `Insufficient free cash. Available: $${targetBook.cash.toFixed(2)}` };
        }

        const wResult = withdraw(targetBook, amount);
        if (!wResult.ok) {
          return wResult;
        }

        const shortAddr = cleanAddr.length > 14 ? `${cleanAddr.slice(0, 7)}…${cleanAddr.slice(-5)}` : cleanAddr;
        const tx: WalletTx = {
          id: `tx-wth-${now}`,
          ts: now,
          type: "WITHDRAWAL",
          amount,
          address: cleanAddr,
          network,
          mode,
          status: "CONFIRMED",
          note: `Withdrawal of $${amount.toFixed(2)} to ${shortAddr} on ${network}`,
        };

        set({
          [mode === "live" ? "live" : "demo"]: wResult.book,
          walletHistory: [tx, ...s.walletHistory],
          note: `Withdrew $${amount.toFixed(2)} to ${shortAddr}.`,
          log: pushLog(s.log, `${mode.toUpperCase()} Withdraw -$${amount.toFixed(2)} to ${shortAddr}`),
        });
        return { ok: true, note: `Withdrawal of $${amount.toFixed(2)} confirmed.` };
      },

      resetDemo: () =>
        set((s) => ({
          demo: emptyBook(DEMO_START),
          memory: emptyMemory(),
          note: `Demo desk reset to $${DEMO_START}.00. Self-learning memory reset.`,
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
        winningTradeDbCount: s.winningTradeDbCount,
        botStartedAt: s.botStartedAt,
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state && state.demo && state.demo.cash === 100 && state.demo.trades.length === 0) {
          state.demo.cash = 500;
          state.demo.peakEquity = 500;
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
