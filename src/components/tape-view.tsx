import { useEffect, useMemo, useState } from "react";
import { Activity, CandlestickChart, CircleAlert, Radio } from "lucide-react";
import { Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";
import { loadKlines } from "@/lib/market.functions";
import { equity, type Position } from "@/lib/paper";
import { useDesk } from "@/lib/desk-store";
import type { Candle } from "@/lib/market.functions";

type Timeframe = "1m" | "5m" | "15m" | "1h";

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
        Paper scenarios from the last quote; not forecasts. Standby leaves this position open.
      </p>
      <button
        type="button"
        onClick={() => onClose(position.id)}
        className="mt-3 min-h-10 rounded-lg border border-loss/40 px-3 text-xs font-semibold text-loss hover:bg-loss/10"
      >
        Close {position.symbol} at last paper mark
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

  const [selectedPair, setSelectedPair] = useState(PAIRS[0]);
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [feedNote, setFeedNote] = useState("Loading public market candles…");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    const refresh = async () => {
      try {
        const result = await loadKlines({ data: { symbol: selectedPair, interval: timeframe } });
        if (!current) return;
        setCandles(result.candles);
        setFeedNote(result.note);
        setLastUpdated(result.candles.length ? Date.now() : null);
      } catch (error) {
        if (!current) return;
        setCandles([]);
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
  }, [selectedPair, timeframe]);

  const currentCandle = candles.at(-1);
  const previousCandle = candles.at(-2);
  const priceChange =
    currentCandle && previousCandle?.close
      ? ((currentCandle.close - previousCandle.close) / previousCandle.close) * 100
      : 0;
  const relevantPositions = positions.filter(
    (position) => position.venue === "binance" && matchesPair(position, selectedPair),
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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Market &amp; Paper Activity
            </h1>
            <span className="rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-xs font-semibold uppercase text-brass">
              Paper simulation
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-faint md:text-sm">
            Public market candles and simulated paper fills. No brokerage connection or real-money
            orders are available.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs sm:self-auto">
          <span
            className={cn("size-2 rounded-full", power ? "bg-gain" : "bg-faint")}
            aria-hidden="true"
          />
          <span className="font-medium">{power ? "Paper bot armed" : "Standby"}</span>
          <span className="text-faint">· {positions.length} held</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Paper equity</p>
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
          <p className="text-[11px] text-faint">{positions.length} open paper positions</p>
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
          <p className="text-[10px] tracking-wider text-faint uppercase">Paper fills</p>
          <p className="num mt-1 text-xl font-bold text-cream">{closedExecutions.length}</p>
          <p className="text-[11px] text-faint">This browser session</p>
        </Card>
      </section>

      <Card className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2">
              <CandlestickChart className="size-4 text-brass" aria-hidden="true" />
              <Label>Market price chart</Label>
            </div>
            <p className="mt-1 text-xs text-faint">
              {selectedPair} · Binance public candlestick feed
              {positions.some(
                (position) => position.venue === "dex" && matchesPair(position, selectedPair),
              )
                ? " · DEX positions are not plotted against this market"
                : ""}
            </p>
          </div>
          <div className="min-w-0 text-right">
            {currentCandle ? (
              <>
                <p className="font-mono text-lg font-semibold text-cream">
                  ${formatPrice(currentCandle.close)}
                </p>
                <p
                  className={cn("font-mono text-xs", priceChange >= 0 ? "text-gain" : "text-loss")}
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" aria-label="Market pair">
            {PAIRS.map((pair) => (
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
                {pair.replace("USDT", "/USDT")}
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
              aria-label={`${selectedPair} ${timeframe} real market candlestick chart with paper position levels`}
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
                </>
              ) : null}
              <span className="ml-auto">
                {feedNote}
                {lastUpdated ? ` · Updated ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-ink px-5 text-center">
            <CircleAlert className="size-5 text-warn" aria-hidden="true" />
            <p className="text-sm font-medium text-cream">Market candles are unavailable</p>
            <p className="max-w-md text-xs leading-relaxed text-faint">
              {feedNote}. No synthetic prices are shown as a substitute.
            </p>
          </div>
        )}
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-brass" aria-hidden="true" />
              <Label>Open paper positions</Label>
            </div>
            <span className={cn("text-xs", power ? "text-gain" : "text-faint")}>
              {power ? "Bot armed" : "Held on standby"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            {power
              ? "Paper brackets are active while armed."
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
              No open paper positions.
            </p>
          )}
        </Card>

        <Card className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-brass" aria-hidden="true" />
              <Label>Paper fill ledger</Label>
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
                No paper fills have been recorded this session.
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
            {power ? "Running in paper mode" : "Paused"}
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
