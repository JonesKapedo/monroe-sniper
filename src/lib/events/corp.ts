export type CorpEventKind =
  | "ACQUISITION"
  | "IPO"
  | "STRIKE"
  | "HALT"
  | "CORPORATE"
  | "EARNINGS"
  | "OTHER";

export type CorpEventStance = "WATCH" | "LONG_THESIS" | "SHORT_THESIS" | "HALT";

export type CorpEventInput = {
  id: string;
  title: string;
  source: string;
  url?: string | null;
  publishedAt: number;
};

const KIND_RULES: Array<{ kind: CorpEventKind; stance: CorpEventStance; patterns: RegExp[] }> = [
  {
    kind: "HALT",
    stance: "HALT",
    patterns: [/trad(e|ing) halt/i, /\bsuspend(s|ed)?\b.*(trad|list)/i, /delist/i, /circuit breaker/i],
  },
  {
    kind: "ACQUISITION",
    stance: "WATCH",
    patterns: [/merger/i, /acqui(sition|re[sd])\b/i, /takeover/i, /buyout/i, /to acquire\b/i],
  },
  {
    kind: "IPO",
    stance: "LONG_THESIS",
    patterns: [/\bIPO\b/, /direct listing/i, /go(es)? public/i, /S-1 filing/i, /debut(s|ed)? on (nasdaq|nyse)/i],
  },
  {
    kind: "STRIKE",
    stance: "SHORT_THESIS",
    patterns: [/\bstrike\b/i, /\bwalkout\b/i, /union.*(vote|authorize)/i, /labor dispute/i],
  },
  {
    kind: "EARNINGS",
    stance: "WATCH",
    patterns: [/earnings/i, /Q[1-4] results/i, /guidance (cut|rais)/i, /8-K.*results/i],
  },
  {
    kind: "CORPORATE",
    stance: "WATCH",
    patterns: [/buyback/i, /dividend/i, /stock split/i, /CEO resign/i, /SEC (charge|sue|settle)/i],
  },
];

/** Classify a headline into an event kind + suggested stance. */
export function classifyEvent(title: string): { kind: CorpEventKind; stance: CorpEventStance } {
  for (const rule of KIND_RULES) {
    if (rule.patterns.some((re) => re.test(title))) return { kind: rule.kind, stance: rule.stance };
  }
  return { kind: "OTHER", stance: "WATCH" };
}

export type RssItem = { title: string; link: string | null; publishedAt: number | null };

function tagContent(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return null;
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim() || null;
}

/** Minimal RSS/Atom item parser — no DOM needed, safe to run server-side. */
export function parseRssItems(xml: string): RssItem[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) ?? [];
  return blocks.slice(0, 40).map((block) => {
    const title = tagContent(block, "title") ?? "(untitled)";
    const linkRaw = tagContent(block, "link");
    const linkAttr = block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ?? null;
    const dateRaw = tagContent(block, "pubDate") ?? tagContent(block, "published") ?? tagContent(block, "updated");
    const parsed = dateRaw ? Date.parse(dateRaw) : NaN;
    return {
      title,
      link: linkRaw || linkAttr,
      publishedAt: Number.isFinite(parsed) ? parsed : null,
    };
  });
}

/**
 * Find watched symbols mentioned in text: $TAGS plus exact matches from the
 * provided universe (held positions, avenues, majors).
 */
export function extractSymbols(text: string, universe: string[]): string[] {
  const found = new Set<string>();
  const upper = text.toUpperCase();
  for (const tag of text.match(/\$[A-Za-z]{1,10}\b/g) ?? []) {
    found.add(tag.slice(1).toUpperCase());
  }
  for (const symbol of universe) {
    const base = symbol.toUpperCase().split(/[/:_\- ]/)[0];
    if (base.length >= 2 && new RegExp(`\\b${base}\\b`).test(upper)) found.add(base);
  }
  return [...found].slice(0, 6);
}
