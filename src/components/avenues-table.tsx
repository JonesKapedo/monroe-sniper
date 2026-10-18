import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import type { AvenueCategory, AvenueOpportunity } from "@/lib/avenues/types";
import type { Book } from "@/lib/paper";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

const PREVIEW = 10;

type Props = {
  avenues: AvenueOpportunity[];
  book: Book;
  onSnipe: (opp: AvenueOpportunity) => void;
  maxSlots?: number;
};

export function AvenuesTable({ avenues, book, onSnipe, maxSlots = 4 }: Props) {
  const [filter, setFilter] = useState<"ALL" | AvenueCategory>("ALL");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(
    () =>
      avenues
        .filter((a) => (filter === "ALL" ? true : a.category === filter))
        .sort((a, b) => b.confidenceScore - a.confidenceScore),
    [avenues, filter],
  );

  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);
  const hidden = Math.max(0, filtered.length - PREVIEW);
  const openCount = book.positions.length;
  const slotsFull = openCount >= maxSlots;

  return (
    <section className="rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-brass" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-cream">Funding avenues</h2>
            <p className="text-[11px] text-faint">
              Live Hyperliquid carry — ranked by entry score. Showing{" "}
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
              {label}
              {id === "ALL"
                ? ` (${avenues.length})`
                : ` (${avenues.filter((a) => a.category === id).length})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-faint">
          No live-verified avenues this cycle. Tape entries continue above.
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
              {visible.map((opp) => {
                const held = book.positions.some((p) => p.tokenId === opp.id);
                const side = opp.perpSide ?? "LONG";
                return (
                  <tr
                    key={opp.id}
                    className="border-b border-line/50 transition-colors hover:bg-panel-2/50"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-cream">{opp.symbol}</span>
                      <span className="mt-0.5 block text-[10px] text-faint">Hyperliquid</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                          side === "LONG"
                            ? "bg-gain/15 text-gain"
                            : "bg-loss/15 text-loss",
                        )}
                      >
                        {side}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-cream">{opp.confidenceScore}</td>
                    <td className="px-3 py-2.5 font-mono text-faint">
                      {opp.fundingRate8h != null
                        ? `${(opp.fundingRate8h * 100).toFixed(3)}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-brass">
                      {opp.fundingApr != null ? `${opp.fundingApr.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-cream">
                      {opp.priceA > 0 ? fmtPx(opp.priceA) : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-faint">
                      {opp.stopLossPrice ? fmtPx(opp.stopLossPrice) : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-faint">
                      {opp.targetPrice ? fmtPx(opp.targetPrice) : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-cream">
                      {opp.riskRewardRatio?.toFixed(1) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {held ? (
                        <span className="text-gain">Held</span>
                      ) : opp.disciplineApproved ? (
                        <span className="text-faint">Open</span>
                      ) : (
                        <span className="text-amber-400/90">Gated</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        disabled={held || slotsFull || !opp.disciplineApproved}
                        onClick={() => onSnipe(opp)}
                        className="h-7 px-2 text-[11px]"
                      >
                        {held ? "Held" : "Snipe"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
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
