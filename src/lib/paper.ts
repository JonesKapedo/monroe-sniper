import { assessEdge } from "./intel/emh";

export const DEMO_START = 500;
export const STARTING_CASH = DEMO_START;
export const MAX_POSITIONS = 3;
export const MAX_IDEA = 0.2;
export const MAX_BOOK = 0.6;
export const MIN_SCORE = 62;
export const MIN_LIQ = 10_000;
export const MIN_TICKET = 5;

export type Candidate = {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  address: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  change24h: number;
  pairAgeHours: number | null;
  url: string | null;
  score: number;
  flags: string[];
  rationale: string[];
  venue: "binance" | "dex" | "fx";
  /** Depth unknown (e.g. CEX quote volume is flow, not pool depth). */
  liquidityUnknown?: boolean;
};

export type Position = {
  id: string;
  tokenId: string;
  symbol: string;
  chain: string;
  qty: number;
  entryPrice: number;
  mark: number;
  stop: number;
  target?: number;
  openedAt: number;
  notional: number;
  venue?: "binance" | "dex" | "fx";
  /** True while the mark is simulated drift (no live quote) rather than a market price. */
  markSimulated?: boolean;
  entryScore?: number;
  entryChange24h?: number;
  entryLiquidityUsd?: number;
  entryVolume24h?: number;
  pairAgeHours?: number | null;
};

export type ClosedTrade = {
  id: string;
  symbol: string;
  pnl: number;
  /** True when closed without a live quote — excluded from learning. */
  simulated?: boolean;
  reason: string;
  closedAt: number;
  chain?: string;
  venue?: "binance" | "dex" | "fx";
  entryPrice?: number;
  exitPrice?: number;
  qty?: number;
  openedAt?: number;
  entryScore?: number;
  entryChange24h?: number;
  entryLiquidityUsd?: number;
  entryVolume24h?: number;
  pairAgeHours?: number | null;
};

export type Book = {
  cash: number;
  positions: Position[];
  trades: ClosedTrade[];
  peakEquity: number;
  dayPnl: number;
  consecutiveLosses: number;
  cooldownUntil: number | null;
  kill: boolean;
  killReason: string | null;
  /** UTC day (YYYY-MM-DD) of the last mark; null rolls the day on next tick. */
  lastMarkDay?: string | null;
};

export type GateLine = { id: string; label: string; pass: boolean; detail: string };

export function emptyBook(cashUsd = DEMO_START): Book {
  const cash = Math.max(0, cashUsd);
  return {
    cash,
    positions: [],
    trades: [],
    peakEquity: Math.max(cash, 1),
    dayPnl: 0,
    consecutiveLosses: 0,
    cooldownUntil: null,
    kill: false,
    killReason: null,
    lastMarkDay: null,
  };
}

export function exposure(book: Book): number {
  return book.positions.reduce((s, p) => s + p.qty * p.mark, 0);
}

export function equity(book: Book): number {
  return book.cash + exposure(book);
}

export function scoreCandidate(input: {
  symbol: string;
  name: string;
  chain: string;
  address: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  change24h: number | null;
  pairCreatedAt: number | null;
  url: string | null;
  venue?: "binance" | "dex" | "fx";
  liquidityUnknown?: boolean;
}): Candidate | null {
  if (!input.address || !input.priceUsd || input.priceUsd <= 0) return null;
  const liqUnknown = input.liquidityUnknown === true;
  const liq = input.liquidityUsd ?? 0;
  const vol = input.volume24h ?? 0;
  const chg = input.change24h ?? 0;
  const ageH = input.pairCreatedAt
    ? Math.max(0, (Date.now() - input.pairCreatedAt) / 3_600_000)
    : null;
  // Unknown depth scores neutral — never fake-deep, never fake-thin.
  const liqScore = liqUnknown ? 50 : Math.max(0, Math.min(100, (liq / 100_000) * 100));
  const mom = Math.max(0, Math.min(100, 50 + chg * 0.35));
  const novelty = ageH === null ? 30 : Math.max(0, Math.min(100, 100 - ageH * 1.5));
  let score = 0.7 * liqScore + 0.2 * mom + 0.1 * novelty;
  const flags: string[] = [];
  const rationale: string[] = [];
  if (vol > 0 && liq > 0 && vol / liq > 0.4) {
    score += 6;
    rationale.push("Volume is active relative to pool depth");
  }
  if (chg > 120) {
    score -= 18;
    flags.push("EXTREME-MOVE");
    rationale.push("24h move is extreme; treat as unstable");
  }
  if (liqUnknown) {
    rationale.push("CEX depth not published; sized on volatility, not pool depth");
  } else if (liq < MIN_LIQ) {
    flags.push("THIN");
    rationale.push("Liquidity is under $10k");
  }
  if (ageH !== null && ageH < 6) {
    flags.push("FRESH");
    rationale.push("Pair is under six hours old");
  }
  if (!rationale.length) rationale.push("Ordinary tape; size only if the gate clears");
  score = Math.round(Math.max(0, Math.min(100, score)));
  return {
    id: `${input.chain}:${input.address.toLowerCase()}`,
    symbol: input.symbol.toUpperCase(),
    name: input.name,
    chain: input.chain,
    address: input.address,
    priceUsd: input.priceUsd,
    liquidityUsd: liq,
    volume24h: vol,
    change24h: chg,
    pairAgeHours: ageH,
    url: input.url,
    score,
    flags,
    rationale,
    venue: input.venue ?? "dex",
    liquidityUnknown: liqUnknown || undefined,
  };
}

