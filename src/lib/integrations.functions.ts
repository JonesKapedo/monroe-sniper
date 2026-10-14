import { createServerFn } from "@tanstack/react-start";
import { parseRssItems } from "./events/corp";

/**
 * Real third-party integrations. Credentials are verify-on-use: the browser
 * holds the user's own keys (localStorage, personal app) and passes them per
 * call — the server never stores them, and every connection is verified with
 * a live API round-trip before it counts as connected.
 */

async function getJson(url: string, headers: Record<string, string>, ms = 8000): Promise<{ ok: boolean; status: number; body: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Request failed");
  } finally {
    clearTimeout(timer);
  }
}

function record(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ---------------- Telegram (free Bot API) ---------------- */

export const verifyTelegramBot = createServerFn({ method: "POST" })
  .validator((input: { token?: string }) => ({ token: String(input?.token ?? "").trim() }))
  .handler(async ({ data }): Promise<{ ok: boolean; username: string | null; note: string }> => {
    if (!data.token) return { ok: false, username: null, note: "Bot token is required" };
    try {
      const res = await getJson(`https://api.telegram.org/bot${encodeURIComponent(data.token)}/getMe`, {}, 8000);
      const result = record(record(res.body).result);
      if (res.ok && typeof result.username === "string") {
        return { ok: true, username: `@${result.username}`, note: `Verified bot ${result.username}` };
      }
      return { ok: false, username: null, note: "Telegram rejected the token — check it in BotFather" };
    } catch (error) {
      return { ok: false, username: null, note: error instanceof Error ? error.message : "Telegram unreachable" };
    }
  });

export const sendTelegramAlert = createServerFn({ method: "POST" })
  .validator((input: { token?: string; chatId?: string; text?: string }) => ({
    token: String(input?.token ?? "").trim(),
    chatId: String(input?.chatId ?? "").trim().slice(0, 64),
    text: String(input?.text ?? "").slice(0, 1000),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean; note: string }> => {
    if (!data.token || !data.chatId || !data.text) return { ok: false, note: "Token, chat id, and text are required" };
    try {
      const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(data.token)}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: data.chatId, text: data.text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { ok: false, note: `Telegram HTTP ${res.status} — verify the chat id (message the bot first)` };
      return { ok: true, note: "Alert delivered" };
    } catch (error) {
      return { ok: false, note: error instanceof Error ? error.message : "Telegram unreachable" };
    }
  });

/* ---------------- X / Twitter (bring-your-own bearer token) ---------------- */

export type XMentionSample = {
  id: string;
  text: string;
  likes: number;
  reposts: number;
  replies: number;
  createdAt: string | null;
};

export function parseXSearch(payload: unknown): XMentionSample[] {
  const data = Array.isArray(record(payload).data) ? (record(payload).data as unknown[]) : [];
  return data.slice(0, 10).map((row) => {
    const r = record(row);
    const pm = record(r.public_metrics);
    return {
      id: String(r.id ?? ""),
      text: typeof r.text === "string" ? r.text.slice(0, 280) : "",
      likes: num(pm.like_count) ?? 0,
      reposts: num(pm.retweet_count) ?? 0,
      replies: num(pm.reply_count) ?? 0,
      createdAt: typeof r.created_at === "string" ? r.created_at : null,
    };
  }).filter((m) => m.id && m.text);
}

export const verifyXToken = createServerFn({ method: "POST" })
  .validator((input: { token?: string }) => ({ token: String(input?.token ?? "").trim() }))
  .handler(async ({ data }): Promise<{ ok: boolean; username: string | null; note: string }> => {
    if (!data.token) return { ok: false, username: null, note: "Bearer token is required" };
    try {
      const res = await getJson("https://api.x.com/2/users/me", { Authorization: `Bearer ${data.token}` }, 8000);
      const username = record(res.body).username ?? record(record(res.body).data).username;
      if (res.ok && typeof username === "string") {
        return { ok: true, username: `@${username}`, note: `Verified as @${username}` };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, username: null, note: "X rejected the token (401/403) — check access level" };
      }
      return { ok: false, username: null, note: `X HTTP ${res.status}` };
    } catch (error) {
      return { ok: false, username: null, note: error instanceof Error ? error.message : "X unreachable" };
    }
  });

export const fetchXSearch = createServerFn({ method: "POST" })
  .validator((input: { token?: string; query?: string }) => ({
    token: String(input?.token ?? "").trim(),
    query: String(input?.query ?? "").trim().slice(0, 128),
  }))
  .handler(async ({ data }): Promise<{ mentions: XMentionSample[]; note: string }> => {
    if (!data.token || !data.query) return { mentions: [], note: "Token and query are required" };
    try {
      const res = await getJson(
        `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(data.query)}&max_results=10&tweet.fields=public_metrics,created_at`,
        { Authorization: `Bearer ${data.token}` },
        9000,
      );
      if (!res.ok) {
        return { mentions: [], note: res.status === 429 ? "X rate limit hit — try again shortly" : `X HTTP ${res.status}` };
      }
      const mentions = parseXSearch(res.body);
      return { mentions, note: `${mentions.length} recent posts for "${data.query}"` };
    } catch (error) {
      return { mentions: [], note: error instanceof Error ? error.message : "X search failed" };
    }
  });

