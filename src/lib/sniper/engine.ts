import { exitHit, oppositeExit } from "./exit";
import { round2 } from "./format";
import { boardFrom, emptyScratch, stepMesh, type MeshFeeds } from "./mesh";
import { driftEdge, features, freshModel, train } from "./model";
import {
  buildOrder,
  executeResting,
  planOrder,
  pushFill,
  pushReject,
  pushWorking,
  workingTouches,
} from "./nahar";
import { nextGaussian, nextRand, takeId } from "./rng";
import { planEntry, snapshot } from "./risk";
import { buildSignalSet } from "./signals";
import {
  PAPER_CASH,
  defaultSettings,
  type Activity,
  type Book,
  type BookSide,
  type ExitReason,
  type LedgerEntry,
  type ModelState,
  type Position,
  type Settings,
  type SymbolState,
  type Trade,
} from "./types";

const UNIVERSE: Array<Omit<SymbolState, "hist" | "bias">> = [
  { symbol: "SPY", name: "S&P 500", sector: "Index", price: 572.4, mu: 0.35, sigma: 0.72 },
  { symbol: "QQQ", name: "Nasdaq 100", sector: "Index", price: 498.1, mu: 0.45, sigma: 0.9 },
  { symbol: "NVDA", name: "NVIDIA", sector: "Semis", price: 131.25, mu: 0.7, sigma: 1.45 },
  { symbol: "AAPL", name: "Apple", sector: "Tech", price: 227.8, mu: 0.3, sigma: 0.85 },
  { symbol: "MSFT", name: "Microsoft", sector: "Tech", price: 428.6, mu: 0.4, sigma: 0.8 },
  { symbol: "AMZN", name: "Amazon", sector: "Retail", price: 196.4, mu: 0.4, sigma: 1 },
  { symbol: "META", name: "Meta", sector: "Internet", price: 582.2, mu: 0.5, sigma: 1.15 },
  { symbol: "TSLA", name: "Tesla", sector: "Auto", price: 248.9, mu: 0.1, sigma: 1.7 },
  { symbol: "AMD", name: "AMD", sector: "Semis", price: 162.3, mu: 0.55, sigma: 1.4 },
  { symbol: "JPM", name: "JPMorgan", sector: "Finance", price: 224.7, mu: 0.25, sigma: 0.75 },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", price: 118.5, mu: 0.15, sigma: 0.9 },
  { symbol: "GLD", name: "Gold", sector: "Metal", price: 242.1, mu: 0.2, sigma: 0.62 },
];

function pushActivity(book: Book, item: Activity): Activity[] {
  return [item, ...book.activity].slice(0, 80);
}

function advanceSymbol(sym: SymbolState, seed: number): [SymbolState, number] {
  const input = features(sym);
  const [z, s1] = nextGaussian(seed);
  const [u, s2] = nextRand(s1);
  const shock = z * sym.sigma * 0.0064 + sym.mu * 0.00015 + driftEdge(input);
  const price = round2(Math.max(1, sym.price * Math.exp(shock)));
  const bias = clipBias(sym.bias * 0.96 + (u - 0.5) * 0.12 + Math.sign(input[1] ?? 0) * 0.04);
  return [{ ...sym, price, bias, hist: [...sym.hist, price].slice(-90) }, s2];
}

function clipBias(n: number) {
  return Math.max(-1, Math.min(1, n));
}

export function stepPrices(book: Book): Book {
  let seed = book.seed;
  const symbols: SymbolState[] = [];
  for (const sym of book.symbols) {
    const [next, s] = advanceSymbol(sym, seed);
    seed = s;
    symbols.push(next);
  }
  return { ...book, seed, symbols, minute: book.minute + 1 };
}

function shiftRegime(book: Book): Book {
  let seed = book.seed;
  const picked = new Set<number>();
  while (picked.size < 3) {
    const [r, s] = nextRand(seed);
    seed = s;
    picked.add(Math.floor(r * book.symbols.length));
  }
  const symbols = book.symbols.map((sym, i) => (picked.has(i) ? { ...sym, mu: round2(-sym.mu) } : sym));
  const names = symbols.filter((_, i) => picked.has(i)).map((s) => s.symbol);
  return {
    ...book,
    seed,
    symbols,
    model: { ...book.model, adaptLeft: 12 },
    activity: pushActivity(book, {
      id: `reg-${book.minute}`,
      ts: book.minute,
      tone: "info",
      text: `Regime shift. Drift flipped on ${names.join(", ")}. Learning rate lifted.`,
    }),
  };
}

