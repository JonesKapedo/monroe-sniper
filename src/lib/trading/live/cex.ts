/**
 * CEX live-execution adapter (server-only).
 *
 * Signs requests with a venue API key that lives ONLY in server env
 * (`SNIPER_CEX_*`) — never a `VITE_` var, never the browser, never the repo.
 * The whole module is inert until `SNIPER_LIVE_ENABLED=true` AND credentials
 * exist, so importing it cannot place an order by default.
 *
 * Kraken is the first (and currently only) venue. The signing scheme is
 * Kraken's documented HMAC-SHA512 API-Sign. Before trusting real size, run a
 * minimum-size live smoke against the account — see the README note added with
 * this feature.
 */
import { createHash, createHmac } from "node:crypto";
import {
  DEFAULT_LIVE_GUARDRAILS,
  liveGuardrailsFromEnv,
  type LiveGuardrailsConfig,
} from "./guardrails";
import type { LiveBalance, LiveOrderRequest, LiveOrderResult, LiveProvider, LiveStatus, LiveVenue } from "./types";

const KRAKEN_BASE = "https://api.kraken.com";
const TIMEOUT_MS = 12_000;

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function liveEnabled(): boolean {
  return env("SNIPER_LIVE_ENABLED") === "true";
}

export function cexVenue(): LiveVenue {
  const v = env("SNIPER_CEX_VENUE")?.toLowerCase();
  return v === "kraken" ? "kraken" : "disabled";
}

function cexCredentials(): { key: string; secret: string } | null {
  const key = env("SNIPER_CEX_API_KEY");
  const secret = env("SNIPER_CEX_API_SECRET");
  return key && secret ? { key, secret } : null;
}

/** Live execution is available only when explicitly enabled and credentialed. */
export function liveConfigured(): boolean {
  return liveEnabled() && cexVenue() !== "disabled" && cexCredentials() !== null;
}

export function liveGuardrails(): LiveGuardrailsConfig {
  return liveGuardrailsFromEnv(process.env);
}

/** Map a desk symbol to a Kraken pair (e.g. BONK -> BONKUSD). */
export function krakenPair(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const aliases: Record<string, string> = { SOL: "SOLUSD", USDC: "USDCUSD", BTC: "XBTUSD", ETH: "ETHUSD" };
  if (aliases[s]) return aliases[s];
  return s.endsWith("USD") ? s : `${s}USD`;
}

/** Pure, testable Kraken API-Sign. */
export function krakenSign(path: string, post: Record<string, string>, secret: string, nonce: number): string {
  const postData = new URLSearchParams({ ...post, nonce: String(nonce) }).toString();
  const sha = createHash("sha256").update(String(nonce) + postData).digest();
  const mac = createHmac("sha512", Buffer.from(secret, "base64"));
  mac.update(Buffer.concat([Buffer.from(path, "utf8"), sha]));
  return mac.digest("base64");
}

async function krakenPrivate(path: string, post: Record<string, string>): Promise<Record<string, unknown>> {
  const creds = cexCredentials();
  if (!creds) throw new Error("Kraken credentials are not configured.");
  const nonce = Date.now();
  const body = new URLSearchParams({ ...post, nonce: String(nonce) }).toString();
  const res = await fetch(`${KRAKEN_BASE}${path}`, {
    method: "POST",
    headers: {
      "API-Key": creds.key,
      "API-Sign": krakenSign(path, post, creds.secret, nonce),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json()) as { error?: string[]; result?: Record<string, unknown> };
  if (json.error?.length) throw new Error(`Kraken: ${json.error.join("; ")}`);
  return json.result ?? {};
}

const disabledProvider: LiveProvider = {
  id: "disabled",
  label: "Live execution disabled",
  configured: () => false,
  async balances() {
    return [];
  },
  async placeOrder(): Promise<LiveOrderResult> {
    return { ok: false, reason: "Live execution is disabled — no CEX API key is configured on the server.", retriable: false };
  },
};

const krakenProvider: LiveProvider = {
  id: "kraken",
  label: "Kraken",
  configured: () => liveConfigured() && cexVenue() === "kraken",
  async balances(): Promise<LiveBalance[]> {
    const result = await krakenPrivate("/0/private/Balance", {});
    return Object.entries(result).map(([asset, total]) => ({
      asset,
      total: Number(total) || 0,
      free: Number(total) || 0,
    }));
  },
  async placeOrder(req: LiveOrderRequest): Promise<LiveOrderResult> {
    const result = await krakenPrivate("/0/private/AddOrder", {
      pair: krakenPair(req.symbol),
      type: req.side,
      ordertype: "market",
      volume: String(req.qty),
      ...(req.clientId ? { userref: req.clientId.slice(0, 32) } : {}),
    });
    const txid = Array.isArray(result.txid) ? String((result.txid as unknown[])[0] ?? "") : "";
    return {
      ok: true,
      venue: "kraken",
      venueOrderId: txid || "submitted",
      filledQty: req.qty,
      avgPriceUsd: req.priceUsd,
      at: Date.now(),
    };
  },
};

/** The active provider: the CEX adapter when credentialed, otherwise a no-op. */
export function resolveLiveProvider(): LiveProvider {
  return krakenProvider.configured() ? krakenProvider : disabledProvider;
}

/** Secret-free status for the client. */
export function buildLiveStatus(): LiveStatus {
  const venue = cexVenue();
  const enabled = liveEnabled();
  const configured = liveConfigured();
  const g = liveGuardrails() ?? DEFAULT_LIVE_GUARDRAILS;
  const note = !enabled
    ? "Live execution is off. Set SNIPER_LIVE_ENABLED=true and add CEX credentials on the server to arm it."
    : !configured
      ? `Live is enabled but no ${venue === "disabled" ? "CEX venue" : venue} credentials are set on the server.`
      : `Armed: ${venue} (server-signed). Orders pass guardrails before submission.`;
  return {
    enabled,
    venue,
    venueLabel: venue === "kraken" ? "Kraken" : "None",
    configured,
    note,
    caps: {
      maxNotionalUsd: g.maxNotionalUsd,
      dailyLossLimitUsd: g.dailyLossLimitUsd,
      maxOpenPositions: g.maxOpenPositions,
      allowlist: g.allowlist,
    },
  };
}
