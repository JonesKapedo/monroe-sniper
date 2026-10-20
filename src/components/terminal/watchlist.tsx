import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { usePriceHistory, seriesChange, type PricePoint } from "@/lib/price-history";
import { useWorkspace } from "@/lib/workspace-store";
import type { Candidate } from "@/lib/paper";
import { WorkspacePanel } from "@/components/terminal/panel";

type SortKey = "score" | "change" | "volume" | "symbol";

const VENUE_TAG: Record<string, string> = {
  binance: "CEX",
  dex: "DEX",
  fx: "FX",
  hyperliquid: "PERP",
};

export function Watchlist() {
  const tape = useDesk((s) => s.tape);
  const symbolId = useWorkspace((s) => s.symbolId);
  const setSymbol = useWorkspace((s) => s.setSymbol);
  const series = usePriceHistory((s) => s.series);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "score", dir: "desc" });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? tape.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      : tape;
    const sorted = [...filtered].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "symbol":
          return a.symbol.localeCompare(b.symbol) * dir;
        case "change":
          return (a.change24h - b.change24h) * dir;
        case "volume":
          return (a.volume24h - b.volume24h) * dir;
        default:
          return (a.score - b.score) * dir;
      }
    });
    return sorted.slice(0, 120);
  }, [tape, query, sort]);

  const flip = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const Header = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <button
      type="button"
      onClick={() => flip(k)}
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold tracking-wider uppercase transition-colors",
        sort.key === k ? "text-brass" : "text-faint hover:text-cream",
        className,
      )}
    >
      {label}
      {sort.key === k ? (sort.dir === "desc" ? <ArrowDown className="size-2.5" /> : <ArrowUp className="size-2.5" />) : null}
    </button>
  );

  return (
    <WorkspacePanel
      title="Watchlist"
      hint={`${tape.length} symbols`}
      actions={
        <span className="font-mono text-[10px] text-faint">
          {rows.length}
        </span>
      }
      bodyClassName="flex flex-col"
    >
      <div className="flex items-center gap-1.5 border-b border-line/60 px-2 py-1.5">
        <Search className="size-3 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter symbols"
          className="w-full bg-transparent font-mono text-[11px] text-cream placeholder:text-faint/60 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 border-b border-line/60 px-2 py-1">
        <Header label="Symbol" k="symbol" />
        <Header label="24h" k="change" className="justify-end" />
        <Header label="Scr" k="score" className="justify-end" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] text-faint">No symbols on the tape yet.</p>
        ) : (
          rows.map((c) => (
            <WatchRow
              key={c.id}
              candidate={c}
              points={series[c.id]}
              selected={c.id === symbolId}
              onSelect={() => setSymbol(c.id)}
            />
          ))
        )}
      </div>
    </WorkspacePanel>
  );
}

function WatchRow({
  candidate,
  points,
  selected,
  onSelect,
}: {
  candidate: Candidate;
  points: PricePoint[] | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const change = candidate.change24h;
  const drift = seriesChange(points);
  const up = change >= 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 border-b border-line/40 px-2 py-1.5 text-left transition-colors",
        selected ? "bg-brass/10" : "hover:bg-panel-2/60",
      )}
    >
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-[11px] font-medium text-cream">{candidate.symbol}</span>
          <span className="rounded bg-panel-2 px-1 text-[9px] font-semibold tracking-wide text-faint uppercase">
            {VENUE_TAG[candidate.venue] ?? candidate.venue}
          </span>
        </div>
        <span className="truncate font-mono text-[10px] text-faint">${fmtPrice(candidate.priceUsd)}</span>
      </div>
      <Sparkline points={points} className="col-start-2" />
      <span className={cn("justify-self-end font-mono text-[11px] tabular-nums", up ? "text-gain" : "text-loss")}>
        {up ? "+" : ""}
        {change.toFixed(2)}%
        {drift !== null ? (
          <span className={cn("ml-1 text-[9px]", drift >= 0 ? "text-gain/70" : "text-loss/70")}>
            {drift >= 0 ? "▲" : "▼"}
          </span>
        ) : null}
      </span>
      <span className="justify-self-end font-mono text-[11px] tabular-nums text-cream">{Math.round(candidate.score)}</span>
    </button>
  );
}

function Sparkline({ points, className }: { points: PricePoint[] | undefined; className?: string }) {
  if (!points || points.length < 2) return <span className={cn("w-14", className)} />;
  const w = 56;
  const h = 16;
  const ps = points.slice(-40);
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of ps) {
    lo = Math.min(lo, p.p);
    hi = Math.max(hi, p.p);
  }
  const span = hi - lo || 1;
  const path = ps
    .map((p, i) => `${(i / (ps.length - 1)) * w},${h - ((p.p - lo) / span) * h}`)
    .join(" ");
  const up = ps[ps.length - 1].p >= ps[0].p;
  return (
    <svg width={w} height={h} className={cn("w-14", className)} preserveAspectRatio="none" aria-hidden>
      <polyline points={path} fill="none" stroke={up ? "var(--theme-gain)" : "var(--theme-loss)"} strokeWidth={1.25} />
    </svg>
  );
}

function fmtPrice(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toPrecision(4);
}
