/**
 * Shapes for real (non-simulated) execution.
 *
 * The desk trades through a venue-agnostic `LiveProvider`. The only concrete
 * provider today is a CEX REST adapter (`./cex.ts`) that signs server-side with
 * an API key — the browser wallet stays read-only. Every provider is inert
 * unless the live env is explicitly enabled AND credentials are present, so
 * nothing here can move funds by default.
 */

export type LiveVenue = "disabled" | "kraken";

export type LiveSide = "buy" | "sell";

export type LiveOrderRequest = {
  /** Venue-native pair, e.g. "BONKUSD". */
  symbol: string;
  side: LiveSide;
  /** Reference notional in USD — the provider must not exceed it. */
  notionalUsd: number;
  /** Reference price in USD (for qty + post-fill accounting). */
  priceUsd: number;
  /** Quantity to transact (venue base units, already sized by the desk). */
  qty: number;
  /** Idempotency key so a retried call cannot double-fill. */
  clientId: string;
};

export type LiveOrderResult =
  | { ok: true; venue: string; venueOrderId: string; filledQty: number; avgPriceUsd: number; at: number }
  | { ok: false; reason: string; retriable: boolean };

export type LiveBalance = { asset: string; free: number; total: number };

export type LiveProvider = {
  id: LiveVenue;
  label: string;
  /** True only when this provider is enabled and fully credentialed. */
  configured: () => boolean;
  balances: () => Promise<LiveBalance[]>;
  placeOrder: (req: LiveOrderRequest) => Promise<LiveOrderResult>;
};

/** Public, secret-free status for the UI. */
export type LiveStatus = {
  enabled: boolean;
  venue: LiveVenue;
  venueLabel: string;
  configured: boolean;
  /** Why live execution is unavailable, when it is. */
  note: string;
  caps: {
    maxNotionalUsd: number;
    dailyLossLimitUsd: number;
    maxOpenPositions: number;
    allowlist: string[];
  };
};