/* ---------------- LunarCrush (free API key tier) ---------------- */

export type LunarSocial = {
  symbol: string;
  galaxyScore: number | null;
  altRank: number | null;
  socialVolume24h: number | null;
  socialContributors: number | null;
  sentimentPct: number | null;
};

export function parseLunarCoin(payload: unknown, symbol: string): LunarSocial | null {
  const data = record(record(payload).data);
  if (!Object.keys(data).length) return null;
  return {
    symbol,
    galaxyScore: num(data.galaxy_score),
    altRank: num(data.alt_rank),
    socialVolume24h: num(data.social_volume_24h),
    socialContributors: num(data.social_contributors),
    sentimentPct: num(data.sentiment),
  };
}

export const verifyLunarcrushKey = createServerFn({ method: "POST" })
  .validator((input: { key?: string }) => ({ key: String(input?.key ?? "").trim() }))
  .handler(async ({ data }): Promise<{ ok: boolean; note: string }> => {
    if (!data.key) return { ok: false, note: "API key is required" };
    try {
      const res = await getJson("https://lunarcrush.com/api4/public/coins/list/v1", { Authorization: `Bearer ${data.key}` }, 8000);
      if (res.ok) return { ok: true, note: "LunarCrush key verified" };
      if (res.status === 401 || res.status === 403) return { ok: false, note: "LunarCrush rejected the key (401/403)" };
      return { ok: false, note: `LunarCrush HTTP ${res.status}` };
    } catch (error) {
      return { ok: false, note: error instanceof Error ? error.message : "LunarCrush unreachable" };
    }
  });

export const fetchLunarSocial = createServerFn({ method: "POST" })
  .validator((input: { key?: string; symbol?: string }) => ({
    key: String(input?.key ?? "").trim(),
    symbol: String(input?.symbol ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12),
  }))
  .handler(async ({ data }): Promise<{ social: LunarSocial | null; note: string }> => {
    if (!data.key || !data.symbol) return { social: null, note: "Key and symbol are required" };
    try {
      const res = await getJson(
        `https://lunarcrush.com/api4/public/coins/${encodeURIComponent(data.symbol)}/v1`,
        { Authorization: `Bearer ${data.key}` },
        9000,
      );
      if (!res.ok) return { social: null, note: `LunarCrush HTTP ${res.status}` };
      const social = parseLunarCoin(res.body, data.symbol);
      return { social, note: social ? `Live LunarCrush metrics for ${data.symbol}` : `No LunarCrush data for ${data.symbol}` };
    } catch (error) {
      return { social: null, note: error instanceof Error ? error.message : "LunarCrush fetch failed" };
    }
  });

/* ---------------- Custom RSS + news wire ---------------- */

export const verifyRssFeed = createServerFn({ method: "POST" })
  .validator((input: { url?: string }) => ({ url: String(input?.url ?? "").trim().slice(0, 300) }))
  .handler(async ({ data }): Promise<{ ok: boolean; count: number; latest: string | null; note: string }> => {
    if (!/^https?:\/\//i.test(data.url)) return { ok: false, count: 0, latest: null, note: "URL must start with http(s)://" };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(data.url, { headers: { Accept: "application/rss+xml, application/xml, text/xml" }, signal: ctrl.signal });
      if (!res.ok) return { ok: false, count: 0, latest: null, note: `Feed HTTP ${res.status}` };
      const items = parseRssItems(await res.text());
      if (!items.length) return { ok: false, count: 0, latest: null, note: "No feed items found at that URL" };
      return { ok: true, count: items.length, latest: items[0].title, note: `Verified — ${items.length} items, latest: ${items[0].title.slice(0, 80)}` };
    } catch (error) {
      return { ok: false, count: 0, latest: null, note: error instanceof Error ? error.message : "Feed unreachable" };
    } finally {
      clearTimeout(timer);
    }
  });

export type NewsItem = { title: string; link: string | null; source: string; publishedAt: number | null };

const NEWS_WIRES = [
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
];

let wireCache: { at: number; items: NewsItem[] } | null = null;
const WIRE_CACHE_MS = 5 * 60_000;

/** Live crypto headlines for the Decrypt wire panel (cached 5 min). */
export const loadNewsWire = createServerFn({ method: "GET" }).handler(async (): Promise<{
  items: NewsItem[];
  note: string;
}> => {
  if (wireCache && Date.now() - wireCache.at < WIRE_CACHE_MS) {
    return { items: wireCache.items, note: "News wire (cached)" };
  }
  const items: NewsItem[] = [];
  for (const wire of NEWS_WIRES) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const res = await fetch(wire.url, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
        signal: ctrl.signal,
      });
      if (!res.ok) continue;
      for (const item of parseRssItems(await res.text()).slice(0, 6)) {
        items.push({ title: item.title, link: item.link, source: wire.source, publishedAt: item.publishedAt });
      }
    } catch {
      // One dead wire never sinks the panel.
    } finally {
      clearTimeout(timer);
    }
  }
  items.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  const result = items.slice(0, 8);
  wireCache = { at: Date.now(), items: result };
  return { items: result, note: result.length ? `Live wires · ${result.length} headlines` : "News wires unreachable" };
});