function closeAt(book: Book, pos: Position, fill: number, reason: ExitReason): Book {
  const gain = round2(pos.side === "LONG" ? (fill - pos.entry) * pos.qty : (pos.entry - fill) * pos.qty);
  const cash = round2(book.cash + gain);
  const y = pos.side === "LONG" ? (gain > 0 ? 1 : 0) : gain > 0 ? 0 : 1;
  const model = train(book.model, pos.features, y, book.minute);
  const [id, seed] = takeId(book.seed, "trd");
  const trade: Trade = {
    id,
    symbol: pos.symbol,
    side: pos.side,
    qty: pos.qty,
    entry: pos.entry,
    exit: round2(fill),
    pnl: gain,
    openedAt: pos.openedAt,
    closedAt: book.minute,
    reason,
    confidence: pos.confidence,
  };
  const verb =
    reason === "TARGET" ? "Target" : reason === "STOP" ? "Stopped" : reason === "TIME" ? "Time stop" : reason === "SIGNAL" ? "Signal exit" : "Manual exit";
  const text = `${verb} ${pos.symbol} ${gain >= 0 ? "+" : ""}${gain.toFixed(2)}`;
  const ledger: LedgerEntry = {
    id: `led-${id}`,
    wall: Date.now(),
    kind: "CLOSE",
    amount: gain,
    note: text,
    balanceAfter: cash,
  };
  return {
    ...book,
    seed,
    cash,
    model,
    positions: book.positions.filter((p) => p.id !== pos.id),
    trades: [trade, ...book.trades].slice(0, 300),
    ledger: [ledger, ...book.ledger].slice(0, 200),
    activity: pushActivity(book, {
      id: `a-${id}`,
      ts: book.minute,
      tone: gain >= 0 ? "up" : "down",
      text,
    }),
  };
}

function openPosition(book: Book, sym: SymbolState, side: BookSide, confidence: number, plan: { qty: number; stop: number; target: number }): Book {
  const [id, seed] = takeId(book.seed, "pos");
  const pos: Position = {
    id,
    symbol: sym.symbol,
    side,
    qty: plan.qty,
    entry: sym.price,
    stop: plan.stop,
    target: plan.target,
    openedAt: book.minute,
    confidence,
    features: features(sym),
  };
  const text = `${side === "LONG" ? "Long" : "Short"} ${sym.symbol} ${plan.qty} @ ${sym.price.toFixed(2)} · stop ${plan.stop.toFixed(2)} · target ${plan.target.toFixed(2)}`;
  return {
    ...book,
    seed,
    positions: [...book.positions, pos],
    activity: pushActivity(book, { id: `o-${id}`, ts: book.minute, tone: "info", text }),
  };
}

export function step(book: Book): Book {
  let next = stepPrices(book);
  if (next.minute > 0 && next.minute % 220 === 0) next = shiftRegime(next);
  const priceOf = (symbol: string, fallback: number) =>
    next.symbols.find((s) => s.symbol === symbol)?.price ?? fallback;

  // 1. Bracket exits first: the tape leaves a position on its own terms before
  //    any fresh read is allowed to argue with it.
  for (const pos of [...next.positions]) {
    const hit = exitHit(pos, priceOf(pos.symbol, pos.entry), next.minute, next.settings.timeStop);
    if (hit) next = closeAt(next, pos, hit.fill, hit.reason);
  }

  // 2. Resting orders the tape has now touched. A limit that filled becomes a
  //    position; a stop that armed becomes the protective exit.
  next = settleWorking(next);

  // 3. One dispatch, twenty-three reads. The mesh decides what the desk may
  //    believe this minute; nothing downstream re-reads the book itself.
  const mesh = stepMesh({
    symbols: next.symbols,
    model: next.model,
    settings: next.settings,
    minute: next.minute,
    scratch: next.scratch,
    hypedSymbol: hotSymbolOf(next),
  });
  const board = boardFrom({
    symbols: next.symbols,
    minute: next.minute,
    statuses: mesh.statuses,
    cache: mesh.cache,
  });
  next = { ...next, scratch: mesh.scratch, statuses: mesh.statuses, board };

  const signals: Book["signals"] = {};
  for (const sym of next.symbols) signals[sym.symbol] = buildSignalSet(sym, next.model, next.settings);
  next = { ...next, signals };

  if (next.settings.autoTrade) {
    next = manageOpen(next, mesh.cache);
    next = lookForEntries(next, mesh.cache);
  }

  const equity = snapshot(next).equity;
  const dayOpenEquity = next.minute % 390 === 0 ? equity : next.dayOpenEquity;
  return {
    ...next,
    dayOpenEquity,
    curve: [...next.curve, { m: next.minute, equity }].slice(-390),
  };
}

