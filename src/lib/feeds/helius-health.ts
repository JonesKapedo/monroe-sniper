/**
 * Helius RPC feed health — app-side half of the FeedRegistry (Blueprint P3).
 *
 * The desk's Solana/whale feed depends on the Helius mainnet RPC. This module
 * is the in-app equivalent of scripts/helius_probe.py: it verifies the RPC
 * is reachable, responsive, and returning live slots, so the feed layer can
 * fail over instead of stalling (the "Binance down" class of failure).
 *
 * The API key NEVER lives in code — it is injected via the environment
 * (HELIUS_API_KEY) at deploy time (Vercel → Project → Settings → Env Vars).
 * Any key pasted into chat or committed must be treated as burned: rotate it
 * in the Helius dashboard.
 */

export interface HeliusHealth {
  ok: boolean;
  slot: number | null;
  latencyMs: number | null;
  /** "alive" | "slow" | "down" | "no-key" */
  status: "alive" | "slow" | "down" | "no-key";
  detail: string;
}

export const HELIUS_LATENCY_BUDGET_MS = 2000;

/**
 * Health verdict from a getSlot result — pure, unit-testable.
 * Mirrors the Python probe's verdict(): live slot under budget = alive;
 * live slot over budget = slow (still reachable, flagged); zero/missing
 * slot = down; missing key = configuration error, not an outage.
 */
export function heliusHealthVerdict(
  apiKey: string | undefined,
  slot: number | null,
  latencyMs: number | null,
): HeliusHealth {
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      ok: false,
      slot: null,
      latencyMs: null,
      status: "no-key",
      detail: "HELIUS_API_KEY not configured — set it in the environment, never in code.",
    };
  }
  if (slot === null || slot <= 0) {
    return {
      ok: false,
      slot,
      latencyMs,
      status: "down",
      detail: "RPC returned a non-positive slot — feed is not advancing.",
    };
  }
  if (latencyMs !== null && latencyMs > HELIUS_LATENCY_BUDGET_MS) {
    return {
      ok: true,
      slot,
      latencyMs,
      status: "slow",
      detail: `Slot ${slot} reachable, but ${Math.round(latencyMs)}ms exceeds the ${HELIUS_LATENCY_BUDGET_MS}ms budget.`,
    };
  }
  return {
    ok: true,
    slot,
    latencyMs,
    status: "alive",
    detail: `Slot ${slot} — Helius RPC healthy.`,
  };
}

/**
 * Probe the Helius RPC with the in-app JSON-RPC client (fetch), so the app
 * never depends on solana-py. Retries with backoff, exactly like the Python
 * probe. Returns the structured health for the feed registry.
 */
export async function probeHeliusRpc(
  apiKey: string | undefined,
  opts: { timeoutMs?: number; attempts?: number } = {},
): Promise<HeliusHealth> {
  if (!apiKey || apiKey.trim().length === 0) {
    return heliusHealthVerdict(undefined, null, null);
  }
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const attempts = opts.attempts ?? 3;
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey.trim()}`;
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" });

  let lastError: string = "unknown";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": " integration/json" },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
      } else {
        const json = (await res.json()) as { result?: number };
        const latency = performance.now() - t0;
        return heliusHealthVerdict(apiKey, Number.isFinite(json.result) ? json.result : null, latency);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < attempts) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return {
    ok: false,
    slot: null,
    latencyMs: null,
    status: "down",
    detail: `Unreachable after ${attempts} attempts (${lastError}).`,
  };
}
