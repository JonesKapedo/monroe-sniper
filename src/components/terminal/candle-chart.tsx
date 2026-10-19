import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Candle } from "@/lib/price-history";
import type { Position } from "@/lib/paper";

export type ChartOverlay = { price: number; label: string; tone: "entry" | "stop" | "target" };

const PAD = { top: 10, right: 56, bottom: 18, left: 8 };

/**
 * Canvas-free candlestick chart: wicks + bodies + a live last-price rail, with
 * position overlays (entry / stop / target) and a crosshair OHLC readout. Sizes
 * to its container, so it drops into any resizable panel.
 */
export function CandleChart({
  candles,
  overlays = [],
  height = 320,
}: {
  candles: Candle[];
  overlays?: ChartOverlay[];
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const view = useMemo(() => {
    const plotW = Math.max(1, width - PAD.left - PAD.right);
    const plotH = Math.max(1, height - PAD.top - PAD.bottom);
    if (!candles.length) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of candles) {
      lo = Math.min(lo, c.l);
      hi = Math.max(hi, c.h);
    }
    for (const o of overlays) {
      if (Number.isFinite(o.price) && o.price > 0) {
        lo = Math.min(lo, o.price);
        hi = Math.max(hi, o.price);
      }
    }
    const pad = (hi - lo) * 0.06 || hi * 0.01 || 1;
    lo -= pad;
    hi += pad;
    const span = hi - lo || 1;
    const y = (p: number) => PAD.top + (1 - (p - lo) / span) * plotH;
    const step = plotW / candles.length;
    const bodyW = Math.max(1, Math.min(step * 0.7, 14));
    const x = (i: number) => PAD.left + i * step + step / 2;
    return { plotW, plotH, lo, hi, y, step, bodyW, x };
  }, [candles, overlays, width, height]);

  const last = candles[candles.length - 1];
  const active = hover !== null ? candles[hover] : last;

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      {!view || !active ? (
        <div className="flex h-full items-center justify-center text-[11px] text-faint">
          Waiting for price ticks…
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute top-1.5 left-2 z-10 flex items-center gap-3 font-mono text-[10px]">
            <span className="text-faint">O</span>
            <span className="text-cream">{fmt(active.o)}</span>
            <span className="text-faint">H</span>
            <span className="text-cream">{fmt(active.h)}</span>
            <span className="text-faint">L</span>
            <span className="text-cream">{fmt(active.l)}</span>
            <span className="text-faint">C</span>
            <span className={cn(active.c >= active.o ? "text-gain" : "text-loss")}>{fmt(active.c)}</span>
          </div>
          <svg
            width={width}
            height={height}
            className="block select-none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - rect.left - PAD.left;
              const idx = Math.round((px - view.step / 2) / view.step);
              setHover(idx >= 0 && idx < candles.length ? idx : null);
            }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="candleUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--theme-gain)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="var(--theme-gain)" stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id="candleDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--theme-loss)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="var(--theme-loss)" stopOpacity="0.55" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const price = view.hi - f * (view.hi - view.lo);
              const yy = view.y(price);
              return (
                <g key={f}>
                  <line x1={PAD.left} x2={PAD.left + view.plotW} y1={yy} y2={yy} stroke="var(--theme-line)" strokeWidth={0.5} strokeOpacity={0.5} />
                  <text x={PAD.left + view.plotW + 6} y={yy + 3} fill="var(--theme-faint)" fontSize={9} fontFamily="var(--font-mono)">
                    {fmt(price)}
                  </text>
                </g>
              );
            })}

            {candles.map((c, i) => {
              const up = c.c >= c.o;
              const cx = view.x(i);
              const yO = view.y(c.o);
              const yC = view.y(c.c);
              const top = Math.min(yO, yC);
              const bh = Math.max(1, Math.abs(yC - yO));
              return (
                <g key={c.t}>
                  <line x1={cx} x2={cx} y1={view.y(c.h)} y2={view.y(c.l)} stroke={up ? "var(--theme-gain)" : "var(--theme-loss)"} strokeWidth={1} />
                  <rect x={cx - view.bodyW / 2} y={top} width={view.bodyW} height={bh} fill={up ? "url(#candleUp)" : "url(#candleDown)"} />
                </g>
              );
            })}

            {overlays.map((o, i) =>
              Number.isFinite(o.price) && o.price > 0 ? (
                <g key={i}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + view.plotW}
                    y1={view.y(o.price)}
                    y2={view.y(o.price)}
                    stroke={o.tone === "entry" ? "var(--theme-brass)" : o.tone === "target" ? "var(--theme-gain)" : "var(--theme-loss)"}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    strokeOpacity={0.8}
                  />
                  <text
                    x={PAD.left + 4}
                    y={view.y(o.price) - 3}
                    fill={o.tone === "entry" ? "var(--theme-brass)" : o.tone === "target" ? "var(--theme-gain)" : "var(--theme-loss)"}
                    fontSize={9}
                    fontFamily="var(--font-mono)"
                    textAnchor="start"
                  >
                    {o.label} {fmt(o.price)}
                  </text>
                </g>
              ) : null,
            )}

            {last ? (
              <g>
                <line x1={PAD.left} x2={PAD.left + view.plotW} y1={view.y(last.c)} y2={view.y(last.c)} stroke="var(--theme-brass)" strokeWidth={0.75} strokeOpacity={0.7} />
                <rect x={PAD.left + view.plotW + 1} y={view.y(last.c) - 7} width={PAD.right - 2} height={14} fill="var(--theme-brass)" />
                <text x={PAD.left + view.plotW + 4} y={view.y(last.c) + 3.5} fill="var(--theme-brass-ink)" fontSize={9} fontWeight={600} fontFamily="var(--font-mono)">
                  {fmt(last.c)}
                </text>
              </g>
            ) : null}

            {hover !== null && candles[hover] ? (
              <g>
                <line x1={view.x(hover)} x2={view.x(hover)} y1={PAD.top} y2={PAD.top + view.plotH} stroke="var(--theme-cream)" strokeWidth={0.5} strokeOpacity={0.4} />
              </g>
            ) : null}
          </svg>
        </>
      )}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toPrecision(4);
}

/** Build overlay lines for every open position on `symbol`. */
export function positionOverlays(positions: Position[], symbol: string): ChartOverlay[] {
  const out: ChartOverlay[] = [];
  for (const p of positions) {
    if (p.symbol !== symbol) continue;
    out.push({ price: p.entryPrice, label: "ENT", tone: "entry" });
    out.push({ price: p.stop, label: "STOP", tone: "stop" });
    if (p.target) out.push({ price: p.target, label: "TP", tone: "target" });
  }
  return out;
}
