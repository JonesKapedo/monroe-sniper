import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, Zap } from "lucide-react";
import type { AvenueCategory, AvenueOpportunity } from "@/lib/avenues/types";
import type { Book, Candidate } from "@/lib/paper";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

const PREVIEW = 10;

export type DyorTarget =
  | { kind: "avenue"; avenue: AvenueOpportunity }
  | { kind: "tape"; candidate: Candidate };

type Props = {
  avenues: AvenueOpportunity[];
  tape: Candidate[];
  book: Book;
  minScore: number;
  onDyor: (target: DyorTarget) => void;
};

type Row = {
  key: string;
  target: DyorTarget;
  symbol: string;
  source: string;
  side: string;
  sideTone: "long" | "short" | "neutral";
  score: number;
  funding: string;
  apr: string;
  mark: number;
  stop: number | null;
  targetPx: number | null;
  rr: number | null;
  status: string;
  statusTone: "held" | "open" | "gated" | "watch";
};

export function AvenuesTable({ avenues, tape, book, minScore, onDyor }: Props) {
  const [filter, setFilter] = useState<"ALL" | "PERPS" | "FEED">("ALL");
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    const avenueRows: Row[] = avenues.map((opp) => {
      const side = opp.perpSide ?? "LONG";
      return {
        key: `avenue:${opp.id}`,
        target: { kind: "avenue", avenue: opp },
        symbol: opp.symbol,
        source: opp.venueA || "Hyperliquid",
        side,
        sideTone: side === "LONG" ? "long" : side === "SHORT" ? "short" : "neutral",
        score: opp.confidenceScore,
        funding:
          opp.fundingRate8h != null ? `${(opp.fundingRate8h * 100).toFixed(3)}%` : "—",
        apr: opp.fundingApr != null ? `${opp.fundingApr.toFixed(1)}%` : "—",
        mark: opp.priceA,
        stop: opp.stopLossPrice || null,
        targetPx: opp.targetPrice || null,
        rr: opp.riskRewardRatio ?? null,
        status: book.positions.some((p) => p.tokenId === opp.id)
          ? "Held"
          : opp.disciplineApproved
            ? "Open"
            : "Gated",
        statusTone: book.positions.some((p) => p.tokenId === opp.id)
          ? "held"
          : opp.disciplineApproved
            ? "open"
            : "gated",
      };
    });

    const tapeRows: Row[] = tape.map((cand) => {
      const held = book.positions.some((p) => p.tokenId === cand.id);
      return {
        key: `tape:${cand.id}`,
        target: { kind: "tape", candidate: cand },
        symbol: cand.symbol,
        source:
          cand.venue === "binance"
            ? "Binance Spot"
            : cand.venue === "fx"
              ? "FX reference"
              : cand.venue === "hyperliquid"
                ? "Hyperliquid"
                : "DEX feed",
        side: "SPOT",
        sideTone: "neutral",
        score: cand.score,
        funding: "—",
        apr: "—",
        mark: cand.priceUsd,
        stop: null,
        targetPx: null,
        rr: null,
        status: held ? "Held" : cand.score >= minScore ? "Open" : "Watch",
        statusTone: held ? "held" : cand.score >= minScore ? "open" : "watch",
      };
    });

    return [...avenueRows, ...tapeRows].sort((a, b) => b.score - a.score);
  }, [avenues, tape, book, minScore]);

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        filter === "ALL"
          ? true
          : filter === "PERPS"
            ? row.target.kind === "avenue"
            : row.target.kind === "tape",
      ),
    [rows, filter],
  );

  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);
  const hidden = Math.max(0, filtered.length - PREVIEW);

  const counts = {
    ALL: rows.length,
    PERPS: rows.filter((r) => r.target.kind === "avenue").length,
    FEED: rows.filter((r) => r.target.kind === "tape").length,
  };

  return (
    <section className="rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-brass" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-cream">Funding avenues</h2>
            <p className="text-[11px] text-faint">
              Live funding carry + market feed — ranked by score. Showing{" "}
              {Math.min(PREVIEW, filtered.length)}
              {filtered.length > PREVIEW ? ` of ${filtered.length}` : ""}.
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {(
            [
              ["ALL", "All"],
              ["PERPS", "Perps"],
              ["FEED", "Feed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                filter === id
                  ? "bg-brass/20 text-brass"
                  : "bg-panel-2 text-faint hover:text-cream",
              )}
            >
              {label} ({counts[id]})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-faint">
          No live avenues or feed rows this cycle.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-panel-2/80 font-mono text-[10px] uppercase tracking-wider text-faint">
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Funding/8h</th>
                <th className="px-3 py-2 font-medium">APR</th>
                <th className="px-3 py-2 font-medium">Mark</th>
                <th className="px-3 py-2 font-medium">Stop</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">R:R</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-line/50 transition-colors hover:bg-panel-2/50"
                >
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-cream">{row.symbol}</span>
                    <span className="mt-0.5 block text-[10px] text-faint">{row.source}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                        row.sideTone === "long" && "bg-gain/15 text-gain",
                        row.sideTone === "short" && "bg-loss/15 text-loss",
                        row.sideTone === "neutral" && "bg-panel-2 text-faint",
                      )}
                    >
                      {row.side}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-cream">{row.score}</td>
                  <td className="px-3 py-2.5 font-mono text-faint">{row.funding}</td>
                  <td className="px-3 py-2.5 font-mono text-brass">{row.apr}</td>
                  <td className="px-3 py-2.5 font-mono text-cream">
                    {row.mark > 0 ? fmtPx(row.mark) : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-faint">
                    {row.stop ? fmtPx(row.stop) : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-faint">
                    {row.targetPx ? fmtPx(row.targetPx) : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-cream">
                    {row.rr?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        row.statusTone === "held" && "text-gain",
                        row.statusTone === "open" && "text-faint",
                        row.statusTone === "gated" && "text-amber-400/90",
                        row.statusTone === "watch" && "text-faint",
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      onClick={() => onDyor(row.target)}
                      className="h-7 px-2 text-[11px]"
                      title="Open the DYOR report for this avenue"
                    >
                      <Search className="mr-1 size-3" /> DYOR
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hidden > 0 && (
        <div className="flex justify-center border-t border-line px-4 py-2">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium text-brass transition-colors hover:bg-brass/10"
          >
            {expanded ? (
              <>
                Show top {PREVIEW} <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                Show {hidden} more <ChevronDown className="size-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}

function fmtPx(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}
