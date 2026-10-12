/**
 * Spot-order adapter. The shape is here so a host key can be dropped in later.
 * This build never signs or posts an order, even if keys are present.
 */
export type OrderIntent = {
  symbol: string;
  side: "BUY" | "SELL";
  quoteUsd: number;
};

export type ExecutionPreview = {
  ok: false;
  venue: "binance-spot";
  armed: false;
  note: string;
};

export function binanceExecutionStatus(): { configured: boolean; note: string } {
  const key = process.env.BINANCE_API_KEY?.trim();
  const secret = process.env.BINANCE_API_SECRET?.trim();
  if (!key || !secret) {
    return {
      configured: false,
      note: "Binance signing is unwired. Add BINANCE_API_KEY and BINANCE_API_SECRET on the host when you want a live adapter. Orders stay off.",
    };
  }
  return {
    configured: true,
    note: "Keys are present, but this build does not submit Binance orders.",
  };
}

export function previewBinanceOrder(intent: OrderIntent): ExecutionPreview {
  const status = binanceExecutionStatus();
  return {
    ok: false,
    venue: "binance-spot",
    armed: false,
    note: `${status.note} Held ${intent.side} ${intent.symbol} $${intent.quoteUsd.toFixed(2)}.`,
  };
}
