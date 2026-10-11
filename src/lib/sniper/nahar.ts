import { clip, round2 } from "./format";
import type {
  FillEvent,
  FillLog,
  OrderType,
  RouteCandidate,
  RouteLeg,
  RoutePlan,
  TcaVerdict,
} from "./mesh-types";
import type { Book, BookSide, RejectLog, WorkingOrder } from "./types";

/**
 * The order desk.
 *
 * A feed gives away its venue, its latency, its fee and its depth; the desk
 * weighs that against how much it has decided to trade and chooses where the
 * order lives. Every decision has three prices — the arrival, the fill and the
 * benchmark — and the difference is booked rather than absorbed. A plan that
 * cannot be executed at a tolerable cost is refused in writing, with the rule
 * that refused it.
 *
 * Pure: every function takes a book and values and returns new ones. Nothing
 * here reads a clock or a socket.
 */

/** Beyond this many basis points of slippage a fill is flagged as a mistake. */
export const SLIP_FLAG_BPS = 18;
/** Crossing cost the desk refuses to pay at all, in basis points. */
export const MAX_FEE_BPS = 45;
/** Assumed fee to a retail market maker, in basis points, when unknown. */
export const MM_FEE_BPS = 2.2;

function djb2(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** 0 … 1 deterministic draw from an id and a salt. Never a market decision. */
export function hashUnit(id: string, salt: number) {
  const x = (djb2(id) ^ Math.imul(Math.floor(salt * 1000), 2654435761)) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

/**
 * What a mix of feeds implies about execution: the more sources the desk reads
 * and the wider the universe, the longer the subscriber's own order takes to
 * work. Expressed in market minutes and shown, never hidden.
 */
export function latencyBudget(symbols: number, liveFeeds: number) {
  return round2(clip(0.6 + (symbols / 8 + liveFeeds / 4) * 0.25, 0.4, 6));
}

/** What running this book costs the desk, as a coverage and latency figure. */
export function footprint(book: Book) {
  const live = book.statuses.filter((s) => s.enabled);
  const dark = live.filter((s) => s.health === "DARK").length;
  return {
    latency: latencyBudget(book.symbols.length, live.length),
    coverage: live.length ? clip(1 - dark / live.length, 0, 1) : 0,
  };
}

/** A venue's depth in shares, the number the router actually spends. */
export function venueDepth(symbol: string, salt: number) {
  return venuesFor(symbol, salt)[0]?.liquidity ?? 0;
}

/** The venues a symbol can reach. Depth and fee decide, never the reader. */
export function venuesFor(symbol: string, salt: number): RouteCandidate[] {
  const depth = 0.35 + hashUnit(symbol, 11 + salt * 0.017) * 0.6;
  const breadth = 0.4 + hashUnit(symbol, 13 + salt * 0.031) * 0.5;
  const base = 400_000 + depth * 16_000_000;
  return [
    { venue: "Lit exchange", share: true, price: 0, fee: 1.6, liquidity: base, latency: 0.35 },
    { venue: `${symbol} midpoint book`, share: true, price: 0, fee: 0.5, liquidity: base * breadth, latency: 0.5 },
    { venue: "Dark pool", share: false, price: 0, fee: 0.4, liquidity: 90_000 + breadth * 380_000, latency: 0.9 },
    { venue: "Market maker", share: false, price: 0, fee: MM_FEE_BPS, liquidity: 60_000, latency: 0.2 },
  ];
}

export function orderTypeLabel(type: OrderType) {
  if (type === "LIMIT") return "Limit";
  if (type === "STOP") return "Stop";
  if (type === "STOP_LIMIT") return "Stop-limit";
  if (type === "BRACKET") return "Bracket";
  return "Market";
}

export function tcaLabel(verdict: TcaVerdict) {
  if (verdict === "CLEAN") return "Clean fill";
  if (verdict === "SLIPPED") return "Slipped";
  if (verdict === "GAPPED") return "Gapped through";
  if (verdict === "THIN") return "Thin depth";
  return "Rejected";
}

export type PlanInput = {
  book: Book;
  symbol: string;
  side: BookSide;
  qty: number;
  stop: number;
  target: number;
  confidence: number;
};

export type PlanResult = { plan: RoutePlan | null; reject: RejectLog | null };

function rejectResult(book: Book, symbol: string, rule: string, detail: string): PlanResult {
  return {
    plan: null,
    reject: { id: `${symbol}-${book.minute}-${rule}`, ts: book.minute, symbol, rule, detail },
  };
}

/**
 * Choose where and how the order lives.
 *
 * The desk does not ask "may I trade". It asks what execution costs against the
 * book's own arrival price, and refuses only when that answer is worse than the
 * edge it believes it has.
 */
export function planOrder(input: PlanInput): PlanResult {
  const { book, symbol, side, qty, stop, target, confidence } = input;
  const sym = book.symbols.find((s) => s.symbol === symbol);
  const orders = book.orders;

  if (!sym) return rejectResult(book, symbol, "UNKNOWN_SYMBOL", "The venue has no book for this name.");
  if (qty < 1) return rejectResult(book, symbol, "SIZE", "Position sizing returned less than one share.");
  if (orders.feeBps + orders.halfSpreadBps > MAX_FEE_BPS) {
    return rejectResult(
      book,
      symbol,
      "COST",
      `Crossing cost ${(orders.feeBps + orders.halfSpreadBps).toFixed(1)} bps is past the ${MAX_FEE_BPS} bps the desk will pay.`,
    );
  }

  const want = Math.max(200, Math.ceil(qty / 0.004));
  const booked: RouteLeg[] = [];
  let placed = 0;
  for (const venue of venuesFor(symbol, book.minute)) {
    if (placed >= qty) break;
    const take = Math.min(qty - placed, Math.floor(venue.liquidity * 0.4));
    if (take <= 0) continue;
    booked.push({ ...venue, qty: take, cost: (take * venue.fee) / 10_000 });
    placed += take;
  }
  if (placed < qty || booked.length === 0) {
    return rejectResult(book, symbol, "THIN_VENUE", "No venue carries this order's size without a knockout.");
  }

  const fee = round2(booked.reduce((sum, leg) => sum + leg.cost, 0));
  const liquidity = booked.reduce((sum, leg) => sum + leg.liquidity, 0);
  const notional = qty * sym.price;
  const edgeBps = Math.max(0, confidence * 140 - orders.halfSpreadBps - orders.feeBps);
  const limit =
    orders.type === "LIMIT" || orders.type === "STOP_LIMIT"
      ? round2(side === "LONG" ? sym.price * 1.00045 : sym.price * 0.99955)
      : null;
  const worst = round2(
    side === "LONG" ? sym.price * (1 + orders.maxSlippagePct) : sym.price * (1 - orders.maxSlippagePct),
  );

  if (liquidity < want * 0.25) {
    return rejectResult(
      book,
      symbol,
      "THIN_VENUE",
      `Resting size ${Math.round(liquidity).toLocaleString()} is under a quarter of what this order wants.`,
    );
  }

  const reason =
    orders.type === "MARKET"
      ? "Cross now, pay the spread, be done."
      : orders.type === "LIMIT"
        ? "Work it — no take, no fill."
        : orders.type === "STOP"
          ? "Stay out until the trigger confirms the move."
          : orders.type === "STOP_LIMIT"
            ? "Trigger, then work the limit behind it."
            : "One bracket: it stops, targets, or expires.";

  return {
    plan: {
      type: orders.type,
      side,
      qty,
      arrival: sym.price,
      limit,
      legs: booked,
      expected: round2(notional * (1 + (orders.halfSpreadBps + orders.feeBps) / 10_000)),
      worst,
      score: round2(edgeBps * qty * 0.01),
      fee,
      liquidity,
      venue: booked[0]?.venue ?? "Lit exchange",
      reason,
      stop,
      target,
    },
    reject: null,
  };
}

export type FillInput = {
  book: Book;
  symbol: string;
  side: BookSide;
  qty: number;
  confidence: number;
};

/** Whether the book is deep enough for the size the desk wants to do. */
function thinBook(price: number, sigma: number, qty: number) {
  return sigma > 1.35 && price * qty < 60_000;
}

/**
 * Settle a market order.
 *
 * The arrival price is the mid; the fill is worse by the half spread the venue
 * charges plus a measured slippage draw, and both are booked as numbers the
 * desk has to look at. The TCA verdict is the point: CLEAN is inside two thirds
 * of the spread, SLIPPED up to the flagged band, GAPPED beyond it, and THIN is
 * a book that let the order move the market itself.
 */
export function executeMarket(input: FillInput): { fill: FillEvent; verdict: TcaVerdict } {
  const { book, symbol, side, qty } = input;
  const sym = book.symbols.find((s) => s.symbol === symbol);
  if (!sym) throw new Error(`no venue book for ${symbol}`);
  const arrival = sym.price;
  const venue = venuesFor(symbol, book.minute)[0];
  const thin = thinBook(sym.price, sym.sigma, qty);
  const draw = hashUnit(`${symbol}-${book.minute}-slip`, book.minute);
  const impact = (qty / Math.max(1, venue.liquidity)) * 10_000;
  const slipBps = round2(
    clip(book.orders.halfSpreadBps * (0.35 + draw * 0.85) + impact + (thin ? 14 : 0), 0, 140),
  );
  const signed = side === "LONG" ? 1 : -1;
  const fill = round2(arrival * (1 + (signed * slipBps) / 10_000));
  const slip = round2((fill - arrival) * qty * signed);
  const fee = round2((qty * fill * book.orders.feeBps) / 10_000);
  const latency = round2(0.2 + hashUnit(`${symbol}-${book.minute}-lat`, book.minute) * 1.4);
  const verdict = verdictFor(book, thin, slipBps);

  return {
    fill: {
      positionId: "",
      symbol,
      side,
      qty,
      arrival,
      fill,
      slip,
      slipBps,
      fee,
      venue: venue.venue,
      latency,
      partial: hashUnit(`${symbol}-${book.minute}-part`, book.minute) > 0.82,
      tca: verdict,
    },
    verdict,
  };
}

function verdictFor(book: Book, thin: boolean, slipBps: number): TcaVerdict {
  if (thin && slipBps > 12) return "THIN";
  if (slipBps <= book.orders.halfSpreadBps * 0.7) return "CLEAN";
  if (slipBps <= SLIP_FLAG_BPS) return "SLIPPED";
  return "GAPPED";
}

/** Settle a resting order the tape has now touched at `price`. */
export function executeResting(
  book: Book,
  order: WorkingOrder,
  price: number,
  side: BookSide,
): { fill: FillEvent; verdict: TcaVerdict } {
  const arrival = order.limit;
  const signed = side === "LONG" ? 1 : -1;
  const adverse = round2((((price - arrival) * signed) / Math.max(1, arrival)) * -10_000);
  const slipBps = round2(clip(adverse + book.orders.halfSpreadBps * 0.5, 0, 180));
  const fill = round2(price);
  const slip = round2((fill - arrival) * order.qty * signed);
  const fee = round2((order.qty * fill * book.orders.feeBps) / 10_000);
  const verdict: TcaVerdict =
    slipBps <= book.orders.halfSpreadBps ? "CLEAN" : slipBps <= SLIP_FLAG_BPS ? "SLIPPED" : "GAPPED";
  return {
    fill: {
      positionId: "",
      symbol: order.symbol,
      side,
      qty: order.qty,
      arrival,
      fill,
      slip,
      slipBps,
      fee,
      venue: "Resting book",
      latency: 0,
      partial: false,
      tca: verdict,
    },
    verdict,
  };
}

export function pushFill(book: Book, fill: FillEvent, positionId: string): Book {
  const log: FillLog = {
    ...fill,
    positionId,
    id: `fill-${positionId}-${book.minute}`,
    at: book.minute,
  };
  return { ...book, fills: [log, ...book.fills].slice(0, 200) };
}

export function pushReject(book: Book, reject: RejectLog | null): Book {
  if (!reject) return book;
  return { ...book, rejects: [reject, ...book.rejects].slice(0, 60) };
}

export function pushWorking(book: Book, order: WorkingOrder): Book {
  return { ...book, working: [order, ...book.working].slice(0, 40) };
}

export function clearWorking(book: Book, id: string): Book {
  return { ...book, working: book.working.filter((o) => o.id !== id) };
}

/**
 * Which resting orders the tape has now touched, and which keep standing.
 *
 * A stop arms only when price reaches the trigger, then works at its limit. A
 * plain limit fills when price trades through it. Anything past its expiry is
 * dropped rather than left to become a position nobody chose.
 */
export function workingTouches(book: Book) {
  const hits: Array<{ order: WorkingOrder; price: number; why: string }> = [];
  const left: WorkingOrder[] = [];
  for (const order of book.working) {
    const sym = book.symbols.find((s) => s.symbol === order.symbol);
    const price = sym?.price ?? order.limit;
    if (order.tif !== "GTC" && book.minute >= order.expiresAt) continue;
    if (order.trigger !== null) {
      const armed = order.side === "LONG" ? price >= order.trigger : price <= order.trigger;
      if (!armed) {
        left.push(order);
        continue;
      }
    }
    const touched = order.side === "LONG" ? price <= order.limit : price >= order.limit;
    if (touched) {
      hits.push({
        order,
        price,
        why: order.trigger !== null ? "Triggered, then worked" : "Limit touched",
      });
    } else {
      left.push(order);
    }
  }
  return { hits, left };
}

/**
 * An order the desk places for an exit. A bracket rests both levels at once; a
 * stop rests the protective level alone; a limit rests the target alone.
 * `kind` is ENTRY for the resting entries the desk works instead of crossing.
 */
export function buildOrder(
  book: Book,
  positionId: string,
  symbol: string,
  side: BookSide,
  qty: number,
  stop: number,
  target: number,
  confidence: number,
  kind: "ENTRY" | "EXIT" = "EXIT",
): WorkingOrder {
  const type = book.orders.type;
  // Where the order rests when it is not crossing: the protective level for a
  // stop, the target for a limit, both for a bracket and a stop-limit.
  const trigger = type === "STOP" || type === "STOP_LIMIT" || type === "BRACKET" ? stop : null;
  const limit = type === "LIMIT" || type === "BRACKET" ? target : type === "STOP_LIMIT" ? stop : stop;
  return {
    id: `wo-${positionId}-${book.minute}`,
    symbol,
    side,
    qty,
    limit: round2(limit),
    trigger: trigger === null ? null : round2(trigger),
    kind,
    placedAt: book.minute,
    expiresAt: book.minute + Math.max(4, book.orders.limitExpire),
    stop: round2(stop),
    target: round2(target),
    confidence,
    tif: book.orders.tif,
  };
}

export type ExitBooked = { verdict: TcaVerdict; slip: number; slipBps: number };

/** Book the exit's own slippage, in the same units as the entry's. */
export function exitTca(book: Book, side: BookSide, arrival: number, fill: number, qty: number): ExitBooked {
  const signed = side === "LONG" ? 1 : -1;
  const slip = round2((fill - arrival) * qty * signed);
  const slipBps = round2(clip((slip / Math.max(1, arrival * qty)) * 10_000, -400, 400));
  const verdict: TcaVerdict =
    slipBps <= book.orders.halfSpreadBps ? "CLEAN" : slipBps <= SLIP_FLAG_BPS ? "SLIPPED" : "GAPPED";
  return { verdict, slip, slipBps };
}
