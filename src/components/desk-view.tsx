import { useEffect, useState, type ComponentType } from "react";
import { signedMoney, money, pct } from "@/lib/sniper/format";
import { snapshot } from "@/lib/sniper/risk";
import { useSniper } from "@/lib/sniper/store";
import type { CurvePoint, Position, SymbolState } from "@/lib/sniper/types";
import { Button, Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

export function DeskView() {
  const book = useSniper((s) => s.book);
  const flatten = useSniper((s) => s.flatten);
  const closePosition = useSniper((s) => s.closePosition);
  const snap = snapshot(book);
  const Chart = useEquityChart();
  const ideas = Object.values(book.signals)
    .filter((row) => row.ensemble.action !== "FLAT" && row.ensemble.confidence >= 0.4)
    .sort((a, b) => b.ensemble.confidence - a.ensemble.confidence)
    .slice(0, 5);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium md:text-3xl">Live desk</h1>
          <p className="mt-1 max-w-xl text-sm text-faint">
            Each tick is one market minute. Invo, Finviz, and Simul8or vote. Size, stop, and target are set before the fill.
          </p>
        </div>
        <Button variant="ghost" onClick={() => flatten()} disabled={book.positions.length === 0}>
          Flatten
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Equity" value={money(snap.equity)} />
        <Stat label="Day P&L" value={signedMoney(snap.dayPnl)} tone={snap.dayPnl} />
        <Stat label="Hit rate" value={book.trades.length ? pct(snap.winRate) : "—"} hint={`${book.trades.length} closes`} />
        <Stat label="Free cash" value={money(snap.free)} hint={`Risk ${money(snap.openRisk)}`} />
      </div>

      <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
        {book.symbols.map((sym) => (
          <Quote key={sym.symbol} sym={sym} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Label>Equity</Label>
          {Chart && book.curve.length > 1 ? (
            <Chart data={book.curve} />
          ) : (
            <p className="flex h-52 items-center text-sm text-faint">Curve appears after the next few minutes.</p>
          )}
        </Card>
        <Card className="max-h-80 overflow-y-auto">
          <Label>Working tape</Label>
          <ul className="mt-3 flex flex-col gap-3">
            {book.activity.slice(0, 8).map((item) => (
              <li key={item.id} className="text-sm">
                <span
                  className={cn(
                    "font-mono text-xs",
                    item.tone === "up" && "text-gain",
                    item.tone === "down" && "text-loss",
                    item.tone === "info" && "text-faint",
                  )}
                >
                  {sessionMinute(item.ts)}
                </span>
                <p className="text-cream">{item.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Label>Open risk</Label>
          {book.positions.length === 0 ? (
            <p className="mt-3 text-sm text-faint">Flat. Monroe waits until the three desks agree.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {book.positions.map((pos) => (
                <PositionRow key={pos.id} pos={pos} sym={book.symbols.find((s) => s.symbol === pos.symbol)} onClose={() => closePosition(pos.id)} />
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <Label>Agreement</Label>
          {ideas.length === 0 ? (
            <p className="mt-3 text-sm text-faint">No name is through the confidence gate.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {ideas.map((row) => (
                <li key={row.symbol} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{row.symbol}</p>
                    <p className="text-faint">{row.ensemble.note}</p>
                  </div>
                  <p className={cn("font-mono", row.ensemble.action === "BUY" ? "text-gain" : "text-loss")}>
                    {row.ensemble.action} {pct(row.ensemble.confidence)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: number }) {
  return (
    <Card>
      <Label>{label}</Label>
      <p className={cn("mt-2 font-mono text-xl md:text-2xl", tone !== undefined && (tone >= 0 ? "text-gain" : "text-loss"))}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </Card>
  );
}

function Quote({ sym }: { sym: SymbolState }) {
  const prev = sym.hist[sym.hist.length - 2] ?? sym.price;
  const delta = prev ? (sym.price - prev) / prev : 0;
  return (
    <div className="min-w-28 rounded-xl border border-line bg-panel px-3 py-2">
      <p className="text-xs text-faint">{sym.symbol}</p>
      <p className="font-mono text-sm">{sym.price.toFixed(2)}</p>
      <p className={cn("font-mono text-xs", delta >= 0 ? "text-gain" : "text-loss")}>
        {`${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(2)}%`}
      </p>
    </div>
  );
}

function PositionRow({ pos, sym, onClose }: { pos: Position; sym?: SymbolState; onClose: () => void }) {
  const px = sym?.price ?? pos.entry;
  const pnl = (pos.side === "LONG" ? px - pos.entry : pos.entry - px) * pos.qty;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 last:border-0">
      <div>
        <p className="text-sm font-medium">
          {pos.side === "LONG" ? "Long" : "Short"} {pos.symbol}{" "}
          <span className="font-mono text-faint">{pos.qty}</span>
        </p>
        <p className="font-mono text-xs text-faint">
          {pos.entry.toFixed(2)} → {px.toFixed(2)} · stop {pos.stop.toFixed(2)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className={cn("font-mono text-sm", pnl >= 0 ? "text-gain" : "text-loss")}>{signedMoney(pnl)}</p>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </li>
  );
}

function sessionMinute(minute: number) {
  const m = ((minute % 390) + 390) % 390;
  const total = 9 * 60 + 30 + m;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function useEquityChart() {
  const [Chart, setChart] = useState<ComponentType<{ data: CurvePoint[] }> | null>(null);
  useEffect(() => {
    let live = true;
    void import("@/components/equity-chart").then((mod) => {
      if (live) setChart(() => mod.EquityChart);
    });
    return () => {
      live = false;
    };
  }, []);
  return Chart;
}
