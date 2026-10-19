import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { money } from "@/lib/sniper/format";
import { WorkspacePanel } from "@/components/terminal/panel";

const SIDE_TONE: Record<string, string> = { BUY: "text-gain", SELL: "text-loss" };

export function Blotter() {
  const executions = useDesk((s) => s.executions);
  const liveOrders = useDesk((s) => s.liveOrders);
  const [fundsOnly, setFundsOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastCsv = useRef("");

  const rows = fundsOnly ? executions.filter((e) => e.type !== "MARKET_FLOW") : executions;

  const exportCsv = () => {
    const header = "time,side,symbol,venue,price,qty,notional,slippage_bps,type,note";
    const body = rows
      .map((e) =>
        [
          new Date(e.ts).toISOString(),
          e.side,
          e.symbol,
          e.venue,
          e.price,
          e.qty,
          e.notional,
          e.slippageBps,
          e.type,
          `"${e.note.replace(/"/g, "'")}"`,
        ].join(","),
      )
      .join("\n");
    lastCsv.current = `${header}\n${body}`;
    void navigator.clipboard?.writeText(lastCsv.current).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };

  return (
    <WorkspacePanel
      title="Blotter"
      hint={`${rows.length} fills`}
      actions={
        <>
          <button
            type="button"
            onClick={() => setFundsOnly((v) => !v)}
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors",
              fundsOnly ? "bg-brass/20 text-brass" : "text-faint hover:text-cream",
            )}
          >
            Funds
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded px-1.5 py-0.5 font-mono text-[10px] text-faint transition-colors hover:text-cream"
          >
            {copied ? "Copied" : "Export CSV"}
          </button>
        </>
      }
      bodyClassName="flex flex-col"
    >
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-[11px] text-faint">No fills yet.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[10px]">
          <div className="sticky top-0 grid grid-cols-[52px_34px_1fr_60px_70px] gap-x-2 border-b border-line/60 bg-panel px-2.5 py-1 text-[9px] tracking-wider text-faint uppercase">
            <span>Time</span>
            <span>Side</span>
            <span>Symbol / Note</span>
            <span className="text-right">Price</span>
            <span className="text-right">Notional</span>
          </div>
          {rows.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[52px_34px_1fr_60px_70px] items-center gap-x-2 border-b border-line/40 px-2.5 py-1"
            >
              <span className="text-faint">{clock(e.ts)}</span>
              <span className={cn("font-semibold", SIDE_TONE[e.side] ?? "text-cream")}>{e.side}</span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-cream">{e.symbol}</span>
                <span className="truncate text-[9px] text-faint/80">{e.note}</span>
              </div>
              <span className="text-right text-cream/80">{fmt(e.price)}</span>
              <span className="text-right text-cream/80">{money(e.notional)}</span>
            </div>
          ))}
          {liveOrders.length ? (
            <div className="border-t border-line/60">
              <p className="px-2.5 py-1 text-[9px] tracking-wider text-faint uppercase">Live orders</p>
              {liveOrders.slice(0, 12).map((o, i) => (
                <div key={`${o.at}-${i}`} className="grid grid-cols-[52px_34px_1fr] gap-x-2 px-2.5 py-1">
                  <span className="text-faint">{clock(o.at)}</span>
                  <span className={cn("font-semibold", o.side === "buy" ? "text-gain" : "text-loss")}>
                    {o.side.toUpperCase()}
                  </span>
                  <span className="truncate text-cream/80">
                    {o.symbol} · {o.ok ? "OK" : "REJECTED"} · {o.note}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </WorkspacePanel>
  );
}

function clock(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}