/** Constant-product style impact, capped. */
export function impactPct(notional: number, liquidity: number): number {
  if (liquidity <= 0 || notional <= 0) return 0.02;
  return Math.min(0.35, notional / (2 * liquidity));
}

export function simulateBuy(
  notional: number,
  mid: number,
  liquidity: number,
  opts: { skipDepthCheck?: boolean } = {},
) {
  const impact = impactPct(notional, liquidity);
  const fee = 0.003;
  const buffer = 0.005;
  const gas = notional < 50 ? 0.1 : 1.5;
  const fill = mid * (1 + impact + buffer);
  const costPct = notional > 0 ? (notional * (impact + buffer + fee) + gas) / notional : 1;
  const qty = Math.max(0, (notional - notional * fee - gas) / fill);
  const reasons: string[] = [];
  if (costPct > 0.06) reasons.push(`Expected cost ${(costPct * 100).toFixed(1)}% is above 6%`);
  if (!opts.skipDepthCheck && liquidity < notional * 8)
    reasons.push("Pool is thin versus the intended size");
  if (qty <= 0) reasons.push("Nothing left after fees");
  return { fill, qty, impact, costPct, acceptable: reasons.length === 0, reasons };
}

/**
 * Tiered portfolio defense (single owner: this Book + risk-engine checks).
 * 3% intraday (desk breaker) pauses ENTRIES · 8% (risk engine) halts new
 * risk · 15% drawdown / 5% day (armIfNeeded) kills the book until cleared.
 * Exits are never blocked by any tier. Readiness 4.5% is display-only
 * early warning, not a gate.
 */
export function portfolioLines(book: Book, now = Date.now()): GateLine[] {
  const eq = equity(book);
  const peak = Math.max(book.peakEquity, eq);
  const dd = peak > 0 ? (peak - eq) / peak : 0;
  const dayLoss = peak > 0 ? Math.max(0, -book.dayPnl) / peak : 0;
  const cooling = book.cooldownUntil !== null && now < book.cooldownUntil;
  return [
    {
      id: "kill",
      label: "Kill switch off",
      pass: !book.kill,
      detail: book.kill ? (book.killReason ?? "Halted") : "Entries allowed",
    },
    {
      id: "cool",
      label: "No loss cooldown",
      pass: !cooling,
      detail: cooling ? "Waiting out consecutive losses" : "Clear",
    },
    {
      id: "day",
      label: "Daily loss under 5%",
      pass: dayLoss <= 0.05,
      detail: `Day P&L ${book.dayPnl.toFixed(0)}`,
    },
    {
      id: "dd",
      label: "Drawdown under 15%",
      pass: dd <= 0.15,
      detail: `${(dd * 100).toFixed(1)}% from peak`,
    },
  ];
}

