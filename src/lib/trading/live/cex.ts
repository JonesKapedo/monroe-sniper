/**
 * CEX live-execution adapters (server-only).
 *
 * Signs requests with a venue API key that lives ONLY in server env
 * (`SNIPER_CEX_*`) — never a `VITE_` var, never the browser, never the repo.
 * The whole module is inert until `SNIPER_LIVE_ENABLED=true` AND credentials
 * exist, so importing it cannot place an order by default.
 *
 * Supported: Kraken (HMAC-SHA512 API-Sign), Binance (HMAC-SHA256 signed query),
 * Coinbase Advanced Trade (ES256 JWT). Before trusting real size on any venue,
 * run a minimum-size live smoke against the account — pair/product mapping and
 * order shape are wired but unproven with real funds.
 */
import { createHash, createHmac, createSign } from "node:crypto";
import {
  DEFAULT_LIVE_GUARDRAILS,
  liveGuardrailsFromEnv,
  type LiveGuardrailsConfig,
} from "./guardrails";
import type { LiveBalance, LiveOrderRequest, LiveOrderResult, LiveProvider, LiveStatus, LiveVenue } from "./types";

const TIMEOUT_MS = 12_000;

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function liveEnabled(): boolean {
  return env("SNIPER_LIVE_ENABLED") === "true";
}

