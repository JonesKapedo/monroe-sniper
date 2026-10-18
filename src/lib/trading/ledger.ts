/**
 * Canonical trading ledger — single source of truth for cash, positions,
 * fills and events across desk (tape/avenues) and Scanner engines.
 * Paper and live modes each own a ledger instance; never mix them.
 */

export type LedgerAccountKind = "cash" | "position" | "pnl";

export type LedgerAccount = {
  id: string;
  kind: LedgerAccountKind;
  /** Human label, e.g. "USD cash" or "TOKEN:sol:xyz". */
  label: string;
  /** Balance in account units (USD for cash/pnl, tokens for position). */
  balance: number;
};

export type OrderSide = "buy" | "sell";
export type OrderStatus = "pending" | "filled" | "partial" | "cancelled" | "rejected";

/** Which engine opened or closed the line — for audit, not separate books. */
export type LedgerEngine = "desk" | "scanner" | "manual" | "system";

export type LedgerOrder = {
  id: string;
  side: OrderSide;
  instrumentId: string;
  symbol: string;
  qty: number;
  limitPriceUsd: number | null;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  clientTag?: string;
  engine?: LedgerEngine;
};

export type LedgerFill = {
  id: string;
  orderId: string;
  instrumentId: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  priceUsd: number;
  feeUsd: number;
  filledAt: number;
  engine: LedgerEngine;
  notionalUsd: number;
};

export type LedgerPosition = {
  instrumentId: string;
  symbol: string;
  qty: number;
  avgEntryPriceUsd: number;
  realizedPnlUsd: number;
  openedAt: number;
  updatedAt: number;
  engine: LedgerEngine;
  markPriceUsd: number;
};

export type LedgerEventKind =
  | "order_created"
  | "order_filled"
  | "order_cancelled"
  | "position_opened"
  | "position_closed"
  | "cash_deposit"
  | "cash_withdraw"
  | "risk_halt"
  | "note"
  | "sync";

export type LedgerEvent = {
  id: string;
  kind: LedgerEventKind;
  at: number;
  message: string;
  engine?: LedgerEngine;
  meta?: Record<string, unknown>;
};

export type TradingLedger = {
  version: 1;
  seedCashUsd: number;
  accounts: LedgerAccount[];
  orders: LedgerOrder[];
  fills: LedgerFill[];
  positions: LedgerPosition[];
  events: LedgerEvent[];
};

