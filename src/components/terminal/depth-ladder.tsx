import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { loadDepth, type DepthLevel } from "@/lib/market.functions";
import { usePriceHistory } from "@/lib/price-history";
import { WorkspacePanel } from "@/components/terminal/panel";

type Book = { bids: DepthLevel[]; asks: DepthLevel[]; note: string };

/** Poll cadence for the book snapshot. */
const POLL_MS = 4_000;

export function DepthLadder({ symbol }: { symbol: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [failed, setFailed] = useState(false);
  const series = usePriceHistory((s) => s.series);
  const timer = useRef(0);

  useEffect(() => {
    if (!symbol) return;
    let cancel = false;
    const pull = async () => {
      try {
        const res = await loadDepth({ data: { symbol, limit: 16 } });
        if (cancel) return;
        setBook(res);
        setFailed(!res.bids.length && !res.asks.length);
      } catch {
        if (!cancel) setFailed(true);
      }
    };
    void pull();
    timer.current = window.setInterval(pull, POLL_MS);
    return () => {
      cancel = true;
      window.clearInterval(timer.current);
    };
  }, [symbol]);

  const asks = useMemo(() => (book ? [...book.asks].sort((a, b) => b.price - a.price) : []), [book]);
  const bids = useMemo(() => (book ? [...book.bids].sort((a, b) => b.price - a.price) : []), [book]);

  const cum = useMemo(() => {
    let a = 0;
    const askCum = asks.map((l) => (a += l.qty));
    let b = 0;
    const bidCum = bids.map((l) => (b += l.qty));
    return { askCum, bidCum, max: Math.max(a, b, 1e-9) };
  }, [asks, bids]);

  const bestAsk = asks.length ? asks[asks.length - 1].price : null;
  const bestBid = bids.length ? bids[0].price : null;
  const spread = bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null;
  const spreadBps = spread !== null && bestAsk ? (spread / bestAsk) * 10_000 : null;

  const bidVol = cum.bidCum[cum.bidCum.length - 1] ?? 0;
  const askVol = cum.askCum[cum.askCum.length - 1] ?? 0;
  const imbalance = bidVol + askVol > 0 ? bidVol / (bidVol + askVol) : 0.5;

  const flow = useMemo(() => {
    const pts = series[symbol] ?? [];
    let up = 0;
    let down = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].p - pts[i - 1].p;
      if (d > 0) up += d;
      else if (d < 0) down -= d;
    }
    const total = up + down;
    return total > 0 ? up / total : 0.5;
  }, [series, symbol]);

  return (
    <WorkspacePanel
      title="Depth"
      hint={<span className="font-mono text-[10px] text-faint">{symbol}</span>}
      actions={
        spreadBps !== null ? (
          <span className="font-mono text-[10px] text-faint">sprd {spreadBps.toFixed(1)} bps</span>
        ) : null
      }
      bodyClassName="flex flex-col"
    >
      {failed || (!asks.length && !bids.length) ? (
        <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-faint">
          No order book for <span className="font-mono text-cream">{symbol}</span>.
          <br />
          Depth streams for CEX pairs.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col font-mono text-[10px]">
          <div className="grid grid-cols-[1fr_1fr_44px] gap-x-2 border-b border-line/60 px-2 py-0.5 text-[9px] tracking-wider text-faint uppercase">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Sum</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {askedRows(asks, cum.askCum, cum.max)}
            <div className="flex items-center justify-between border-y border-line/60 bg-panel-2/60 px-2 py-1">
              <span className="text-cream">{bestBid !== null ? fmt(bestBid) : "—"}</span>
              <span className="text-[9px] text-faint">spread</span>
              <span className="text-cream">{bestAsk !== null ? fmt(bestAsk) : "—"}</span>
            </div>
            {bidRows(bids, cum.bidCum, cum.max)}
          </div>
          <Meter label="Book" value={imbalance} left="Bid" right="Ask" />
          <Meter label="Flow" value={flow} left="Buy" right="Sell" />
        </div>
      )}
    </WorkspacePanel>
  );
}

function askedRows(rows: DepthLevel[], cumArr: number[], max: number) {
  return rows.map((l, i) => (
    <Row key={`a${i}`} level={l} cum={cumArr[i]} max={max} tone="ask" />
  ));
}

function bidRows(rows: DepthLevel[], cumArr: number[], max: number) {
  return rows.map((l, i) => <Row key={`b${i}`} level={l} cum={cumArr[i]} max={max} tone="bid" />);
}

function Row({ level, cum, max, tone }: { level: DepthLevel; cum: number; max: number; tone: "bid" | "ask" }) {
  const pct = Math.min(100, (cum / max) * 100);
  return (
    <div className="relative grid grid-cols-[1fr_1fr_44px] gap-x-2 px-2 py-[1px]">
      <div
        className={cn("absolute inset-y-0 right-0 opacity-[0.14]", tone === "ask" ? "bg-loss" : "bg-gain")}
        style={{ width: `${pct}%` }}
      />
      <span className={cn("relative", tone === "ask" ? "text-loss" : "text-gain")}>{fmt(level.price)}</span>
      <span className="relative text-right text-cream/80">{level.qty.toFixed(4)}</span>
      <span className="relative text-right text-faint">{cum.toFixed(2)}</span>
    </div>
  );
}

function Meter({ label, value, left, right }: { label: string; value: number; left: string; right: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="border-t border-line/60 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between text-[9px] tracking-wider text-faint uppercase">
        <span>{left}</span>
        <span>{label} {pct}%</span>
        <span>{right}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-loss/30">
        <div className="h-full bg-gain" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toPrecision(4);
}
