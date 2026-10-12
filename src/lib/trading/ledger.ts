/**
 * Canonical trading ledger types.
 * Intended as the shared book for stock-desk paper and Scanner paper,
 * and later for live execution reconciliation.
 */

export type LedgerAccountKind = "cash" | "position" | "pnl";

export type LedgerAccount = {
  id: string;
  kind: LedgerAccountKind;
  /** Human label, e.g. "USD cash" or "TOKEN:eth:0xabc". */
  label: string;
  /** Balance in account units (USD for cash/pnl, tokens for position). */
  balance: number;
};

export type OrderSide = "buy" | "sell";
export type OrderStatus = "pending" | "filled" | "partial" | "cancelled" | "rejected";

export type LedgerOrder = {
  id: string;
  side: OrderSide;
  /** Token or instrument id. */
  instrumentId: string;
  symbol: string;
  qty: number;
  limitPriceUsd: number | null;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  clientTag?: string;
};

export type LedgerFill = {
  id: string;
  orderId: string;
  instrumentId: string;
  side: OrderSide;
  qty: number;
  priceUsd: number;
  feeUsd: number;
  filledAt: number;
};

export type LedgerPosition = {
  instrumentId: string;
  symbol: string;
  qty: number;
  avgEntryPriceUsd: number;
  realizedPnlUsd: number;
  openedAt: number;
  updatedAt: number;
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
  | "note";

export type LedgerEvent = {
  id: string;
  kind: LedgerEventKind;
  at: number;
  message: string;
  meta?: Record<string, unknown>;
};

export type TradingLedger = {
  version: 1;
  accounts: LedgerAccount[];
  orders: LedgerOrder[];
  fills: LedgerFill[];
  positions: LedgerPosition[];
  events: LedgerEvent[];
};

function eid(prefix: string, at: number): string {
  return `${prefix}-${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyLedger(): TradingLedger {
  return {
    version: 1,
    accounts: [],
    orders: [],
    fills: [],
    positions: [],
    events: [],
  };
}

export function createPaperAccount(cashUsd: number, at = Date.now()): TradingLedger {
  const ledger = createEmptyLedger();
  ledger.accounts.push({
    id: eid("acct", at),
    kind: "cash",
    label: "USD cash",
    balance: Math.max(0, cashUsd),
  });
  ledger.events.push({
    id: eid("evt", at),
    kind: "cash_deposit",
    at,
    message: `Seeded paper cash $${cashUsd.toFixed(2)}`,
  });
  return ledger;
}

export function cashBalance(ledger: TradingLedger): number {
  return ledger.accounts
    .filter(a => a.kind === "cash")
    .reduce((s, a) => s + a.balance, 0);
}

export function appendEvent(
  ledger: TradingLedger,
  kind: LedgerEventKind,
  message: string,
  meta?: Record<string, unknown>,
  at = Date.now(),
): TradingLedger {
  return {
    ...ledger,
    events: [
      ...ledger.events,
      { id: eid("evt", at), kind, at, message, meta },
    ],
  };
}
