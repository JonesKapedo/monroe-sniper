export const STARTING_CASH = 25_000;
export const MAX_POSITIONS = 3;
export const MAX_IDEA = 0.05;
export const MAX_BOOK = 0.15;
export const MIN_SCORE = 70;
export const MIN_LIQ = 10_000;

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
  openedAt: number;
  notional: number;
};

export type ClosedTrade = {
  id: string;
  symbol: string;
  pnl: number;
  reason: string;
  closedAt: number;
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
};

export type GateLine = { id: string; label: string; pass: boolean; detail: string };

export function emptyBook(): Book {
  return {
    cash: STARTING_CASH,
    positions: [],
    trades: [],
    peakEquity: STARTING_CASH,
    dayPnl: 0,
    consecutiveLosses: 0,
    cooldownUntil: null,
    kill: false,
    killReason: null,
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
}): Candidate | null {
  if (!input.address || !input.priceUsd || input.priceUsd <= 0) return null;
  const liq = input.liquidityUsd ?? 0;
  const vol = input.volume24h ?? 0;
  const chg = input.change24h ?? 0;
  const ageH = input.pairCreatedAt
    ? Math.max(0, (Date.now() - input.pairCreatedAt) / 3_600_000)
    : null;
  const liqScore = Math.max(0, Math.min(100, (liq / 100_000) * 100));
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
  if (liq < MIN_LIQ) {
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
  };
}

/** Constant-product style impact, capped. */
export function impactPct(notional: number, liquidity: number): number {
  if (liquidity <= 0 || notional <= 0) return 0.02;
  return Math.min(0.35, notional / (2 * liquidity));
}

export function simulateBuy(notional: number, mid: number, liquidity: number) {
  const impact = impactPct(notional, liquidity);
  const fee = 0.003;
  const buffer = 0.005;
  const gas = 1.5;
  const fill = mid * (1 + impact + buffer);
  const costPct = notional > 0 ? (notional * (impact + buffer + fee) + gas) / notional : 1;
  const qty = Math.max(0, (notional - notional * fee - gas) / fill);
  const reasons: string[] = [];
  if (costPct > 0.06) reasons.push(`Expected cost ${(costPct * 100).toFixed(1)}% is above 6%`);
  if (liquidity < notional * 8) reasons.push("Pool is thin versus the intended size");
  if (qty <= 0) reasons.push("Nothing left after fees");
  return { fill, qty, impact, costPct, acceptable: reasons.length === 0, reasons };
}

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

export function entryVerdict(book: Book, c: Candidate, now = Date.now()): {
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
      label: "Score at least 70",
      pass: c.score >= MIN_SCORE,
      detail: `${c.score}/100`,
    },
    {
      id: "liq",
      label: "Liquidity at least $10k",
      pass: c.liquidityUsd >= MIN_LIQ,
      detail: `$${Math.round(c.liquidityUsd).toLocaleString()}`,
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
      pass: notional >= 50,
      detail: `Planned $${notional.toFixed(0)}`,
    },
  ];
  const sim =
    lines.every((l) => l.pass) && notional > 0
      ? simulateBuy(notional, c.priceUsd, c.liquidityUsd)
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

export function enter(book: Book, c: Candidate, now = Date.now()): { book: Book; ok: boolean; note: string } {
  const v = entryVerdict(book, c, now);
  if (!v.allowed || !v.sim) {
    const fail = v.lines.filter((l) => !l.pass).map((l) => l.label);
    return { book, ok: false, note: fail.join(", ") || "Blocked" };
  }
  const pos: Position = {
    id: stamp("pos"),
    tokenId: c.id,
    symbol: c.symbol,
    chain: c.chain,
    qty: v.sim.qty,
    entryPrice: v.sim.fill,
    mark: v.sim.fill,
    stop: v.sim.fill * 0.92,
    openedAt: now,
    notional: v.notional,
  };
  const next: Book = {
    ...book,
    cash: book.cash - v.notional,
    positions: [...book.positions, pos],
    peakEquity: Math.max(book.peakEquity, equity({ ...book, cash: book.cash - v.notional, positions: [...book.positions, pos] })),
  };
  return { book: armIfNeeded(next), ok: true, note: `Paper fill ${c.symbol}` };
}

export function markBook(book: Book, prices: Record<string, number>, now = Date.now()): Book {
  let next = book;
  const kept: Position[] = [];
  const extraTrades: ClosedTrade[] = [];
  let cash = book.cash;
  let day = book.dayPnl;
  let streak = book.consecutiveLosses;
  let cool = book.cooldownUntil;

  for (const p of book.positions) {
    const px = prices[p.tokenId] && prices[p.tokenId] > 0 ? prices[p.tokenId] : p.mark;
    const aged = now - p.openedAt > 6 * 60 * 60 * 1000;
    const stopped = px <= p.stop;
    if (aged || stopped) {
      const pnl = (px - p.entryPrice) * p.qty;
      cash += p.qty * px;
      day += pnl;
      streak = pnl < 0 ? streak + 1 : 0;
      if (streak >= 3) cool = now + 4 * 60 * 60 * 1000;
      extraTrades.push({
        id: stamp("tr"),
        symbol: p.symbol,
        pnl,
        reason: stopped ? "STOP" : "TIME",
        closedAt: now,
      });
    } else {
      kept.push({ ...p, mark: px });
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
  };
  const eq = equity(next);
  next.peakEquity = Math.max(book.peakEquity, eq);
  return armIfNeeded(next);
}

export function closeOne(book: Book, id: string, now = Date.now()): Book {
  const p = book.positions.find((x) => x.id === id);
  if (!p) return book;
  const pnl = (p.mark - p.entryPrice) * p.qty;
  const streak = pnl < 0 ? book.consecutiveLosses + 1 : 0;
  const next: Book = {
    ...book,
    cash: book.cash + p.qty * p.mark,
    positions: book.positions.filter((x) => x.id !== id),
    trades: [
      { id: stamp("tr"), symbol: p.symbol, pnl, reason: "MANUAL", closedAt: now },
      ...book.trades,
    ].slice(0, 40),
    dayPnl: book.dayPnl + pnl,
    consecutiveLosses: streak,
    cooldownUntil: streak >= 3 ? now + 4 * 60 * 60 * 1000 : book.cooldownUntil,
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
      }),
    )
    .filter((x): x is Candidate => x !== null);
}