function eid(prefix: string, at: number): string {
  return `${prefix}-${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyLedger(seedCashUsd = 0): TradingLedger {
  return {
    version: 1,
    seedCashUsd: Math.max(0, seedCashUsd),
    accounts: [],
    orders: [],
    fills: [],
    positions: [],
    events: [],
  };
}

export function createPaperAccount(cashUsd: number, at = Date.now()): TradingLedger {
  const seed = Math.max(0, cashUsd);
  const ledger = createEmptyLedger(seed);
  ledger.accounts.push({
    id: eid("acct", at),
    kind: "cash",
    label: "USD cash",
    balance: seed,
  });
  ledger.events.push({
    id: eid("evt", at),
    kind: "cash_deposit",
    at,
    engine: "system",
    message: `Seeded unified paper cash $${seed.toFixed(2)}`,
  });
  return ledger;
}

export function cashBalance(ledger: TradingLedger): number {
  return ledger.accounts
    .filter((a) => a.kind === "cash")
    .reduce((s, a) => s + a.balance, 0);
}

/** Mark-to-market exposure of open positions. */
export function exposureUsd(ledger: TradingLedger): number {
  return ledger.positions.reduce(
    (s, p) => s + p.qty * (p.markPriceUsd > 0 ? p.markPriceUsd : p.avgEntryPriceUsd),
    0,
  );
}

/** Cash + open exposure. */
export function equityUsd(ledger: TradingLedger): number {
  return cashBalance(ledger) + exposureUsd(ledger);
}

export function appendEvent(
  ledger: TradingLedger,
  kind: LedgerEventKind,
  message: string,
  meta?: Record<string, unknown>,
  at = Date.now(),
  engine?: LedgerEngine,
): TradingLedger {
  return {
    ...ledger,
    events: [
      { id: eid("evt", at), kind, at, message, meta, engine },
      ...ledger.events,
    ].slice(0, 400),
  };
}

function withCash(ledger: TradingLedger, nextCash: number): TradingLedger {
  const cashAccounts = ledger.accounts.filter((a) => a.kind === "cash");
  if (!cashAccounts.length) {
    return {
      ...ledger,
      accounts: [
        ...ledger.accounts,
        {
          id: eid("acct", Date.now()),
          kind: "cash",
          label: "USD cash",
          balance: Math.max(0, nextCash),
        },
      ],
    };
  }
  let remaining = nextCash;
  const accounts = ledger.accounts.map((a) => {
    if (a.kind !== "cash") return a;
    if (a.id === cashAccounts[0].id) {
      const bal = Math.max(0, remaining);
      remaining = 0;
      return { ...a, balance: bal };
    }
    return { ...a, balance: 0 };
  });
  return { ...ledger, accounts };
}

export function ledgerOpen(input: {
  ledger: TradingLedger;
  instrumentId: string;
  symbol: string;
  qty: number;
  priceUsd: number;
  feeUsd?: number;
  engine: LedgerEngine;
  at?: number;
  note?: string;
}): { ledger: TradingLedger; ok: boolean; reason?: string } {
  const at = input.at ?? Date.now();
  const fee = Math.max(0, input.feeUsd ?? 0);
  const qty = input.qty;
  const price = input.priceUsd;
  if (!(qty > 0) || !(price > 0)) {
    return { ledger: input.ledger, ok: false, reason: "Invalid qty/price" };
  }
  const notional = qty * price;
  const cash = cashBalance(input.ledger);
  if (notional + fee > cash + 1e-9) {
    return {
      ledger: input.ledger,
      ok: false,
      reason: `Insufficient ledger cash (need $${(notional + fee).toFixed(2)}, have $${cash.toFixed(2)})`,
    };
  }

  const orderId = eid("ord", at);
  const existing = input.ledger.positions.find((p) => p.instrumentId === input.instrumentId);
  let positions: LedgerPosition[];
  if (existing) {
    const newQty = existing.qty + qty;
    const avg =
      newQty > 0
        ? (existing.avgEntryPriceUsd * existing.qty + price * qty) / newQty
        : price;
    positions = input.ledger.positions.map((p) =>
      p.instrumentId === input.instrumentId
        ? {
            ...p,
            qty: newQty,
            avgEntryPriceUsd: avg,
            markPriceUsd: price,
            updatedAt: at,
            engine: input.engine,
          }
        : p,
    );
  } else {
    positions = [
      {
        instrumentId: input.instrumentId,
        symbol: input.symbol,
        qty,
        avgEntryPriceUsd: price,
        realizedPnlUsd: 0,
        openedAt: at,
        updatedAt: at,
        engine: input.engine,
        markPriceUsd: price,
      },
      ...input.ledger.positions,
    ];
  }

  const openOrder: LedgerOrder = {
    id: orderId,
    side: "buy",
    instrumentId: input.instrumentId,
    symbol: input.symbol,
    qty,
    limitPriceUsd: price,
    status: "filled",
    createdAt: at,
    updatedAt: at,
    engine: input.engine,
  };
  const openFill: LedgerFill = {
    id: eid("fill", at),
    orderId,
    instrumentId: input.instrumentId,
    symbol: input.symbol,
    side: "buy",
    qty,
    priceUsd: price,
    feeUsd: fee,
    filledAt: at,
    engine: input.engine,
    notionalUsd: notional,
  };

  let ledger: TradingLedger = {
    ...input.ledger,
    positions,
    orders: [openOrder, ...input.ledger.orders].slice(0, 200),
    fills: [openFill, ...input.ledger.fills].slice(0, 300),
  };
  ledger = withCash(ledger, cash - notional - fee);
  ledger = appendEvent(
    ledger,
    "position_opened",
    input.note ??
      `[${input.engine}] OPEN ${input.symbol} qty ${qty.toPrecision(6)} @ $${price.toPrecision(6)} ($${notional.toFixed(2)})`,
    {
      instrumentId: input.instrumentId,
      qty,
      priceUsd: price,
      notionalUsd: notional,
      engine: input.engine,
    },
    at,
    input.engine,
  );
  return { ledger, ok: true };
}

export function ledgerClose(input: {
  ledger: TradingLedger;
  instrumentId: string;
  qty?: number;
  priceUsd: number;
  feeUsd?: number;
  engine: LedgerEngine;
  at?: number;
  note?: string;
  reason?: string;
}): { ledger: TradingLedger; ok: boolean; reason?: string; pnlUsd?: number } {
  const at = input.at ?? Date.now();
  const pos = input.ledger.positions.find((p) => p.instrumentId === input.instrumentId);
  if (!pos || pos.qty <= 0) {
    return { ledger: input.ledger, ok: false, reason: "No open ledger position" };
  }
  const price = input.priceUsd;
  if (!(price > 0)) {
    return { ledger: input.ledger, ok: false, reason: "Invalid exit price" };
  }
  const qty = Math.min(pos.qty, input.qty ?? pos.qty);
  const fee = Math.max(0, input.feeUsd ?? 0);
  const proceeds = qty * price;
  const cost = qty * pos.avgEntryPriceUsd;
  const pnl = proceeds - cost - fee;
  const remainingQty = pos.qty - qty;

  const positions =
    remainingQty > 1e-12
      ? input.ledger.positions.map((p) =>
          p.instrumentId === input.instrumentId
            ? {
                ...p,
                qty: remainingQty,
                realizedPnlUsd: p.realizedPnlUsd + pnl,
                markPriceUsd: price,
                updatedAt: at,
              }
            : p,
        )
      : input.ledger.positions.filter((p) => p.instrumentId !== input.instrumentId);

  const orderId = eid("ord", at);
  const closeOrder: LedgerOrder = {
    id: orderId,
    side: "sell",
    instrumentId: input.instrumentId,
    symbol: pos.symbol,
    qty,
    limitPriceUsd: price,
    status: "filled",
    createdAt: at,
    updatedAt: at,
    engine: input.engine,
  };
  const closeFill: LedgerFill = {
    id: eid("fill", at),
    orderId,
    instrumentId: input.instrumentId,
    symbol: pos.symbol,
    side: "sell",
    qty,
    priceUsd: price,
    feeUsd: fee,
    filledAt: at,
    engine: input.engine,
    notionalUsd: proceeds,
  };
  let ledger: TradingLedger = {
    ...input.ledger,
    positions,
    orders: [closeOrder, ...input.ledger.orders].slice(0, 200),
    fills: [closeFill, ...input.ledger.fills].slice(0, 300),
  };
  ledger = withCash(ledger, cashBalance(ledger) + proceeds - fee);
  ledger = appendEvent(
    ledger,
    "position_closed",
    input.note ??
      `[${input.engine}] CLOSE ${pos.symbol} qty ${qty.toPrecision(6)} @ $${price.toPrecision(6)} PnL ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}${input.reason ? ` (${input.reason})` : ""}`,
    {
      instrumentId: input.instrumentId,
      qty,
      priceUsd: price,
      pnlUsd: pnl,
      reason: input.reason,
      engine: input.engine,
    },
    at,
    input.engine,
  );
  return { ledger, ok: true, pnlUsd: pnl };
}

export function ledgerDeposit(
  ledger: TradingLedger,
  amount: number,
  at = Date.now(),
  engine: LedgerEngine = "system",
): TradingLedger {
  if (!(amount > 0)) return ledger;
  let next = withCash(ledger, cashBalance(ledger) + amount);
  next = appendEvent(
    next,
    "cash_deposit",
    `[${engine}] Deposit $${amount.toFixed(2)}`,
    { amount },
    at,
    engine,
  );
  return next;
}

export function ledgerWithdraw(
  ledger: TradingLedger,
  amount: number,
  at = Date.now(),
  engine: LedgerEngine = "system",
): { ledger: TradingLedger; ok: boolean; reason?: string } {
  if (!(amount > 0)) return { ledger, ok: false, reason: "Amount must be positive" };
  const cash = cashBalance(ledger);
  if (amount > cash + 1e-9) {
    return { ledger, ok: false, reason: "Insufficient cash" };
  }
  let next = withCash(ledger, cash - amount);
  next = appendEvent(
    next,
    "cash_withdraw",
    `[${engine}] Withdraw $${amount.toFixed(2)}`,
    { amount },
    at,
    engine,
  );
  return { ledger: next, ok: true };
}

export function ledgerMark(
  ledger: TradingLedger,
  prices: Record<string, number>,
  at = Date.now(),
): TradingLedger {
  return {
    ...ledger,
    positions: ledger.positions.map((p) => {
      const px = prices[p.instrumentId];
      if (!(typeof px === "number" && px > 0)) return p;
      return { ...p, markPriceUsd: px, updatedAt: at };
    }),
  };
}

export function syncLedgerFromBook(
  book: {
    cash: number;
    positions: Array<{
      tokenId: string;
      symbol: string;
      qty: number;
      entryPrice: number;
      mark: number;
      openedAt: number;
    }>;
  },
  previous: TradingLedger,
  at = Date.now(),
  engine: LedgerEngine = "system",
): TradingLedger {
  const positions: LedgerPosition[] = book.positions.map((p) => ({
    instrumentId: p.tokenId,
    symbol: p.symbol,
    qty: p.qty,
    avgEntryPriceUsd: p.entryPrice,
    realizedPnlUsd: 0,
    openedAt: p.openedAt,
    updatedAt: at,
    engine,
    markPriceUsd: p.mark > 0 ? p.mark : p.entryPrice,
  }));
  let ledger: TradingLedger = {
    ...previous,
    positions,
    accounts: [
      {
        id: previous.accounts.find((a) => a.kind === "cash")?.id ?? eid("acct", at),
        kind: "cash",
        label: "USD cash",
        balance: Math.max(0, book.cash),
      },
    ],
  };
  ledger = appendEvent(
    ledger,
    "sync",
    `[${engine}] Ledger synced to book — cash $${book.cash.toFixed(2)}, ${positions.length} open`,
    { cash: book.cash, open: positions.length },
    at,
    engine,
  );
  return ledger;
}