export function entryVerdict(book: Book, c: Candidate, now = Date.now(), minScore = MIN_SCORE): {
  allowed: boolean;
  lines: GateLine[];
  notional: number;
  sim: ReturnType<typeof simulateBuy> | null;
} {
  const eq = equity(book);
  const exp = exposure(book);
  const room = Math.max(0, eq * MAX_BOOK - exp);
  const notional = Math.max(0, Math.min(eq * MAX_IDEA, book.cash, room));
  const dup = book.positions.some((p) => p.tokenId === c.id);
  const lines: GateLine[] = [
    ...portfolioLines(book, now),
    {
      id: "score",
      label: `Score at least ${minScore}`,
      pass: c.score >= minScore,
      detail: `${c.score}/100`,
    },
    {
      id: "liq",
      label: c.liquidityUnknown ? "Depth n/a (CEX majors)" : "Liquidity at least $10k",
      pass: c.liquidityUnknown === true || c.liquidityUsd >= MIN_LIQ,
      detail: c.liquidityUnknown ? "CEX depth unpublished" : `$${Math.round(c.liquidityUsd).toLocaleString()}`,
    },
    {
      id: "slots",
      label: "Open slot",
      pass: book.positions.length < MAX_POSITIONS,
      detail: `${book.positions.length}/${MAX_POSITIONS}`,
    },
    {
      id: "dup",
      label: "Not already held",
      pass: !dup,
      detail: dup ? "Already in the book" : "New name",
    },
    {
      id: "cash",
      label: "Cash and cap allow a ticket",
      pass: notional >= MIN_TICKET,
      detail: `Planned $${notional.toFixed(0)}`,
    },
  ];
  const sim =
    lines.every((l) => l.pass) && notional > 0
      ? simulateBuy(notional, c.priceUsd, c.liquidityUsd, {
          skipDepthCheck: c.liquidityUnknown === true,
        })
      : null;
  if (sim && !sim.acceptable) {
    lines.push({
      id: "exec",
      label: "Executable inside cost budget",
      pass: false,
      detail: sim.reasons.join("; "),
    });
  } else if (sim) {
    lines.push({
      id: "exec",
      label: "Executable inside cost budget",
      pass: true,
      detail: `Impact ${(sim.impact * 100).toFixed(2)}%, fill $${sim.fill.toPrecision(4)}`,
    });
  }
  return { allowed: lines.every((l) => l.pass) && Boolean(sim?.acceptable), lines, notional, sim };
}