/** The one name the crowd is loudest about — the only input SOCIAL is fed. */
function hotSymbolOf(book: Book) {
  return (
    book.symbols
      .slice()
      .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias))[0]?.symbol ?? null
  );
}

/** Positions whose mesh tally has flipped are unwound through the order desk. */
function manageOpen(book: Book, cache: MeshFeeds): Book {
  let next = book;
  for (const pos of [...next.positions]) {
    const view = next.board?.perSymbol[pos.symbol];
    const sig = next.signals[pos.symbol]?.ensemble;
    const flipped = view ? view.tally : 0;
    const against = pos.side === "LONG" ? flipped < -0.08 : flipped > 0.08;
    const legacy = sig ? sig.confidence >= next.settings.minConfidence && oppositeExit(pos.side, sig.action) : false;
    const veto = next.settings.v.vetoNews && (cache.NEWS?.[pos.symbol]?.strength ?? 0) > 0.6;
    if (!against && !legacy && !veto) continue;
    const px = next.symbols.find((s) => s.symbol === pos.symbol)?.price ?? pos.entry;
    next = closeAt(next, pos, px, veto ? "SIGNAL" : against ? "SIGNAL" : "SIGNAL");
  }
  return next;
}

/** Ranks the board and takes the best qualified names through the order desk. */
function lookForEntries(book: Book, cache: MeshFeeds): Book {
  const board = book.board;
  if (!board) return book;
  let next = book;
  const ranked = Object.values(board.perSymbol)
    .filter((row) => row.qualified && !row.vetoed && row.direction !== 0)
    .sort((a, b) => b.confidence - a.confidence);

  for (const row of ranked) {
    if (next.positions.length >= next.settings.maxPositions) break;
    if (next.positions.some((p) => p.symbol === row.symbol)) continue;
    if (next.working.some((o) => o.symbol === row.symbol)) continue;
    const sym = next.symbols.find((s) => s.symbol === row.symbol);
    if (!sym) continue;
    const side: BookSide = row.direction > 0 ? "LONG" : "SHORT";

    const risk = defensiveVeto(next, sym, side, cache);
    if (risk) {
      next = pushReject(next, risk);
      continue;
    }

    const plan = planEntry(next, sym.price, side);
    if (!plan) continue;
    const routed = planOrder({
      book: next,
      symbol: sym.symbol,
      side,
      qty: plan.qty,
      stop: plan.stop,
      target: plan.target,
      confidence: row.confidence,
    });
    if (!routed.plan) {
      next = pushReject(next, routed.reject);
      continue;
    }
    if (next.orders.type === "LIMIT" || next.orders.type === "STOP_LIMIT") {
      next = pushWorking(
        next,
        buildOrder(next, `wo-${row.symbol}-${next.minute}`, sym.symbol, side, plan.qty, plan.stop, plan.target, row.confidence, "ENTRY"),
      );
      continue;
    }
    next = openPosition(next, sym, side, row.confidence, { qty: plan.qty, stop: plan.stop, target: plan.target });
  }
  return next;
}

/**
 * The situational vetoes, plus the fade that ships off.
 *
 * These are the desk's refusal to take a trade it can see will be crowded out
 * or already priced — the place it reserves the right to do nothing.
 */
function defensiveVeto(book: Book, sym: SymbolState, side: BookSide, cache: MeshFeeds) {
  const v = book.settings.v;
  const rec = (rule: string, detail: string) => ({ id: `${sym.symbol}-${book.minute}-${rule}`, ts: book.minute, symbol: sym.symbol, rule, detail });
  if (v.vetoNews) {
    const news = cache.NEWS?.[sym.symbol];
    if (news && news.strength > 0.65 && Math.sign(news.bias) !== (side === "LONG" ? 1 : -1)) {
      return rec("NEWS_AGAINST", "A fresh headline disagrees with this entry; the repricing is not finished.");
    }
  }
  if (v.vetoThin) {
    const bookRead = cache.BOOK?.[sym.symbol];
    if (bookRead && bookRead.strength < 0.3) {
      return rec("THIN_BOOK", "Resting depth is too thin for a stop to mean anything.");
    }
  }
  if (v.halfAgainst) {
    const cross = cache.CROSS?.[sym.symbol];
    const sector = cache.SECTOR?.[sym.symbol];
    const against = (cross && Math.sign(cross.bias) !== (side === "LONG" ? 1 : -1)) && (sector && Math.sign(sector.bias) !== (side === "LONG" ? 1 : -1));
    if (against && book.positions.length >= 2) {
      return rec("AGAINST_TIDE", "Index and sector both lean against this entry; the desk stands down rather than halves.");
    }
  }
  return null;
}

