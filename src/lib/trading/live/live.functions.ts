/**
 * Server functions for live execution. These are the ONLY entry points that can
 * reach a venue, so all credential handling and the authoritative guardrail
 * check happen here — the browser never sees an API key.
 */
import { createServerFn } from "@tanstack/react-start";
import { buildLiveStatus, liveConfigured, liveGuardrails, resolveLiveProvider } from "./cex";
import { checkLiveGuardrails } from "./guardrails";
import type { LiveOrderRequest, LiveOrderResult, LiveStatus } from "./types";

export const getLiveStatus = createServerFn({ method: "GET" }).handler(async (): Promise<LiveStatus> => {
  return buildLiveStatus();
});

type PlaceLiveOrderInput = LiveOrderRequest & {
  /** Realized P&L today (USD) reported by the desk — used only to trip the cap. */
  realizedTodayUsd: number;
  openPositions: number;
};

export const placeLiveOrder = createServerFn({ method: "POST" })
  .validator((input: PlaceLiveOrderInput): PlaceLiveOrderInput => {
    if (!input || typeof input !== "object") throw new Error("Live order payload is required.");
    const strings = [input.symbol, input.clientId];
    if (strings.some((v) => typeof v !== "string" || v.trim() === "")) {
      throw new Error("Live order requires a symbol and a client id.");
    }
    if (input.side !== "buy" && input.side !== "sell") throw new Error("Live order side must be buy or sell.");
    const nums = [input.notionalUsd, input.priceUsd, input.qty, input.realizedTodayUsd, input.openPositions];
    if (nums.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
      throw new Error("Live order requires finite numeric fields.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<LiveOrderResult> => {
    if (!liveConfigured()) {
      return { ok: false, reason: "Live execution is not configured on the server (no CEX API key).", retriable: false };
    }
    const verdict = checkLiveGuardrails(liveGuardrails(), {
      symbol: data.symbol,
      side: data.side,
      notionalUsd: data.notionalUsd,
      priceUsd: data.priceUsd,
      realizedTodayUsd: data.realizedTodayUsd,
      openPositions: data.openPositions,
    });
    if (!verdict.allowed) {
      return { ok: false, reason: `${verdict.code}: ${verdict.reason}`, retriable: false };
    }
    try {
      return await resolveLiveProvider().placeOrder({
        symbol: data.symbol,
        side: data.side,
        notionalUsd: data.notionalUsd,
        priceUsd: data.priceUsd,
        qty: data.qty,
        clientId: data.clientId,
      });
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "Live order failed.", retriable: true };
    }
  });
