import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { classifyEvent, extractSymbols, parseRssItems, type CorpEventKind, type CorpEventStance } from "./events/corp";

export type CorpEvent = {
  id: string;
  kind: CorpEventKind;
  title: string;
  source: string;
  url: string | null;
  symbols: string[];
  stance: CorpEventStance;
  publishedAt: number;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Defensive 8-K hit mapping — the SEC schema drifts; never throw on shape. */
function secHitTitle(hit: unknown): { title: string; url: string | null; publishedAt: number | null } | null {
  const h = asRecord(hit);
  const src = asRecord(h._source ?? h);
  const forms: string[] = Array.isArray(src.forms)
    ? src.forms.filter((f): f is string => typeof f === "string")
    : typeof src.form === "string"
      ? [src.form]
      : [];
  if (!forms.some((f) => /8-K/i.test(f))) return null;
  const entity = str(src.entityName) ?? str(src.companyName) ?? str(src.ciks) ?? "Reporting company";
  const filed = str(src.filedAt) ?? str(src.filedDate) ?? str(src.period) ?? null;
  const ts = filed ? Date.parse(filed) : NaN;
  const items = Array.isArray(src.items) ? src.items.filter((i): i is string => typeof i === "string").join(", ") : null;
  return {
    title: `${entity} filed 8-K${items ? ` (Items ${items})` : ""}`,
    url: null,
    publishedAt: Number.isFinite(ts) ? ts : null,
  };
}

async function fetchText(url: string, ms = 7000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml" }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const RSS_FEEDS = [
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
];

/**
 * Pull corporate-event intelligence (SEC 8-K + crypto news wires), classify,
 * persist, and return the latest — plus the HALT symbol list the bot vetoes.
 */
export const loadCorpEvents = createServerFn({ method: "POST" })
  .validator((input: { query?: string; universe?: string[] }) => ({
    query: String(input?.query ?? "merger").trim().slice(0, 64) || "merger",
    universe: (Array.isArray(input?.universe) ? input.universe : []).map((s) => String(s).slice(0, 20)).slice(0, 20),
  }))
  .handler(async ({ data }): Promise<{ events: CorpEvent[]; halts: string[]; note: string }> => {
    const universe = [...data.universe, "BTC", "ETH", "SOL"];
    const found: Array<{ title: string; source: string; url: string | null; publishedAt: number | null }> = [];

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(
          `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(data.query)}&forms=8-K&dateRange=custom&startdt=2024-01-01&enddt=${new Date().toISOString().slice(0, 10)}`,
          { headers: { Accept: "application/json", "User-Agent": "MonroeSniper research contact@localhost" }, signal: ctrl.signal },
        );
        if (res.ok) {
          const body = (await res.json()) as { hits?: { hits?: unknown[] } };
          for (const hit of body.hits?.hits?.slice(0, 10) ?? []) {
            const parsed = secHitTitle(hit);
            if (parsed) found.push({ ...parsed, source: "SEC EDGAR 8-K" });
          }
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Best-effort enrichment only.
    }

    for (const feed of RSS_FEEDS) {
      const xml = await fetchText(feed.url);
      if (!xml) continue;
      for (const item of parseRssItems(xml)) {
        found.push({ title: item.title, source: feed.source, url: item.link, publishedAt: item.publishedAt });
      }
    }

    const sql = await getSql();
    const now = Date.now();
    let stored = 0;
    for (const item of found) {
      const { kind, stance } = classifyEvent(item.title);
      if (kind === "OTHER" || kind === "EARNINGS") continue;
      const symbols = extractSymbols(item.title, universe);
      const id = `${item.source}:${Buffer.from(item.title).toString("base64").slice(0, 48)}`;
      try {
        const rows = await sql<{ id: string }>`
          INSERT INTO corp_events (id, kind, title, source, url, symbols, stance, published_at)
          VALUES (${id}, ${kind}, ${item.title.slice(0, 300)}, ${item.source}, ${item.url}, ${JSON.stringify(symbols)}, ${stance}, ${item.publishedAt ?? now})
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;
        if (rows.length) stored += 1;
      } catch {
        // One bad row never sinks the radar sweep.
      }
    }

    const rows = await sql<{
      id: string; kind: string; title: string; source: string; url: string | null;
      symbols: string; stance: string; published_at: number | string;
    }>`
      SELECT id, kind, title, source, url, symbols, stance, published_at
      FROM corp_events
      ORDER BY published_at DESC
      LIMIT 30
    `;
    const events: CorpEvent[] = rows.map((r) => {
      let symbols: string[] = [];
      try {
        const parsed: unknown = JSON.parse(r.symbols);
        if (Array.isArray(parsed)) symbols = parsed.filter((x): x is string => typeof x === "string");
      } catch {
        symbols = [];
      }
      return {
        id: r.id,
        kind: r.kind as CorpEventKind,
        title: r.title,
        source: r.source,
        url: r.url,
        symbols,
        stance: r.stance as CorpEventStance,
        publishedAt: Number(r.published_at),
      };
    });
    const halts = [...new Set(events.filter((e) => e.stance === "HALT").flatMap((e) => e.symbols))];
    return { events, halts, note: `Radar sweep: ${found.length} items, ${stored} new persisted` };
  });

export const getCorpEvents = createServerFn({ method: "GET" }).handler(async (): Promise<{
  events: CorpEvent[];
  halts: string[];
}> => {
  try {
    const sql = await getSql();
    const rows = await sql<{
      id: string; kind: string; title: string; source: string; url: string | null;
      symbols: string; stance: string; published_at: number | string;
    }>`
      SELECT id, kind, title, source, url, symbols, stance, published_at
      FROM corp_events
      ORDER BY published_at DESC
      LIMIT 30
    `;
    const events: CorpEvent[] = rows.map((r) => {
      let symbols: string[] = [];
      try {
        const parsed: unknown = JSON.parse(r.symbols);
        if (Array.isArray(parsed)) symbols = parsed.filter((x): x is string => typeof x === "string");
      } catch {
        symbols = [];
      }
      return {
        id: r.id, kind: r.kind as CorpEventKind, title: r.title, source: r.source,
        url: r.url, symbols, stance: r.stance as CorpEventStance, publishedAt: Number(r.published_at),
      };
    });
    return {
      events,
      halts: [...new Set(events.filter((e) => e.stance === "HALT").flatMap((e) => e.symbols))],
    };
  } catch {
    return { events: [], halts: [] };
  }
});
