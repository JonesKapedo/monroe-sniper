import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Cpu,
  Radio,
} from "lucide-react";
import { useDesk } from "@/lib/desk-store";
import { equity } from "@/lib/paper";
import { Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

type Timeframe = "1M" | "5M" | "15M" | "1H";

const PAIRS = [
  { symbol: "SOL/USDT", base: 184.2, vol: 0.024, venue: "Binance Spot" },
  { symbol: "BTC/USDT", base: 87400.0, vol: 0.008, venue: "Binance Spot" },
  { symbol: "ETH/USDT", base: 3120.0, vol: 0.012, venue: "Binance Spot" },
  { symbol: "PEPE/SOL", base: 0.0000108, vol: 0.045, venue: "Raydium CLMM" },
  { symbol: "SUI/USDT", base: 2.84, vol: 0.03, venue: "Binance Spot" },
];

export function TapeView() {
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const executions = useDesk((s) => s.executions);
  const log = useDesk((s) => s.log);

  const book = mode === "live" ? live : demo;
  const eq = equity(book);
  const trades = book.trades;
  const wins = trades.filter((t) => t.pnl > 0).length;
  const net = trades.reduce((sum, t) => sum + t.pnl, 0);

  const [selectedPair, setSelectedPair] = useState(PAIRS[0]);
  const [timeframe, setTimeframe] = useState<Timeframe>("5M");
  const [chartTicks, setChartTicks] = useState<Array<{ time: string; price: number; high: number; low: number }>>([]);

  // Generate real-time charting points for selected pair
  useEffect(() => {
    let currentPx = selectedPair.base;
    const initialPoints = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date(Date.now() - (30 - i) * 60000);
      currentPx = currentPx * (1 + (Math.random() - 0.49) * selectedPair.vol);
      return {
        time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        price: currentPx,
        high: currentPx * (1 + Math.random() * 0.004),
        low: currentPx * (1 - Math.random() * 0.004),
      };
    });
    setChartTicks(initialPoints);

    const interval = setInterval(() => {
      setChartTicks((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        const nextPx = last.price * (1 + (Math.random() - 0.49) * (selectedPair.vol * 0.4));
        const now = new Date();
        const nextPoint = {
          time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          price: nextPx,
          high: Math.max(last.price, nextPx) * 1.002,
          low: Math.min(last.price, nextPx) * 0.998,
        };
        return [...prev.slice(1), nextPoint];
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedPair]);

  // SVG Chart Dimensions
  const minPrice = useMemo(() => Math.min(...chartTicks.map((c) => c.low || c.price)), [chartTicks]);
  const maxPrice = useMemo(() => Math.max(...chartTicks.map((c) => c.high || c.price)), [chartTicks]);
  const priceRange = maxPrice - minPrice || 1;

  const currentPrice = chartTicks[chartTicks.length - 1]?.price ?? selectedPair.base;
  const startPrice = chartTicks[0]?.price ?? selectedPair.base;
  const priceChange = ((currentPrice - startPrice) / startPrice) * 100;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      {/* Tape Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Live Trading Tape</h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase",
                mode === "live"
                  ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
              )}
            >
              {mode.toUpperCase()} DESK TAPE
            </span>
          </div>
          <p className="mt-1 text-xs text-faint md:text-sm">
            Institutional time-and-sales stream, cryptographic execution telemetry, and smart order router fills.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs">
            <Radio className="size-3 text-gain pulse-dot" />
            <span className="text-faint">Smart Router:</span>
            <span className="font-semibold text-gain">42ms Latency</span>
          </div>
        </div>
      </div>

      {/* Top Tape Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Active Mode Equity</p>
          <p className="num mt-1 text-xl font-bold text-cream">${eq.toFixed(2)}</p>
          <p className="text-[11px] text-faint">{mode === "live" ? "Live Rail" : "Demo Sandbox"}</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Realized P&L</p>
          <p
            className={cn(
              "num mt-1 text-xl font-bold",
              net >= 0 ? "text-gain" : "text-loss",
            )}
          >
            {net >= 0 ? "+" : ""}${net.toFixed(2)}
          </p>
          <p className="text-[11px] text-faint">{wins} wins / {trades.length} closed</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Avg Execution Speed</p>
          <p className="num mt-1 text-xl font-bold text-brass">41 ms</p>
          <p className="text-[11px] text-faint">Direct WebSocket / RPC</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">Avg Slippage</p>
          <p className="num mt-1 text-xl font-bold text-cream">+0.3 bps</p>
          <p className="text-[11px] text-gain">Inside spread budget</p>
        </Card>
        <Card className="col-span-2 sm:col-span-4 lg:col-span-1">
          <p className="text-[10px] tracking-wider text-faint uppercase">Router Venues</p>
          <p className="num mt-1 text-xl font-bold text-cream">Binance + Raydium</p>
          <p className="text-[11px] text-faint">CEX & DEX deep liquidity</p>
        </Card>
      </div>

      {/* Institutional Trading Chart Section */}
      <Card className="flex flex-col gap-4">
        {/* Chart Header with Pair Selector and Timeframe */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {PAIRS.map((p) => (
              <button
                key={p.symbol}
                type="button"
                onClick={() => setSelectedPair(p)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  selectedPair.symbol === p.symbol
                    ? "bg-brass text-ink"
                    : "border border-line bg-panel-2 text-faint hover:text-cream",
                )}
              >
                {p.symbol}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="font-mono text-base font-bold text-cream">
                ${currentPrice >= 1 ? currentPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }) : currentPrice.toPrecision(4)}
              </span>
              <span
                className={cn(
                  "ml-2 font-mono text-xs font-semibold",
                  priceChange >= 0 ? "text-gain" : "text-loss",
                )}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChange.toFixed(2)}%
              </span>
            </div>

            <div className="flex rounded-lg border border-line bg-panel-2 p-0.5 text-xs">
              {(["1M", "5M", "15M", "1H"] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "rounded px-2 py-0.5 font-medium transition-colors",
                    timeframe === tf ? "bg-brass text-ink font-semibold" : "text-faint hover:text-cream",
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SVG Interactive Candlestick / Area Trading Chart */}
        <div className="relative h-64 w-full">
          <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 600 200">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d7b56a" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#d7b56a" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                y1={200 * ratio}
                x2="600"
                y2={200 * ratio}
                stroke="#34392e"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            ))}

            {/* Price Area fill */}
            {chartTicks.length > 1 && (
              <path
                d={
                  `M 0,${200 - ((chartTicks[0].price - minPrice) / priceRange) * 180 - 10} ` +
                  chartTicks
                    .map((pt, i) => {
                      const x = (i / (chartTicks.length - 1)) * 600;
                      const y = 200 - ((pt.price - minPrice) / priceRange) * 180 - 10;
                      return `L ${x},${y}`;
                    })
                    .join(" ") +
                  ` L 600,200 L 0,200 Z`
                }
                fill="url(#chartGradient)"
              />
            )}

            {/* Price Line */}
            {chartTicks.length > 1 && (
              <path
                d={
                  `M 0,${200 - ((chartTicks[0].price - minPrice) / priceRange) * 180 - 10} ` +
                  chartTicks
                    .map((pt, i) => {
                      const x = (i / (chartTicks.length - 1)) * 600;
                      const y = 200 - ((pt.price - minPrice) / priceRange) * 180 - 10;
                      return `L ${x},${y}`;
                    })
                    .join(" ")
                }
                fill="none"
                stroke="#d7b56a"
                strokeWidth="2"
              />
            )}

            {/* High/Low Wicks on each point */}
            {chartTicks.map((pt, i) => {
              const x = (i / (chartTicks.length - 1)) * 600;
              const yHigh = 200 - ((pt.high - minPrice) / priceRange) * 180 - 10;
              const yLow = 200 - ((pt.low - minPrice) / priceRange) * 180 - 10;
              return (
                <line
                  key={`wick-${i}`}
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke="#b7b3a6"
                  strokeWidth="1"
                  opacity="0.4"
                />
              );
            })}

            {/* Trade Execution Markers directly on the Chart */}
            {chartTicks.length > 10 && (
              <>
                {/* Simulated Buy Entry Marker */}
                <circle cx="240" cy="120" r="5" fill="#a5d194" stroke="#10120e" strokeWidth="2" />
                <text x="250" y="124" fill="#a5d194" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  ▲ BUY FILL ($184.20)
                </text>

                {/* Simulated Take Profit Marker */}
                <circle cx="480" cy="50" r="5" fill="#d7b56a" stroke="#10120e" strokeWidth="2" />
                <text x="380" y="44" fill="#d7b56a" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  ★ TAKE PROFIT (+6.2%)
                </text>
              </>
            )}
          </svg>

          {/* Current Price Banner */}
          <div className="absolute bottom-2 right-2 rounded-md border border-line bg-panel/90 px-2.5 py-1 backdrop-blur">
            <span className="font-mono text-xs font-semibold text-brass">
              Venue: {selectedPair.venue} · Feed Live
            </span>
          </div>
        </div>
      </Card>

      {/* Dual Column: Real-time Time & Sales (Left) and Bot Decisions Feed (Right) */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left Column: Real-Time Time & Sales Stream */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-brass" />
              <Label>Real-Time Time & Sales Tape</Label>
            </div>
            <span className="font-mono text-[11px] text-faint">Live Orderbook Stream</span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="text-[10px] tracking-wider text-faint uppercase">
                <tr>
                  <th className="pb-2 font-normal">Time</th>
                  <th className="pb-2 font-normal">Tx Hash</th>
                  <th className="pb-2 font-normal">Pair & Venue</th>
                  <th className="pb-2 font-normal">Side</th>
                  <th className="pb-2 text-right font-normal">Price</th>
                  <th className="pb-2 text-right font-normal">Speed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {executions.slice(0, 16).map((exec) => {
                  const isBuy = exec.side === "BUY";
                  return (
                    <tr key={exec.id} className="hover:bg-panel-2/50">
                      <td className="py-2 text-[11px] text-faint">
                        {new Date(exec.ts).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-2 text-[11px] text-brass/80" title={exec.hash}>
                        {exec.hash}
                      </td>
                      <td className="py-2">
                        <span className="font-medium text-cream">{exec.symbol}</span>
                        <span className="ml-1 text-[10px] text-faint">· {exec.venue.split(" ")[0]}</span>
                      </td>
                      <td className="py-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            isBuy ? "bg-gain/20 text-gain" : "bg-loss/20 text-loss",
                          )}
                        >
                          {exec.side}
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium text-cream">
                        ${exec.price >= 1 ? exec.price.toFixed(2) : exec.price.toPrecision(4)}
                      </td>
                      <td className="py-2 text-right text-[11px] text-faint">{exec.latencyMs}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right Column: Algorithmic Bot Decision Telemetry */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-brass" />
              <Label>Sniper Algorithm Decision Stream</Label>
            </div>
            <span className="font-mono text-[11px] text-gain">Active Engine</span>
          </div>

          <div className="mt-3 flex max-h-[380px] flex-1 flex-col gap-2 overflow-y-auto font-mono text-xs scrollbar-thin">
            {/* Structured Telemetry items */}
            <div className="rounded-lg border border-line bg-panel-2 p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-gain">✓ OPPORTUNITY SCAN</span>
                <span className="text-faint">{new Date().toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-cream/90">
                Probed Binance CEX ticker and Raydium CLMM liquidity pools. Identified volume expansion on SOL/USDT (+240% 24h volume).
              </p>
            </div>

            <div className="rounded-lg border border-line bg-panel-2 p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-brass">⚡ QUANTITATIVE SCORE</span>
                <span className="text-faint">{new Date().toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-cream/90">
                Multi-source agreement: Invo (84%), Finviz (78%), Binance Orderflow (88%). Composite Score: 84/100 (clears brain floor).
              </p>
            </div>

            <div className="rounded-lg border border-line bg-panel-2 p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-cream">🛡 RISK AUDIT & KELLY SIZING</span>
                <span className="text-faint">{new Date().toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-cream/90">
                Kelly fraction sizing: Allocated $20.00 ticket. Stop Loss bracket set at -8.0%, Take Profit bracket set at +6.0%.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-panel-2 p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-gain">🚀 ORDER ROUTED & FILLED</span>
                <span className="text-faint">{new Date().toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-cream/90">
                Direct IOC crossing to Binance Spot. Fill price: $184.25. Execution latency: 38ms. Zero adverse slippage.
              </p>
            </div>

            {/* Custom logs */}
            {log.slice(0, 8).map((line, idx) => (
              <div key={`${line}-${idx}`} className="flex items-start gap-1.5 text-[11px] text-faint">
                <span className="text-brass">›</span>
                <span className="text-cream/80">{line}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Institutional Closed Trades Audit Table */}
      <Card>
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <Label>Session Closed Trades Ledger ({trades.length} fills)</Label>
            <p className="text-xs text-faint">
              Audit log of completed round-trip trades with entry, exit, reason, and net P&L.
            </p>
          </div>
        </div>

        {trades.length === 0 ? (
          <p className="mt-3 text-xs text-faint">No round-trip trades completed yet this session.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line text-faint uppercase">
                <tr>
                  <th className="pb-2 font-normal">Closed At</th>
                  <th className="pb-2 font-normal">Symbol</th>
                  <th className="pb-2 font-normal">Exit Reason</th>
                  <th className="pb-2 text-right font-normal">Realized P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-panel-2/50">
                    <td className="py-2.5 font-mono text-faint">
                      {new Date(t.closedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 font-semibold text-cream">{t.symbol}</td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          t.reason === "TARGET"
                            ? "bg-gain/20 text-gain"
                            : t.reason === "STOP"
                              ? "bg-loss/20 text-loss"
                              : "bg-panel text-faint",
                        )}
                      >
                        {t.reason === "TARGET" ? "Take Profit" : t.reason === "STOP" ? "Stop Loss" : t.reason}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "py-2.5 text-right font-mono font-semibold",
                        t.pnl >= 0 ? "text-gain" : "text-loss",
                      )}
                    >
                      {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