export function cexVenue(): LiveVenue {
  const v = env("SNIPER_CEX_VENUE")?.toLowerCase();
  return v === "kraken" || v === "binance" || v === "coinbase" ? v : "disabled";
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

export function venueLabel(venue: LiveVenue): string {
  return venue === "kraken" ? "Kraken" : venue === "binance" ? "Binance" : venue === "coinbase" ? "Coinbase" : "None";
}

// ── Kraken ───────────────────────────────────────────────────────────────────

export function krakenPair(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const aliases: Record<string, string> = { SOL: "SOLUSD", USDC: "USDCUSD", BTC: "XBTUSD", ETH: "ETHUSD" };
  if (aliases[s]) return aliases[s];
  return s.endsWith("USD") ? s : `${s}USD`;
}

/** Pure, testable Kraken API-Sign (HMAC-SHA512). */
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
  const res = await fetch(`https://api.kraken.com${path}`, {
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

const krakenProvider: LiveProvider = {
  id: "kraken",
  label: "Kraken",
  configured: () => liveConfigured() && cexVenue() === "kraken",
  async balances(): Promise<LiveBalance[]> {
    const result = await krakenPrivate("/0/private/Balance", {});
    return Object.entries(result).map(([asset, total]) => ({ asset, total: Number(total) || 0, free: Number(total) || 0 }));
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
    return { ok: true, venue: "kraken", venueOrderId: txid || "submitted", filledQty: req.qty, avgPriceUsd: req.priceUsd, at: Date.now() };
  },
};

// ── Binance ──────────────────────────────────────────────────────────────────

export function binanceSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const aliases: Record<string, string> = { SOL: "SOLUSDT", USDC: "USDCUSDT", BTC: "BTCUSDT", ETH: "ETHUSDT" };
  if (aliases[s]) return aliases[s];
  return s.endsWith("USDT") || s.endsWith("USD") ? s : `${s}USDT`;
}

/** Pure, testable Binance signed-query signature (HMAC-SHA256 hex). */
export function binanceSign(query: string, secret: string): string {
  return createHmac("sha256", secret).update(query).digest("hex");
}

async function binanceSigned(method: "GET" | "POST", path: string, params: Record<string, string>): Promise<unknown> {
  const creds = cexCredentials();
  if (!creds) throw new Error("Binance credentials are not configured.");
  const base = env("SNIPER_BINANCE_BASE") ?? "https://api.binance.com";
  const qs = new URLSearchParams({ ...params, timestamp: String(Date.now()), recvWindow: "5000" }).toString();
  const signature = binanceSign(qs, creds.secret);
  const res = await fetch(`${base}${path}?${qs}&signature=${signature}`, {
    method,
    headers: { "X-MBX-APIKEY": creds.key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json()) as { code?: number; msg?: string };
  if (json.code !== undefined && json.code !== 200) throw new Error(`Binance: ${json.msg ?? json.code}`);
  return json;
}

const binanceProvider: LiveProvider = {
  id: "binance",
  label: "Binance",
  configured: () => liveConfigured() && cexVenue() === "binance",
  async balances(): Promise<LiveBalance[]> {
    const account = (await binanceSigned("GET", "/api/v3/account", {})) as { balances?: { asset?: string; free?: string }[] };
    return (account.balances ?? []).map((b) => ({ asset: String(b.asset ?? ""), total: Number(b.free) || 0, free: Number(b.free) || 0 }));
  },
  async placeOrder(req: LiveOrderRequest): Promise<LiveOrderResult> {
    const result = (await binanceSigned("POST", "/api/v3/order", {
      symbol: binanceSymbol(req.symbol),
      side: req.side.toUpperCase(),
      type: "MARKET",
      quantity: String(req.qty),
      newClientOrderId: req.clientId.slice(0, 32),
    })) as { orderId?: number; executedQty?: string; fills?: { price?: string }[] };
    const fills = result.fills ?? [];
    const avg = fills.length ? fills.reduce((s, f) => s + (Number(f.price) || 0), 0) / fills.length : req.priceUsd;
    return { ok: true, venue: "binance", venueOrderId: String(result.orderId ?? "submitted"), filledQty: Number(result.executedQty) || req.qty, avgPriceUsd: avg, at: Date.now() };
  },
};

// ── Coinbase Advanced Trade ───────────────────────────────────────────────────

export function coinbaseProduct(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const aliases: Record<string, string> = { SOL: "SOL-USD", USDC: "USDC-USD", BTC: "BTC-USD", ETH: "ETH-USD" };
  if (aliases[s]) return aliases[s];
  return s.includes("-") ? s : s.endsWith("USD") ? `${s.replace(/USD$/, "")}-USD` : `${s}-USD`;
}

/** Pure, testable Coinbase Advanced Trade JWT (ES256). */
export function coinbaseJwt(keyName: string, privateKeyPem: string, method: string, path: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const enc = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${enc({ alg: "ES256", typ: "JWT", kid: keyName })}.${enc({
    sub: keyName,
    iss: "cdp",
    nbf: iat,
    exp: iat + 120,
    uri: `${method} ${path}`,
  })}`;
  const sig = createSign("SHA256").update(signingInput).sign(privateKeyPem);
  return `${signingInput}.${sig.toString("base64url")}`;
}

async function coinbaseSigned(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const creds = cexCredentials();
  if (!creds) throw new Error("Coinbase credentials are not configured.");
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${coinbaseJwt(creds.key, creds.secret, method, path)}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json()) as { error?: string; message?: string };
  if (!res.ok || json.error) throw new Error(`Coinbase: ${json.message ?? json.error ?? res.status}`);
  return json;
}

const coinbaseProvider: LiveProvider = {
  id: "coinbase",
  label: "Coinbase",
  configured: () => liveConfigured() && cexVenue() === "coinbase",
  async balances(): Promise<LiveBalance[]> {
    const data = (await coinbaseSigned("GET", "/api/v3/brokerage/accounts")) as {
      accounts?: { currency?: string; available_balance?: { value?: string } }[];
    };
    return (data.accounts ?? []).map((a) => {
      const total = Number(a.available_balance?.value) || 0;
      return { asset: String(a.currency ?? ""), total, free: total };
    });
  },
  async placeOrder(req: LiveOrderRequest): Promise<LiveOrderResult> {
    const data = (await coinbaseSigned("POST", "/api/v3/brokerage/orders", {
      client_order_id: req.clientId.slice(0, 36),
      product_id: coinbaseProduct(req.symbol),
      side: req.side.toUpperCase(),
      order_configuration: { market_market_ioc: { base_size: String(req.qty) } },
    })) as { success?: boolean; order_id?: string; error_response?: { message?: string } };
    if (data.success === false) throw new Error(`Coinbase: ${data.error_response?.message ?? "order rejected"}`);
    return { ok: true, venue: "coinbase", venueOrderId: data.order_id ?? "submitted", filledQty: req.qty, avgPriceUsd: req.priceUsd, at: Date.now() };
  },
};

// ── Registry ─────────────────────────────────────────────────────────────────

const REGISTRY: Record<Exclude<LiveVenue, "disabled">, LiveProvider> = {
  kraken: krakenProvider,
  binance: binanceProvider,
  coinbase: coinbaseProvider,
};

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

/** The active provider: the configured venue adapter, otherwise a no-op. */
export function resolveLiveProvider(): LiveProvider {
  const venue = cexVenue();
  if (!liveConfigured() || venue === "disabled") return disabledProvider;
  return REGISTRY[venue] ?? disabledProvider;
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
      : `Armed: ${venueLabel(venue)} (server-signed). Orders pass guardrails before submission.`;
  return {
    enabled,
    venue,
    venueLabel: venueLabel(venue),
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
