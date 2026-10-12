import { pct } from "@/lib/sniper/format";
import { useSniper } from "@/lib/sniper/store";
import { useDesk } from "@/lib/desk-store";
import { type QuoteSignal, type Side } from "@/lib/sniper/types";
import { Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

export function SignalsView() {
  const book = useSniper((s) => s.book);
  const tape = useDesk((s) => s.tape);
  const memory = useDesk((s) => s.memory);
  const rows = book.symbols.map((sym) => ({ sym, set: book.signals[sym.symbol] }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Multi-Source Signal Intelligence</h1>
          <span className="rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-xs font-semibold text-brass uppercase">
            5-Source Consensus
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-xs text-faint md:text-sm">
          Monroe combines institutional feeds, geometric technicals, orderbook queues, and live Binance/DEX flow. Trades only enter when the ensemble clears the adaptive brain threshold.
        </p>
      </div>

      {/* Provider Status Badges */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-line bg-panel">
          <div className="flex items-center justify-between">
            <Label>Binance Spot CEX</Label>
            <span className="size-2 rounded-full bg-gain pulse-dot" />
          </div>
          <p className="mt-1 text-xs text-cream">Order flow & 24h volume delta</p>
          <p className="mt-2 text-[11px] text-brass">Weight 30% · Live WebSockets</p>
        </Card>

        <Card className="border-line bg-panel">
          <div className="flex items-center justify-between">
            <Label>DexScreener Pools</Label>
            <span className="size-2 rounded-full bg-gain pulse-dot" />
          </div>
          <p className="mt-1 text-xs text-cream">Raydium & Uniswap liquidity</p>
          <p className="mt-2 text-[11px] text-brass">Weight 25% · On-Chain RPC</p>
        </Card>

        <Card className="border-line bg-panel">
          <div className="flex items-center justify-between">
            <Label>Invo Institutional</Label>
            <span className="size-2 rounded-full bg-gain" />
          </div>
          <p className="mt-1 text-xs text-cream">Macro positioning & index bias</p>
          <p className="mt-2 text-[11px] text-brass">Weight 20% · Factor desk</p>
        </Card>

        <Card className="border-line bg-panel">
          <div className="flex items-center justify-between">
            <Label>Finviz Breakout</Label>
            <span className="size-2 rounded-full bg-gain" />
          </div>
          <p className="mt-1 text-xs text-cream">Volatility squeeze & geometry</p>
          <p className="mt-2 text-[11px] text-brass">Weight 15% · Pattern engine</p>
        </Card>

        <Card className="border-line bg-panel">
          <div className="flex items-center justify-between">
            <Label>Simul8or Queue</Label>
            <span className="size-2 rounded-full bg-gain" />
          </div>
          <p className="mt-1 text-xs text-cream">Microstructure adverse selection</p>
          <p className="mt-2 text-[11px] text-brass">Weight 10% · Level 2 Sim</p>
        </Card>
      </div>

      {/* Live Global Pair Signal Consensus */}
      {tape.length > 0 && (
        <Card>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <Label>Active Global Market Candidates ({tape.length} pairs live)</Label>
              <p className="text-xs text-faint">
                Live quantitative score computed from real 24h volume, price momentum, and spread depth.
              </p>
            </div>
            <span className="font-mono text-xs text-brass">Brain Threshold: {memory.minScore}/100</span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line text-[10px] tracking-wider text-faint uppercase">
                <tr>
                  <th className="pb-2 font-normal">Pair & Venue</th>
                  <th className="pb-2 font-normal">Price (USD)</th>
                  <th className="pb-2 font-normal">24h Vol</th>
                  <th className="pb-2 font-normal">Momentum</th>
                  <th className="pb-2 font-normal">Ensemble Score</th>
                  <th className="pb-2 text-right font-normal">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {tape.slice(0, 10).map((c) => {
                  const pass = c.score >= memory.minScore;
                  return (
                    <tr key={c.id} className="hover:bg-panel-2/50 font-mono">
                      <td className="py-2.5">
                        <span className="font-bold text-cream">{c.symbol}</span>
                        <span className="ml-1 text-[10px] text-faint uppercase">({c.venue})</span>
                      </td>
                      <td className="py-2.5 text-cream">
                        ${c.priceUsd >= 1 ? c.priceUsd.toFixed(2) : c.priceUsd.toPrecision(4)}
                      </td>
                      <td className="py-2.5 text-faint">
                        ${Math.round(c.volume24h).toLocaleString()}
                      </td>
                      <td className={cn("py-2.5 font-bold", c.change24h >= 0 ? "text-gain" : "text-loss")}>
                        {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(2)}%
                      </td>
                      <td className="py-2.5">
                        <span className={cn("font-bold", pass ? "text-brass" : "text-faint")}>
                          {c.score}/100
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                            pass ? "bg-gain/20 text-gain" : "bg-panel text-faint",
                          )}
                        >
                          {pass ? "APPROVED FOR FILL" : "REJECTED (LOW SCORE)"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Primary Equities Universe Consensus */}
      <Card>
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <Label>Microstructure Tick Signals</Label>
            <p className="text-xs text-faint">Breakdown of votes from Invo, Finviz, and Simul8or models.</p>
          </div>
        </div>

        <ul className="mt-2 divide-y divide-line/40">
          {rows.map(({ sym, set }) => (
            <li key={sym.symbol} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-cream">
                  {sym.symbol} <span className="text-xs font-normal text-faint">({sym.sector})</span>
                </p>
                <p className="font-mono text-xs text-cream">${sym.price.toFixed(2)}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Sig label="Invo Desk" sig={set?.invo} />
                <Sig label="Finviz Geometry" sig={set?.finviz} />
                <Sig label="Simul8or Queue" sig={set?.simul8or} />
                <Sig label="Ensemble Composite" sig={set?.ensemble} strong />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Sig({ label, sig, strong = false }: { label: string; sig?: QuoteSignal; strong?: boolean }) {
  if (!sig) return <span className="text-faint">—</span>;
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-2">
      <p className="text-[10px] text-faint uppercase">{label}</p>
      <p className={cn("font-mono text-xs font-semibold", tone(sig.action), strong && "text-sm font-bold")}>
        {sig.action} {pct(sig.confidence)}
      </p>
      <p className="text-[11px] text-faint truncate">{sig.note}</p>
    </div>
  );
}

function tone(action: Side) {
  if (action === "BUY") return "text-gain";
  if (action === "SELL") return "text-loss";
  return "text-faint";
}
