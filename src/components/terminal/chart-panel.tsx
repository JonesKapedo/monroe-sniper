import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { toCandles, usePriceHistory } from "@/lib/price-history";
import { TIMEFRAMES, TIMEFRAME_MINUTES, useWorkspace } from "@/lib/workspace-store";
import { WorkspacePanel, Segmented } from "@/components/terminal/panel";
import { CandleChart, positionOverlays } from "@/components/terminal/candle-chart";

export function ChartPanel() {
  const tape = useDesk((s) => s.tape);
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const series = usePriceHistory((s) => s.series);
  const symbolId = useWorkspace((s) => s.symbolId);
  const timeframe = useWorkspace((s) => s.timeframe);
  const setTimeframe = useWorkspace((s) => s.setTimeframe);

  const candidate = useMemo(() => tape.find((c) => c.id === symbolId) ?? null, [tape, symbolId]);
  const book = mode === "live" ? live : demo;

  const candles = useMemo(
    () => toCandles(symbolId ? series[symbolId] : undefined, TIMEFRAME_MINUTES[timeframe]),
    [series, symbolId, timeframe],
  );

  const overlays = useMemo(
    () => (candidate ? positionOverlays(book.positions, candidate.symbol) : []),
    [book.positions, candidate],
  );

  const up = (candidate?.change24h ?? 0) >= 0;

  return (
    <WorkspacePanel
      scroll={false}
      title={candidate ? candidate.symbol : "Chart"}
      hint={
        candidate ? (
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-cream">${fmt(candidate.priceUsd)}</span>
            <span className={cn("font-mono text-[10px]", up ? "text-gain" : "text-loss")}>
              {up ? "+" : ""}
              {candidate.change24h.toFixed(2)}%
            </span>
          </span>
        ) : (
          "select a symbol"
        )
      }
      actions={
        <>
          <span className="mr-1 hidden font-mono text-[10px] text-faint xl:inline">
            {candles.length} bars · {overlays.length ? `${overlays.length} levels` : "flat"}
          </span>
          <Segmented
            value={timeframe}
            onChange={setTimeframe}
            options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
          />
        </>
      }
      bodyClassName="p-0"
    >
      <CandleChart candles={candles} overlays={overlays} height={360} />
    </WorkspacePanel>
  );
}

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toPrecision(4);
}