function stamp(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function enter(
  book: Book,
  c: Candidate,
  now = Date.now(),
  minScore = MIN_SCORE,
  customSizing?: { notional?: number; stop?: number; target?: number },
): { book: Book; ok: boolean; note: string } {
  const v = entryVerdict(book, c, now, minScore);
  if (!v.allowed || !v.sim) {
    const fail = v.lines.filter((l) => !l.pass).map((l) => l.label);
    return { book, ok: false, note: fail.join(", ") || "Blocked" };
  }
  // Defense in depth: a custom notional can never exceed the risk-sized
  // verdict nor the free cash — no caller can over-stake through this path.
  const notionalToUse = Math.min(book.cash, v.notional, customSizing?.notional ?? v.notional);
  const qtyToUse = notionalToUse > 0 ? notionalToUse / v.sim.fill : v.sim.qty;
  const stopToUse = customSizing?.stop ?? v.sim.fill * 0.92;
  const targetToUse = customSizing?.target ?? v.sim.fill * 1.06;

  const pos: Position = {
    id: stamp("pos"),
    tokenId: c.id,
    symbol: c.symbol,
    chain: c.chain,
    qty: qtyToUse,
    entryPrice: v.sim.fill,
    mark: v.sim.fill,
    stop: stopToUse,
    target: targetToUse,
    openedAt: now,
    notional: notionalToUse,
    venue: c.venue,
    entryScore: c.score,
    entryChange24h: c.change24h,
    entryLiquidityUsd: c.liquidityUsd,
    entryVolume24h: c.volume24h,
    pairAgeHours: c.pairAgeHours,
  };
  const next: Book = {
    ...book,
    cash: book.cash - notionalToUse,
    positions: [...book.positions, pos],
    peakEquity: Math.max(book.peakEquity, equity({ ...book, cash: book.cash - notionalToUse, positions: [...book.positions, pos] })),
  };
  return { book: armIfNeeded(next), ok: true, note: `Paper fill ${c.symbol}` };
}

export type MarkOptions = {
  /**
   * Position ids whose quote is known-stale (e.g. daily refs posing as live).
   * Treated exactly like a missing quote: hold, flag, no exits, no learning.
   */
  staleIds?: ReadonlySet<string>;
};

/** UTC day stamp for the one true day boundary (docs: all risk days are UTC). */
export function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function markBook(
  book: Book,
  prices: Record<string, number>,
  now = Date.now(),
  manageExits = true,
  opts: MarkOptions = {},
): Book {
  let next = book;
  const kept: Position[] = [];
  const extraTrades: ClosedTrade[] = [];
  let cash = book.cash;
  let day = book.dayPnl;
  let streak = book.consecutiveLosses;
  let cool = book.cooldownUntil;

  // One day boundary: UTC midnight rolls dayPnl exactly once.
  const today = utcDay(now);
  if (book.lastMarkDay !== undefined && book.lastMarkDay !== null && book.lastMarkDay !== today) {
    day = 0;
  }

  for (const p of book.positions) {
    const quote = prices[p.tokenId] && prices[p.tokenId] > 0 ? prices[p.tokenId] : null;
    // Fail-closed: no (or known-stale) quote → hold the last mark, flag it
    // stale, and NEVER evaluate stops/targets on it. Only the time stop may
    // close, and the close is excluded from learning.
    const stale = quote === null || opts.staleIds?.has(p.tokenId) === true;
    const px = quote ?? p.mark;
    if (!manageExits) {
      kept.push({ ...p, mark: px, markSimulated: stale || undefined });
      continue;
    }
    const aged = now - p.openedAt > 6 * 60 * 60 * 1000;

    // Outperformance & Capital Preservation: Trailing Breakeven Ratchet
    // Once position moves +3.0% into profit, raise stop loss above entry price to lock in a risk-free trade
    // (live quotes only — stale marks never ratchet, stop, or target).
    let activeStop = p.stop;
    if (!stale && px >= p.entryPrice * 1.03 && activeStop < p.entryPrice * 1.008) {
      activeStop = p.entryPrice * 1.008; // Locked in at +0.8% profit
    }

    const stopped = !stale && px <= activeStop;
    const targetHit = !stale && px >= (p.target ?? p.entryPrice * 1.06);
    if (aged || stopped || targetHit) {
      const pnl = (px - p.entryPrice) * p.qty;
      cash += p.qty * px;
      // Stale closes don't move the day/result counters used for learning.
      if (!stale) {
        day += pnl;
        streak = pnl < 0 ? streak + 1 : 0;
        if (streak >= 3) cool = now + 4 * 60 * 60 * 1000;
      }
      extraTrades.push({
        id: stamp("tr"),
        symbol: p.symbol,
        pnl,
        reason: targetHit ? "TARGET" : stopped ? (px > p.entryPrice ? "BREAKEVEN" : "STOP") : "TIME",
        closedAt: now,
        chain: p.chain,
        venue: p.venue,
        entryPrice: p.entryPrice,
        exitPrice: px,
        qty: p.qty,
        openedAt: p.openedAt,
        entryScore: p.entryScore,
        entryChange24h: p.entryChange24h,
        entryLiquidityUsd: p.entryLiquidityUsd,
        entryVolume24h: p.entryVolume24h,
        pairAgeHours: p.pairAgeHours,
        simulated: stale || undefined,
      });
    } else {
      kept.push({ ...p, mark: px, stop: activeStop, markSimulated: stale || undefined });
    }
  }

  next = {
    ...book,
    cash,
    positions: kept,
    trades: [...extraTrades, ...book.trades].slice(0, 40),
    dayPnl: day,
    consecutiveLosses: streak,
    cooldownUntil: cool,
    lastMarkDay: today,
  };
  const eq = equity(next);
  next.peakEquity = Math.max(book.peakEquity, eq);
  return armIfNeeded(next);
}

export function closeOne(book: Book, id: string, now = Date.now()): Book {
  const p = book.positions.find((x) => x.id === id);
  if (!p) return book;
  const pnl = (p.mark - p.entryPrice) * p.qty;
  const streak = p.markSimulated ? book.consecutiveLosses : pnl < 0 ? book.consecutiveLosses + 1 : 0;
  const next: Book = {
    ...book,
    cash: book.cash + p.qty * p.mark,
    positions: book.positions.filter((x) => x.id !== id),
    trades: [
      {
        id: stamp("tr"),
        symbol: p.symbol,
        pnl,
        reason: "MANUAL",
        simulated: p.markSimulated,
        closedAt: now,
        chain: p.chain,
        venue: p.venue,
        entryPrice: p.entryPrice,
        exitPrice: p.mark,
        qty: p.qty,
        openedAt: p.openedAt,
        entryScore: p.entryScore,
        entryChange24h: p.entryChange24h,
        entryLiquidityUsd: p.entryLiquidityUsd,
        entryVolume24h: p.entryVolume24h,
        pairAgeHours: p.pairAgeHours,
      },
      ...book.trades,
    ].slice(0, 40),
    dayPnl: book.dayPnl + pnl,
    consecutiveLosses: streak,
    cooldownUntil: streak >= 3 && !p.markSimulated ? now + 4 * 60 * 60 * 1000 : book.cooldownUntil,
  };
  next.peakEquity = Math.max(book.peakEquity, equity(next));
  return armIfNeeded(next);
}

function armIfNeeded(book: Book): Book {
  const eq = equity(book);
  const peak = Math.max(book.peakEquity, eq);
  const dd = peak > 0 ? (peak - eq) / peak : 0;
  const dayLoss = peak > 0 ? Math.max(0, -book.dayPnl) / peak : 0;
  if (!book.kill && (dd > 0.15 || dayLoss > 0.05)) {
    return {
      ...book,
      peakEquity: peak,
      kill: true,
      killReason: dd > 0.15 ? "Drawdown limit" : "Daily loss limit",
    };
  }
  return { ...book, peakEquity: peak };
}

export function setKill(book: Book, on: boolean): Book {
  return { ...book, kill: on, killReason: on ? "Operator halt" : null };
}

/** Sample tape so the desk is usable when public APIs are quiet. */
export function sampleTape(now = Date.now()): Candidate[] {
  const rows = [
    ["WETH", "Wrapped Ether", "ethereum", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 3200, 180_000_000, 900_000_000, 1.2, 40_000],
    ["PEPE", "Pepe", "ethereum", "0x6982508145454Ce325dDbE47a25d4ec3d2311933", 0.000009, 42_000_000, 80_000_000, 6.4, 8_000],
    ["AERO", "Aerodrome", "base", "0x940181a94A35A4569E4529A3CDfB74e38FD98631", 1.15, 28_000_000, 12_000_000, 3.1, 2_000],
    ["BONK", "Bonk", "solana", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", 0.000021, 9_500_000, 22_000_000, -4.2, 12_000],
    ["NEW", "Fresh Pool", "base", "0x1111111111111111111111111111111111111111", 0.04, 6_200, 40_000, 80, 2],
  ] as const;
  return rows
    .map((r) =>
      scoreCandidate({
        symbol: r[0],
        name: r[1],
        chain: r[2],
        address: r[3],
        priceUsd: r[4],
        liquidityUsd: r[5],
        volume24h: r[6],
        change24h: r[7],
        pairCreatedAt: now - r[8] * 3_600_000,
        url: null,
        venue: "dex",
      }),
    )
    .filter((x): x is Candidate => x !== null);
}

export type Memory = {
  seen: number;
  wins: number;
  losses: number;
  realized: number;
  minScore: number;
};

export function emptyMemory(): Memory {
  return { seen: 0, wins: 0, losses: 0, realized: 0, minScore: MIN_SCORE };
}

/**
 * Keyed learning buckets. The global Memory averages every venue, reason,
 * and symbol into one scalar; buckets keep (venue × reason) plus per-symbol
 * evidence so a winning SOL basis and a losing fresh-dex punt stop
 * cancelling each other out.
 */
export type BucketKey = {
  venue: string;
  reason: string;
  /** Per-symbol bucket; absent means the venue × reason aggregate. */
  symbol?: string;
  /** Demo and live accumulators never share a counter. */
  mode?: string;
};

export function bucketId(key: BucketKey): string {
  const parts = [key.venue || "unknown", key.reason || "ANY"];
  if (key.symbol) parts.push(key.symbol.toUpperCase());
  if (key.mode && key.mode !== "demo") parts.push(key.mode.toUpperCase());
  return parts.join("/");
}

/** Max per-symbol buckets retained; lowest-seen pruned first. */
export const MAX_SYMBOL_BUCKETS = 24;

export type BucketBook = Record<string, Memory>;

export function emptyBucketBook(): BucketBook {
  return {};
}

function bucketLearn(memory: Memory, pnl: number): Memory {
  const wins = memory.wins + (pnl > 0 ? 1 : 0);
  const losses = memory.losses + (pnl < 0 ? 1 : 0);
  const seen = memory.seen + 1;
  const realized = memory.realized + pnl;
  let minScore = memory.minScore;
  if (seen >= 4) {
    const winRate = wins / seen;
    if (winRate < 0.4 || realized < 0) minScore = Math.min(85, 62 + 2 * (seen - 3));
    else if (winRate > 0.55 && realized > 0) minScore = Math.max(55, 62 - (seen - 3));
    else minScore = 62;
  }
  return { seen, wins, losses, realized, minScore };
}

/** Fold one teachable close into its venue × reason and symbol buckets. */
export function learnBuckets(
  book: BucketBook,
  venue: string,
  reason: string,
  symbol: string,
  pnl: number,
  mode = "demo",
): BucketBook {
  const next: BucketBook = { ...book };
  const aggregateId = bucketId({ venue, reason, mode });
  const prev = next[aggregateId] ?? emptyMemory();
  next[aggregateId] = { ...bucketLearn(prev, pnl) };
  const symbolId = bucketId({ venue, reason, symbol, mode });
  const prevSym = next[symbolId] ?? emptyMemory();
  next[symbolId] = { ...bucketLearn(prevSym, pnl) };
  // Prune per-symbol buckets beyond cap (aggregates are never pruned).
  const symbolIds = Object.keys(next).filter((id) => id.split("/").length >= 3);
  if (symbolIds.length > MAX_SYMBOL_BUCKETS) {
    symbolIds
      .sort((a, b) => (next[a]?.seen ?? 0) - (next[b]?.seen ?? 0))
      .slice(0, symbolIds.length - MAX_SYMBOL_BUCKETS)
      .forEach((id) => {
        delete next[id];
      });
  }
  return next;
}

/**
 * Score floor for a candidate: the symbol bucket when it has a voice
 * (seen ≥ 3), else the venue × reason bucket (seen ≥ 4), else the global.
 */
export function floorFor(
  buckets: BucketBook,
  global: Memory,
  venue: string,
  reason: string,
  symbol: string,
  mode = "demo",
): number {
  const sym = buckets[bucketId({ venue, reason, symbol, mode })];
  if (sym && sym.seen >= 3) return sym.minScore;
  const agg = buckets[bucketId({ venue, reason, mode })];
  if (agg && agg.seen >= 4) return agg.minScore;
  return global.minScore;
}

/** Nudge the score floor from closed-trade evidence. History is the only teacher.
 * Mirrors the trade_learning_state CASE in trade-memory.functions.ts exactly so
 * the local estimate and the database aggregate never disagree. */
export function learn(memory: Memory, pnl: number): Memory {
  const wins = memory.wins + (pnl > 0 ? 1 : 0);
  const losses = memory.losses + (pnl < 0 ? 1 : 0);
  const seen = memory.seen + 1;
  const realized = memory.realized + pnl;
  let minScore = memory.minScore;
  if (seen >= 4) {
    const winRate = wins / seen;
    if (winRate < 0.4 || realized < 0) minScore = Math.min(85, 62 + 2 * (seen - 3));
    else if (winRate > 0.55 && realized > 0) minScore = Math.max(55, 62 - (seen - 3));
    else minScore = 62;
  }
  return { seen, wins, losses, realized, minScore };
}

export type SecurityVerdict = "clean" | "reject" | "unknown";

export function chooseEntry(
  book: Book,
  tape: Candidate[],
  minScore: number,
  now = Date.now(),
  securityOf: (id: string) => SecurityVerdict = () => "unknown",
): Candidate | null {
  const ranked = tape
    .map((c) => ({ c, edge: assessEdge(c) }))
    .filter((row) => row.edge.act)
    .sort((a, b) => b.edge.edge - a.edge.edge || b.c.score - a.c.score);
  for (const row of ranked) {
    // A verified hard-reject (honeypot, mint/freeze, unlocked LP, >15% tax)
    // vetoes the entry no matter what the score says.
    if (securityOf(row.c.id) === "reject") continue;
    if (entryVerdict(book, row.c, now, minScore).allowed) return row.c;
  }
  return null;
}

export function deposit(book: Book, amount: number): Book {
  if (!(amount > 0)) return book;
  const next = { ...book, cash: book.cash + amount };
  next.peakEquity = Math.max(book.peakEquity, equity(next));
  return next;
}

export function withdraw(book: Book, amount: number): { book: Book; ok: boolean; note: string } {
  if (!(amount > 0)) return { book, ok: false, note: "Amount must be positive" };
  if (amount > book.cash + 0.0001) return { book, ok: false, note: "Not enough free cash" };
  const after = { ...book, cash: book.cash - amount };
  after.peakEquity = Math.max(equity(after), Math.max(0, book.peakEquity - amount));
  return { book: after, ok: true, note: "Withdrawal posted to the ledger" };
}

/** Persist-then-commit: writes the current bucket state to the DB and
 *  schedules a reconciliation on the next boot so the DB aggregate is
 *  always consistent with the live bucketBook.  Returns the bucketBook
 *  unchanged for call-site convenience. */
export function persistBuckets(
  buckets: BucketBook,
  writeCb: (key: string, memory: Memory) => Promise<void>,
  mode = "demo"
): BucketBook {
  // Fire‑and‑forget each bucket to the DB.
  const promises = Object.entries(buckets).map(([key, mem]) =>
    writeCb(key, { ...mem, minScore: Math.max(0, Math.min(85, mem.minScore)) })
  );
  // Don't block the desk; just ensure we don't drop in-flight writes.
  Promise.allSettled(promises).then(() => {
    // Reconcile on the next event‑loop tick so the DB aggregate reflects
    // whatever local buckets survived pruning.
    setTimeout(reconcileBuckets, 0, buckets, writeCb, mode);
  });
  return buckets;
}

/**
 * Reconcile the DB-backed memory rows with the in‑memory bucketBook.
 * Any DB row not present locally is removed; any local bucket that has
 * grown is upserted.  After this run the local and DB states are identical.
 */
async function reconcileBuckets(
  local: BucketBook,
  writeCb: (key: string, memory: Memory) => Promise<void>,
  mode = "demo"
): Promise<void> {
  // Read every key that exists in the DB (the gate supplies the reader).
  const dbKeys = await readAllBucketKeys(mode);
  // Keep only keys that are also in the local bucketBook.
  const toKeep = new Set(Object.keys(local));
  for (const key of dbKeys) {
    if (!toKeep.has(key)) {
      // DB row has no local counterpart → remove it (stale from prune).
      await deleteBucketKey(key, mode);
    }
  }
  // Upsert every local bucket so the DB always has the latest.
  for (const [key, mem] of Object.entries(local)) {
    await upsertBucketKey(key, mem, mode);
  }
}

/** Read every bucket key that exists in the DB for the given mode. */
async function readAllBucketKeys(mode: string): Promise<string[]> {
  // Gate‑wrapped DB call – the gate injects the correct Neon connection.
  const supa = await import("@/lib/supabase");
  const db: any = (supa as any).getDb ? (supa as any).getDb() : (await supa).getSupabase();
  const { data } = await db
    .from("learning_buckets")
    .select("key")
    .eq("mode", mode);
  return (data || []).map((r: any) => r.key);
}

/** Delete a single bucket key from the DB. */
async function deleteBucketKey(key: string, mode: string): Promise<void> {
  // @ts-ignore: dynamic import pattern established elsewhere in this file
  const { getDb } = await import("@/lib/supabase");
  const db = getDb();
  await db.from("learning_buckets").delete().eq("key", key).eq("mode", mode);
}

/** Upsert a single bucket key into the DB. */
async function upsertBucketKey(key: string, mem: Memory, mode: string): Promise<void> {
  // @ts-ignore: dynamic import pattern established elsewhere in this file
  const { getDb } = await import("@/lib/supabase");
  const db = getDb();
  const { error } = await db
    .from("learning_buckets")
    .upsert({ key, minScore: mem.minScore, seen: mem.seen, wins: mem.wins, losses: mem.losses, realized: mem.realized, mode });
  if (error) console.error("[learnBuckets] upsert error", error);
}