/** Resting orders the tape has now touched, and orders that expired unfilled. */
function settleWorking(book: Book): Book {
  if (book.working.length === 0) return book;
  let next = book;
  const { hits, left } = workingTouches(book);
  next = { ...next, working: left };
  for (const hit of hits) {
    const { fill, verdict } = executeResting(next, hit.order, hit.price, hit.order.side);
    if (hit.order.kind === "EXIT") {
      const pos = next.positions.find((p) => p.symbol === hit.order.symbol);
      if (pos) next = closeAt(next, pos, fill.fill, verdict === "GAPPED" ? "STOP" : "TARGET");
      continue;
    }
    const sym = next.symbols.find((s) => s.symbol === hit.order.symbol);
    if (!sym) continue;
    next = openPosition(next, sym, hit.order.side, hit.order.confidence, {
      qty: hit.order.qty,
      stop: hit.order.stop,
      target: hit.order.target,
    });
    next = pushFill(next, fill, `${hit.order.symbol}-${next.minute}`);
  }
  return next;
}

export function manualClose(book: Book, id: string): Book {
  const pos = book.positions.find((p) => p.id === id);
  if (!pos) return book;
  const px = book.symbols.find((s) => s.symbol === pos.symbol)?.price ?? pos.entry;
  return closeAt(book, pos, px, "MANUAL");
}

export function flattenAll(book: Book): Book {
  let next = book;
  for (const pos of [...book.positions]) next = manualClose(next, pos.id);
  return next;
}

export function resetLearning(book: Book): Book {
  return {
    ...book,
    model: freshModel(),
    activity: pushActivity(book, {
      id: `learn-reset-${book.minute}`,
      ts: book.minute,
      tone: "info",
      text: "Learning weights reset to the research prior.",
    }),
  };
}

function blankSymbols(): SymbolState[] {
  return UNIVERSE.map((row) => ({ ...row, bias: 0, hist: [row.price] }));
}

export function createSession(
  cash: number,
  settings: Settings,
  model: ModelState,
  pinHash: string | null,
  ledger: LedgerEntry[],
): Book {
  let book: Book = {
    seed: 0x4d6f6e72,
    minute: 0,
    cash,
    symbols: blankSymbols(),
    positions: [],
    trades: [],
    ledger,
    signals: {},
    curve: [],
    model,
    activity: [],
    dayOpenEquity: cash,
    settings,
    pinHash,
    lastWall: 0,
    board: null,
    statuses: [],
    scratch: emptyScratch(0),
    fills: [],
    working: [],
    rejects: [],
    orders: { ...settings.orders },
  };
  book.orders = { ...book.orders, ...settings.orders };
  for (let i = 0; i < 42; i++) book = stepPrices(book);
  const signals: Book["signals"] = {};
  for (const sym of book.symbols) signals[sym.symbol] = buildSignalSet(sym, book.model, book.settings);
  const equity = snapshot({ ...book, signals }).equity;
  return {
    ...book,
    signals,
    dayOpenEquity: equity,
    curve: [{ m: book.minute, equity }],
    activity: [
      {
        id: "warm",
        ts: book.minute,
        tone: "info",
        text: "Session warmed. Twelve names are live. No open risk yet.",
      },
    ],
  };
}

export function createBook(): Book {
  let book = createSession(PAPER_CASH, defaultSettings, freshModel(), null, []);
  for (let i = 0; i < 110; i++) book = step(book);
  let guard = 0;
  while (book.positions.length === 0 && guard < 50) {
    book = step(book);
    guard++;
  }
  return { ...book, lastWall: 0 };
}

export function flatSession(book: Book): Book {
  const next = createSession(round2(book.cash), book.settings, book.model, book.pinHash, book.ledger);
  return {
    ...next,
    lastWall: Date.now(),
    activity: pushActivity(next, {
      id: `flat-${next.minute}`,
      ts: next.minute,
      tone: "info",
      text: "Flat session. Wallet and what the model has learned stay. Prices are a new path.",
    }),
  };
}
