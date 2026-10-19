import { useEffect, useMemo, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { toCandles, usePriceHistory } from "@/lib/price-history";
import { cexSymbol } from "@/lib/cex-symbol";
import { loadKlines } from "@/lib/market.functions";
import type { Candle as MarketCandle } from "@/lib/market-candles";
import { TIMEFRAMES, TIMEFRAME_MINUTES, useWorkspace } from "@/lib/workspace-store";
import { WorkspacePanel, Segmented, ToolButton } from "@/components/terminal/panel";
import { CandleChart, positionOverlays, type ChartOverlay } from "@/components/terminal/candle-chart";
import { DepthLadder } from "@/components/terminal/depth-ladder";

const KLINE_REFRESH_MS = 30_000;

export function ChartPanel() {
  const tape = useDesk((s) => s.tape);
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const series = usePriceHistory((s) => s.series);
  const symbolId = useWorkspace((s) => s.symbolId);
  const timeframe = useWorkspace((s) => s.timeframe);
  const setTimeframe = useWorkspace((s) => s.setTimeframe);
  const showDepth = useWorkspace((s) => s.showDepth);
  const toggleDepth = useWorkspace((s) => s.toggleDepth);

  const candidate = useMemo(() => tape.find((c) => c.id === symbolId) ?? null, [tape, symbolId]);
  const book = mode === "live" ? live : demo;
  const sym = candidate ? cexSymbol(candidate.symbol, candidate.venue) : null;

  const [remote, setRemote] = useState<{ candles: MarketCandle[]; note: string } | null>(null);

  useEffect(() => {
    if (!sym) {
      setRemote(null);
      return;
    }
    let cancel = false;
    const pull = async () => {
      try {
        const res = await loadKlines({ data: { symbol: sym, interval: timeframe } });
        if (!cancel) setRemote(res);
      } catch {
        if (!cancel) setRemote({ candles: [], note: "Klines unavailable" });
      }
    };
    void pull();
    const timer = window.setInterval(pull, KLINE_REFRESH_MS);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [sym, timeframe]);

  const tickCandles = useMemo(
    () => toCandles(symbolId ? series[symbolId] : undefined, TIMEFRAME_MINUTES[timeframe]),
    [series, symbolId, timeframe],
  );

  const candles = useMemo(() => {
    const remoteBars = remote?.candles ?? [];
    if (remoteBars.length >= 2) {
      return remoteBars.map((c) => ({ t: c.time, o: c.open, h: c.high, l: c.low, c: c.close }));
    }
    return tickCandles;
  }, [remote, tickCandles]);

  const overlays = useMemo(
    () => (candidate ? positionOverlays(book.positions, candidate.symbol) : []),
    [book.positions, candidate],
  );

  const up = (candidate?.change24h ?? 0) >= 0;
  const source = remote?.candles.length ? remote.note : "tape ticks";

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
            {candles.length} bars · {source}
          </span>
          <ToolButton active={showDepth} title="Toggle depth ladder (d)" onClick={toggleDepth}>
            DEPTH
          </ToolButton>
          <Segmented
            value={timeframe}
            onChange={setTimeframe}
            options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
          />
        </>
      }
      bodyClassName="p-0"
    >
      {showDepth && sym ? (
        <ChartRow candles={candles} overlays={overlays} sym={sym} />
      ) : (
        <CandleChart candles={candles} overlays={overlays} height={360} />
      )}
    </WorkspacePanel>
  );
}

function ChartRow({ candles, overlays, sym }: { candles: { t: number; o: number; h: number; l: number; c: number }[]; overlays: ChartOverlay[]; sym: string }) {
  return (
    <Group orientation="horizontal" id="monroe-chart-row" className="h-full">
      <Panel id="chart-main" defaultSize="72%" minSize="45%">
        <CandleChart candles={candles} overlays={overlays} height={360} />
      </Panel>
      <Separator className="w-px bg-line transition-colors hover:bg-brass/70" />
      <Panel id="chart-depth" defaultSize="28%" minSize="18%" maxSize="42%" collapsible collapsedSize={0}>
        <DepthLadder symbol={sym} />
      </Panel>
    </Group>
  );
}

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toPrecision(4);
}
