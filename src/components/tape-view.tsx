import { useEffect, useMemo, useState } from "react";
import { Activity, CandlestickChart, CircleAlert, Radio } from "lucide-react";
import { Badge, Card, Label, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { loadDexCandles, loadFxCandles, loadKlines, loadTokenTicks, resolveChartPool, type ChartPool } from "@/lib/market.functions";
import { FX_PAIRS } from "@/lib/fx/twelvedata";
import { candleDurationMs, detectChartGap, mergeTickIntoCandles } from "@/lib/charts/geckoterminal";
import { equity, type Position } from "@/lib/paper";
import { scanAllAvenues } from "@/lib/avenues/engine";
import { useDesk } from "@/lib/desk-store";
import type { Candle } from "@/lib/market-candles";
import { SOL_MINT, solanaSwapCandles, type SolanaSwap } from "@/lib/solana-swaps";

type Timeframe = "1m" | "5m" | "15m" | "1h";
type ChartSource = "solana-dex" | "cex";
type StreamStatus = "checking" | "connecting" | "waiting" | "live" | "error" | "reconnecting";

const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];
const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h"];
const WIDTH = 760;
const HEIGHT = 320;
const LEFT = 18;
const RIGHT = 682;
const TOP = 18;
const BOTTOM = 282;

function formatPrice(value: number): string {
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return value.toPrecision(5);
}

function formatUsd(value: number): string {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
}

function matchesPair(position: Position, symbol: string): boolean {
  const base = symbol.replace(/USDT$/, "");
  return position.symbol.toUpperCase().split(/[/:]/)[0] === base;
}

function levelsFor(position: Position) {
  return [
    { label: `ENTRY ${position.symbol}`, value: position.entryPrice, color: "#d7b56a", dash: "0" },
    { label: "TAKE PROFIT", value: position.target, color: "#a5d194", dash: "5 4" },
    { label: "STOP", value: position.stop, color: "#e3a394", dash: "3 4" },
  ].filter(
    (level): level is { label: string; value: number; color: string; dash: string } =>
      typeof level.value === "number" && Number.isFinite(level.value),
  );
}

function PositionCard({
  position,
  onClose,
}: {
  position: Position;
  onClose: (id: string) => void;
}) {
  const unrealized = (position.mark - position.entryPrice) * position.qty;
  const toTarget = ((position.target ?? position.entryPrice * 1.06) - position.mark) * position.qty;
  const toStop = (position.stop - position.mark) * position.qty;

  return (
    <article className="rounded-xl border border-line bg-panel-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{position.symbol}</h3>
          <p className="mt-1 text-xs text-faint">
            Entry {formatPrice(position.entryPrice)} · Last mark {formatPrice(position.mark)} ·
            Quantity {position.qty.toPrecision(5)}
          </p>
        </div>
        <p
          className={cn(
            "font-mono text-sm font-semibold",
            unrealized >= 0 ? "text-gain" : "text-loss",
          )}
        >
          {formatUsd(unrealized)}
          <span className="ml-1 text-[10px] font-normal text-faint">unrealized</span>
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
        <p className="text-faint">
          At target{" "}
          <span
            className={cn(
              "ml-1 font-mono font-semibold",
              toTarget >= 0 ? "text-gain" : "text-loss",
            )}
          >
            {formatUsd(toTarget)}
          </span>
        </p>
        <p className="text-faint">
          At stop{" "}
          <span
            className={cn("ml-1 font-mono font-semibold", toStop >= 0 ? "text-gain" : "text-loss")}
          >
            {formatUsd(toStop)}
          </span>
        </p>
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Simulated scenarios from the last quote; not forecasts. Standby leaves this position open.
      </p>
      <button
        type="button"
        onClick={() => onClose(position.id)}
        className="mt-3 min-h-10 rounded-lg border border-loss/40 px-3 text-xs font-semibold text-loss hover:bg-loss/10"
      >
        Close {position.symbol} at last mark
      </button>
    </article>
  );
}

export function TapeView() {
  const demo = useDesk((state) => state.demo);
  const executions = useDesk((state) => state.executions);
  const log = useDesk((state) => state.log);
  const power = useDesk((state) => state.power);
  const flatten = useDesk((state) => state.flatten);
  const eq = equity(demo);
  const trades = demo.trades;
  const positions = demo.positions;
  const net = trades.reduce((sum, trade) => sum + trade.pnl, 0);

  const [chartSource, setChartSource] = useState<ChartSource>("solana-dex");
  const [selectedPair, setSelectedPair] = useState(PAIRS[0]);
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [cexCandles, setCexCandles] = useState<Candle[]>([]);
  const [solanaSwaps, setSolanaSwaps] = useState<SolanaSwap[]>([]);
  // Multi-source DEX chart: GeckoTerminal history, Jupiter live ticks, Helius tape.
  const [chartToken, setChartToken] = useState("SOL");
  const [chartPool, setChartPool] = useState<ChartPool | null>(null);
  const [dexHistory, setDexHistory] = useState<Candle[]>([]);
  const [tickNote, setTickNote] = useState<string | null>(null);
  const [heliusPairs, setHeliusPairs] = useState<{ dexId: string; pairAddress: string }[]>([]);
  const [feedNote, setFeedNote] = useState("Checking Helius market feed…");
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("checking");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const disciplineRules = useDesk((state) => state.disciplineRules);

  useEffect(() => {
    if (chartSource !== "cex") return;
    let current = true;
    const refresh = async () => {
      try {
        const result = selectedPair.includes("/")
          ? await loadFxCandles({ data: { pair: selectedPair, interval: timeframe } })
          : await loadKlines({ data: { symbol: selectedPair, interval: timeframe } });
        if (!current) return;
        setCexCandles(result.candles);
        setFeedNote(result.note);
        setLastUpdated(result.candles.length ? Date.now() : null);
      } catch (error) {
        if (!current) return;
        setCexCandles([]);
        setLastUpdated(null);
        setFeedNote(error instanceof Error ? error.message : "Public market data unavailable.");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [chartSource, selectedPair, timeframe]);

  useEffect(() => {
    if (chartSource !== "solana-dex") return;
    let current = true;
    let stream: EventSource | null = null;
    let retryTimer = 0;
    let retries = 0;
    setStreamStatus("checking");
    setFeedNote("Checking server-side Helius connection…");

    const scheduleReconnect = () => {
      if (!current) return;
      retries += 1;
      const delayMs = Math.min(30_000, 5_000 * 2 ** Math.min(retries, 3));
      setStreamStatus("reconnecting");
      setFeedNote(`Solana tape disconnected · retrying in ${Math.round(delayMs / 1000)}s`);
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        if (!current) return;
        stream?.close();
        stream = null;
        void connect();
      }, delayMs);
    };

    const connect = async () => {
      try {
        const response = await fetch("/api/solana-swaps?check=1", { cache: "no-store" });
        const body = (await response.json()) as
          { error?: string } | { pairs: { dexId: string; pairAddress: string }[] };
        if (!response.ok) {
          throw new Error("error" in body ? body.error : "Helius stream is unavailable.");
        }
        if (!current || !("pairs" in body)) return;
        setHeliusPairs(body.pairs);
        setStreamStatus("connecting");
        const venueNames = [...new Set(body.pairs.map((pair) => pair.dexId))].join(" + ");
        setFeedNote(`Opening confirmed ${venueNames} SOL/USDC swap stream…`);

        stream = new EventSource("/api/solana-swaps");
        stream.addEventListener("ready", () => {
          if (!current) return;
          retries = 0;
          setStreamStatus("waiting");
          setFeedNote(`Connected to Solana mainnet · ${venueNames} · Waiting for confirmed swaps`);
        });
        stream.addEventListener("swap", (event) => {
          if (!current) return;
          retries = 0;
          const swap = JSON.parse((event as MessageEvent<string>).data) as SolanaSwap;
          setSolanaSwaps((previous) =>
            [...previous.filter((item) => item.signature !== swap.signature), swap]
              .sort((a, b) => a.time - b.time)
              .slice(-1000),
          );
          setStreamStatus("live");
          setFeedNote(`Confirmed ${swap.dexId} swap · ${new Date(swap.time).toLocaleTimeString()}`);
          setLastUpdated(Date.now());
        });
        stream.addEventListener("feed-error", (event) => {
          if (!current) return;
          const detail = JSON.parse((event as MessageEvent<string>).data) as {
            fatal: boolean;
            message: string;
          };
          if (detail.fatal) {
            scheduleReconnect();
            return;
          }
          setStreamStatus((previous) => (previous === "live" ? "live" : "waiting"));
          setFeedNote(detail.message);
        });
        stream.onerror = () => {
          if (!current) return;
          scheduleReconnect();
        };
      } catch (error) {
        if (!current) return;
        setStreamStatus("error");
        setFeedNote(error instanceof Error ? error.message : "Solana market feed unavailable.");
      }
    };

    void connect();
    return () => {
      current = false;
      window.clearTimeout(retryTimer);
      stream?.close();
    };
  }, [chartSource]);

  // Resolve the deepest pool for the selected token (Helius pairs win for SOL).
  useEffect(() => {
    if (chartSource !== "solana-dex") return;
    let current = true;
    if (chartToken === "SOL" && heliusPairs.length > 0) {
      const raydium = heliusPairs.find((p) => p.dexId === "raydium") ?? heliusPairs[0];
      setChartPool({
        poolAddress: raydium.pairAddress,
        baseSymbol: "SOL",
        mint: SOL_MINT,
        chain: "solana",
        liquidityUsd: null,
        label: `SOL/USDC · ${raydium.dexId}`,
      });
      return () => {
        current = false;
      };
    }
    setChartPool(null);
    setDexHistory([]);
    void resolveChartPool({ data: { symbol: chartToken } }).then((res) => {
      if (!current) return;
      setChartPool(res.pool);
      if (!res.pool) setFeedNote(res.note);
    });
    return () => {
      current = false;
    };
  }, [chartSource, chartToken, heliusPairs]);

  // GeckoTerminal history for the resolved pool, refreshed on a cadence.
  useEffect(() => {
    if (chartSource !== "solana-dex" || !chartPool) return;
    let current = true;
    const refresh = async () => {
      try {
        const result = await loadDexCandles({
          data: { poolAddress: chartPool.poolAddress, interval: timeframe },
        });
        if (!current || !result.candles.length) return;
        setDexHistory(result.candles);
        setLastUpdated(Date.now());
      } catch {
        // History is best-effort; Helius swaps remain as fallback candles.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [chartSource, chartPool, timeframe]);

  // Live tick streaming for the charted token, merged into the open candle.
  // Falls back to SOL so the default chart always breathes.
  const chartMint = chartPool?.mint ?? SOL_MINT;
  useEffect(() => {
    if (chartSource !== "solana-dex") {
      setTickNote(null);
      return;
    }
    const mints = [...new Set([SOL_MINT, chartMint].filter((m) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m)))];
    if (!mints.length) {
      setTickNote(null);
      return;
    }
    let current = true;
    const refresh = async () => {
      try {
        const res = await loadTokenTicks({ data: { mints } });
        if (!current) return;
        const tick =
          res.ticks.find((t) => t.mint === chartMint) ??
          res.ticks.find((t) => t.mint === SOL_MINT);
        setTickNote(tick ? `Jupiter live $${tick.usdPrice < 1 ? tick.usdPrice.toPrecision(4) : tick.usdPrice.toFixed(2)}` : null);
        if (!tick) return;
        setDexHistory((prev) =>
          mergeTickIntoCandles(prev, tick.usdPrice, Date.now(), candleDurationMs(timeframe)),
        );
      } catch {
        // Ticks are best-effort; history still stands.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [chartSource, chartToken, chartMint, timeframe]);

  const tokenOptions = useMemo(() => {
    const bases = new Set<string>(["SOL"]);
    for (const p of positions) {
      const base = p.symbol.toUpperCase().split(/[/:_\- ]/)[0];
      if (base) bases.add(base);
    }
    for (const a of scanAllAvenues(demo, disciplineRules)) {
      if (a.anchorSymbol) bases.add(a.anchorSymbol.toUpperCase());
    }
    return [...bases].slice(0, 8);
  }, [positions, demo, disciplineRules]);

  const swapCandles = useMemo(
    () => solanaSwapCandles(solanaSwaps, timeframe),
    [solanaSwaps, timeframe],
  );
  const candles = chartSource === "solana-dex" ? (dexHistory.length ? dexHistory : swapCandles) : cexCandles;
  const chartGapped =
    candles.length > 0 && detectChartGap(candles, Date.now(), candleDurationMs(timeframe));
  const candleSource =
    chartSource === "solana-dex"
      ? dexHistory.length
        ? "GeckoTerminal history"
        : swapCandles.length
          ? "Helius swaps"
          : null
      : null;

  const currentCandle = candles.at(-1);
  const previousCandle = candles.at(-2);
  const priceChange =
    currentCandle && previousCandle?.close
      ? ((currentCandle.close - previousCandle.close) / previousCandle.close) * 100
      : 0;
  const relevantPositions =
    chartSource === "solana-dex"
      ? positions.filter((position) => position.symbol.toUpperCase().includes(chartToken))
      : positions.filter(
          (position) =>
            (position.venue === "binance" && matchesPair(position, selectedPair)) ||
            (selectedPair.includes("/") && position.symbol === selectedPair),
        );
  const closedExecutions = executions.filter((execution) => execution.type !== "MARKET_FLOW");
  const wins = trades.filter((trade) => trade.pnl > 0).length;

  const chart = useMemo(() => {
    if (candles.length === 0) return null;
    const rawMin = Math.min(...candles.map((candle) => candle.low));
    const rawMax = Math.max(...candles.map((candle) => candle.high));
    const padding = (rawMax - rawMin) * 0.08 || rawMax * 0.005;
    const min = Math.max(0, rawMin - padding);
    const max = rawMax + padding;
    const range = max - min || 1;
    const x = (index: number) => LEFT + (index / Math.max(1, candles.length - 1)) * (RIGHT - LEFT);
    const y = (price: number) => TOP + ((max - price) / range) * (BOTTOM - TOP);
    const barWidth = Math.max(3, Math.min(12, ((RIGHT - LEFT) / candles.length) * 0.56));
    return { min, max, x, y, barWidth };
  }, [candles]);

  const unrealized = positions.reduce(
    (sum, position) => sum + (position.mark - position.entryPrice) * position.qty,
    0,
  );

  // Simulated fills plotted on the chart: nearest candle by time, skipped when off-scale.
  const execMarkers = useMemo(() => {
    if (chartSource !== "solana-dex" || candles.length === 0) return [];
    return closedExecutions
      .filter((e) => e.symbol.toUpperCase().includes(chartToken))
      .slice(0, 12)
      .flatMap((e) => {
        let best = 0;
        for (let i = 1; i < candles.length; i += 1) {
          if (Math.abs(candles[i].time - e.ts) < Math.abs(candles[best].time - e.ts)) best = i;
        }
        return [{ exec: e, index: best }];
      });
  }, [chartSource, candles, closedExecutions, chartToken]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        stage="now"
        title="Market & Execution Activity"
        badge={<Badge tone="live">Simulated</Badge>}
        subtitle="Public market candles and simulated fills. No brokerage connection or real-money orders are available."
      >
        <div className="flex items-center gap-2 self-start rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs sm:self-auto">
          <span
            className={cn("size-2 rounded-full", power ? "bg-gain" : "bg-faint")}
            aria-hidden="true"
          />
          <span className="font-medium">{power ? "Bot armed" : "Standby"}</span>
          <span className="text-faint">· {positions.length} held</span>
        </div>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Demo equity</p>
          <p className="num mt-1 text-xl font-bold text-cream">${eq.toFixed(2)}</p>
          <p className="text-[11px] text-faint">Simulation balance</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Unrealized P&amp;L</p>
          <p
            className={cn(
              "num mt-1 text-xl font-bold",
              unrealized >= 0 ? "text-gain" : "text-loss",
            )}
          >
            {formatUsd(unrealized)}
          </p>
          <p className="text-[11px] text-faint">{positions.length} open demo positions</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Realized P&amp;L</p>
          <p className={cn("num mt-1 text-xl font-bold", net >= 0 ? "text-gain" : "text-loss")}>
            {formatUsd(net)}
          </p>
          <p className="text-[11px] text-faint">
            {wins} wins / {trades.length} closes
          </p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Simulated fills</p>
          <p className="num mt-1 text-xl font-bold text-cream">{closedExecutions.length}</p>
          <p className="text-[11px] text-faint">This browser session</p>
        </Card>
      </section>

      <Card className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2">
              <CandlestickChart className="size-4 text-brass" aria-hidden="true" />
              <Label>
                {chartSource === "solana-dex" ? "Live Solana DEX chart" : "CEX market chart"}
              </Label>
            </div>
            <p className="mt-1 text-xs text-faint">
              {chartSource === "solana-dex"
                ? `${chartPool ? chartPool.label : "Resolving deepest pool…"}${candleSource ? ` · ${candleSource}` : ""}${tickNote ? ` · ${tickNote}` : ""}${chartGapped ? " · data gap (showing history)" : ""}`
                : `${selectedPair} · public ${feedNote}`}
              {chartSource === "cex" &&
              positions.some(
                (position) => position.venue === "dex" && matchesPair(position, selectedPair),
              )
                ? " · DEX positions are not plotted against this market"
                : ""}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {chartSource === "solana-dex" ? (
              <span
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-faint"
                aria-live="polite"
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    streamStatus === "live"
                      ? "bg-gain"
                      : streamStatus === "error"
                        ? "bg-loss"
                        : "bg-warn",
                  )}
                />
                {streamStatus === "live"
                  ? "Live swaps"
                  : streamStatus === "waiting"
                    ? "Connected · waiting"
                    : streamStatus === "error"
                      ? "Feed unavailable"
                      : streamStatus === "reconnecting"
                        ? "Reconnecting"
                        : "Connecting"}
              </span>
            ) : null}
            <div className="text-right">
              {currentCandle ? (
                <>
                  <p className="font-mono text-lg font-semibold text-cream">
                    ${formatPrice(currentCandle.close)}
                  </p>
                  <p
                    className={cn(
                      "font-mono text-xs",
                      priceChange >= 0 ? "text-gain" : "text-loss",
                    )}
                  >
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)}% last candle
                  </p>
                </>
              ) : (
                <p className="text-xs text-faint">Quote unavailable</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex gap-1.5" aria-label="Market source">
              <button
                type="button"
                aria-pressed={chartSource === "solana-dex"}
                onClick={() => setChartSource("solana-dex")}
                className={cn(
                  "min-h-9 rounded-lg px-2.5 text-xs font-semibold",
                  chartSource === "solana-dex"
                    ? "bg-brass text-ink"
                    : "border border-line bg-panel-2 text-faint hover:text-cream",
                )}
              >
                Solana DEX
              </button>
              <button
                type="button"
                aria-pressed={chartSource === "cex"}
                onClick={() => setChartSource("cex")}
                className={cn(
                  "min-h-9 rounded-lg px-2.5 text-xs font-semibold",
                  chartSource === "cex"
                    ? "bg-brass text-ink"
                    : "border border-line bg-panel-2 text-faint hover:text-cream",
                )}
              >
                CEX
              </button>
            </div>
            {chartSource === "cex"
              ? [...PAIRS, ...FX_PAIRS].map((pair) => (
                  <button
                    key={pair}
                    type="button"
                    aria-pressed={selectedPair === pair}
                    onClick={() => setSelectedPair(pair)}
                    className={cn(
                      "min-h-9 rounded-lg px-2.5 text-xs font-semibold",
                      selectedPair === pair
                        ? "bg-brass text-ink"
                        : "border border-line bg-panel-2 text-faint hover:text-cream",
                    )}
                  >
                    {pair.includes("/") ? pair : pair.replace("USDT", "/USDT")}
                  </button>
                ))
              : tokenOptions.map((token) => (
                  <button
                    key={token}
                    type="button"
                    aria-pressed={chartToken === token}
                    onClick={() => setChartToken(token)}
                    className={cn(
                      "min-h-9 rounded-lg px-2.5 text-xs font-semibold",
                      chartToken === token
                        ? "bg-brass text-ink"
                        : "border border-line bg-panel-2 text-faint hover:text-cream",
                    )}
                  >
                    {token}
                  </button>
                ))}
          </div>
          <div
            className="flex rounded-lg border border-line bg-panel-2 p-0.5 text-xs"
            aria-label="Chart timeframe"
          >
            {TIMEFRAMES.map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={timeframe === period}
                onClick={() => setTimeframe(period)}
                className={cn(
                  "min-h-8 rounded px-2 font-medium uppercase",
                  timeframe === period ? "bg-panel text-cream" : "text-faint hover:text-cream",
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {chart ? (
          <div className="relative min-w-0 overflow-hidden rounded-lg border border-line bg-ink p-2">
            <svg
              role="img"
              aria-label={`${chartSource === "solana-dex" ? `${chartPool ? chartPool.label : chartToken} Solana DEX` : selectedPair} ${timeframe} real market candlestick chart`}
              className="block h-64 w-full sm:h-80"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
            >
              <defs>
                <clipPath id="market-chart-clip">
                  <rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP} />
                </clipPath>
              </defs>
              {[0, 1, 2, 3, 4].map((index) => {
                const ratio = index / 4;
                const y = TOP + ratio * (BOTTOM - TOP);
                const price = chart.max - ratio * (chart.max - chart.min);
                return (
                  <g key={index}>
                    <line
                      x1={LEFT}
                      y1={y}
                      x2={RIGHT}
                      y2={y}
                      stroke="var(--theme-line)"
                      strokeDasharray="3 5"
                    />
                    <text
                      x={RIGHT + 8}
                      y={y + 4}
                      fill="var(--theme-faint)"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {formatPrice(price)}
                    </text>
                  </g>
                );
              })}
              <g clipPath="url(#market-chart-clip)">
                {candles.map((candle, index) => {
                  const x = chart.x(index);
                  const rising = candle.close >= candle.open;
                  const color = rising ? "var(--theme-gain)" : "var(--theme-loss)";
                  const bodyTop = chart.y(Math.max(candle.open, candle.close));
                  const bodyBottom = chart.y(Math.min(candle.open, candle.close));
                  return (
                    <g key={`${candle.time}-${index}`}>
                      <line
                        x1={x}
                        y1={chart.y(candle.high)}
                        x2={x}
                        y2={chart.y(candle.low)}
                        stroke={color}
                        strokeWidth="1.2"
                      />
                      <rect
                        x={x - chart.barWidth / 2}
                        y={bodyTop}
                        width={chart.barWidth}
                        height={Math.max(1.5, bodyBottom - bodyTop)}
                        fill={color}
                        rx="0.5"
                      />
                    </g>
                  );
                })}
                {relevantPositions.flatMap((position) =>
                  levelsFor(position).map((level) => {
                    if (level.value < chart.min || level.value > chart.max) return null;
                    const y = chart.y(level.value);
                    return (
                      <g key={`${position.id}-${level.label}`}>
                        <line
                          x1={LEFT}
                          y1={y}
                          x2={RIGHT}
                          y2={y}
                          stroke={level.color}
                          strokeDasharray={level.dash}
                          strokeWidth="1.25"
                          opacity="0.9"
                        />
                      </g>
                    );
                  }),
                )}
                {currentCandle ? (
                  <>
                    <line
                      x1={LEFT}
                      y1={chart.y(currentCandle.close)}
                      x2={RIGHT}
                      y2={chart.y(currentCandle.close)}
                      stroke="var(--theme-brass)"
                      strokeDasharray="2 4"
                      strokeWidth="1"
                    />
                    <circle
                      cx={chart.x(candles.length - 1)}
                      cy={chart.y(currentCandle.close)}
                      r="3"
                      fill="var(--theme-brass)"
                    />
                  </>
                ) : null}
                {relevantPositions.flatMap((position) => {
                  if (position.mark < chart.min || position.mark > chart.max) return [];
                  const y = chart.y(position.mark);
                  return [
                    <g key={`mark-${position.id}`}>
                      <line
                        x1={LEFT}
                        y1={y}
                        x2={RIGHT}
                        y2={y}
                        stroke="var(--theme-cream)"
                        strokeDasharray="1 3"
                        strokeWidth="1.25"
                        opacity="0.85"
                      />
                      <circle cx={RIGHT} cy={y} r="3.5" fill="var(--theme-cream)" />
                    </g>,
                  ];
                })}
                {execMarkers.flatMap(({ exec, index }) => {
                  if (exec.price < chart.min || exec.price > chart.max) return [];
                  const up = exec.side === "BUY";
                  const color = up ? "var(--theme-gain)" : "var(--theme-loss)";
                  const cx = chart.x(index);
                  const cy = chart.y(exec.price);
                  return [
                    <g key={`exec-${exec.id}`}>
                      <polygon
                        points={up ? `${cx - 4},${cy + 5} ${cx + 4},${cy + 5} ${cx},${cy - 2}` : `${cx - 4},${cy - 5} ${cx + 4},${cy - 5} ${cx},${cy + 2}`}
                        fill={color}
                        opacity="0.95"
                      >
                        <title>{`${exec.side} ${exec.symbol} @ ${exec.price}`}</title>
                      </polygon>
                    </g>,
                  ];
                })}
              </g>
              {[candles[0], candles[Math.floor(candles.length / 2)], candles.at(-1)].map(
                (candle, index) =>
                  candle ? (
                    <text
                      key={`${candle.time}-${index}`}
                      x={[LEFT, (LEFT + RIGHT) / 2, RIGHT][index]}
                      y={HEIGHT - 5}
                      textAnchor={(["start", "middle", "end"] as const)[index]}
                      fill="var(--theme-faint)"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {new Date(candle.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </text>
                  ) : null,
              )}
            </svg>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2 text-[10px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-brass" />
                Last price
              </span>
              {relevantPositions.length ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-brass" />
                    Entry
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-gain" />
                    Target
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-loss" />
                    Stop
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-cream" />
                    Live mark
                  </span>
                </>
              ) : null}
              <span className="ml-auto">
                {feedNote}
                {lastUpdated ? ` · Updated ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
              </span>
            </div>
            {chartSource === "solana-dex" ? (
              <ol className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Recent confirmed SOL/USDC swaps (tape)">
                {solanaSwaps
                  .slice(-4)
                  .reverse()
                  .map((swap) => (
                    <li
                      key={swap.signature}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-line bg-panel-2 px-3 py-2 text-[11px]"
                    >
                      <span
                        className={cn(
                          "shrink-0 font-semibold uppercase",
                          swap.side === "buy" ? "text-gain" : "text-loss",
                        )}
                      >
                        {swap.side} SOL
                      </span>
                      <span className="truncate font-mono text-cream">
                        {swap.baseAmount.toFixed(4)} SOL · ${formatPrice(swap.priceUsd)}
                      </span>
                      <a
                        href={`https://solscan.io/tx/${encodeURIComponent(swap.signature)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-brass underline-offset-2 hover:underline"
                        aria-label={`View ${swap.dexId} transaction on Solscan`}
                      >
                        {swap.dexId}
                      </a>
                    </li>
                  ))}
              </ol>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-ink px-5 text-center">
            <CircleAlert className="size-5 text-warn" aria-hidden="true" />
            <p className="text-sm font-medium text-cream">
              {chartSource === "solana-dex"
                ? streamStatus === "waiting"
                  ? "Waiting for the first confirmed SOL/USDC swap"
                  : "Live Solana DEX chart is unavailable"
                : "Market candles are unavailable"}
            </p>
            <p className="max-w-md text-xs leading-relaxed text-faint">
              {chartSource === "solana-dex"
                ? `${feedNote}. No synthetic prices or trades are shown.`
                : `${feedNote}. No synthetic prices are shown as a substitute.`}
            </p>
          </div>
        )}
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-brass" aria-hidden="true" />
              <Label>Open positions</Label>
            </div>
            <span className={cn("text-xs", power ? "text-gain" : "text-faint")}>
              {power ? "Bot armed" : "Held on standby"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            {power
              ? "Brackets are active while armed."
              : "Standby pauses automated entries and exits. Positions stay open; close them individually when ready."}
          </p>
          {positions.length ? (
            <div className="space-y-3">
              {positions.map((position) => (
                <PositionCard key={position.id} position={position} onClose={flatten} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
              No open positions.
            </p>
          )}
        </Card>

        <Card className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-brass" aria-hidden="true" />
              <Label>Fill ledger</Label>
            </div>
            <span className="text-xs text-faint">{closedExecutions.length} session fills</span>
          </div>
          <div className="overflow-x-auto">
            {closedExecutions.length ? (
              <table className="w-full min-w-[440px] text-left text-xs">
                <thead className="border-b border-line text-faint uppercase">
                  <tr>
                    <th className="pb-2 font-normal">Time</th>
                    <th className="pb-2 font-normal">Pair</th>
                    <th className="pb-2 font-normal">Side</th>
                    <th className="pb-2 text-right font-normal">Price</th>
                    <th className="pb-2 text-right font-normal">Notional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {closedExecutions.slice(0, 20).map((execution) => (
                    <tr key={execution.id}>
                      <td className="py-2 font-mono text-faint">
                        {new Date(execution.ts).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-2 font-semibold text-cream">{execution.symbol}</td>
                      <td
                        className={cn(
                          "py-2 font-semibold",
                          execution.side === "BUY" ? "text-gain" : "text-loss",
                        )}
                      >
                        {execution.side}
                      </td>
                      <td className="py-2 text-right font-mono">{formatPrice(execution.price)}</td>
                      <td className="py-2 text-right font-mono">
                        ${execution.notional.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-8 text-center text-sm text-faint">
                No fills have been recorded this session.
              </p>
            )}
          </div>
        </Card>
      </section>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Activity className="size-4 text-brass" aria-hidden="true" />
          <Label>Bot activity</Label>
          <span className="ml-auto text-xs text-faint">
            {power ? "Running in demo mode" : "Paused"}
          </span>
        </div>
        {log.length ? (
          <ul className="space-y-2 font-mono text-xs">
            {log.slice(0, 8).map((line, index) => (
              <li key={`${line}-${index}`} className="flex gap-2 text-faint">
                <span className="text-brass" aria-hidden="true">
                  ›
                </span>
                <span className="text-cream/80">{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">No bot activity yet.</p>
        )}
      </Card>
    </div>
  );
}
