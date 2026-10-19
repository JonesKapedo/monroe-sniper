import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { equity } from "@/lib/paper";
import { money } from "@/lib/sniper/format";
import { useWorkspace } from "@/lib/workspace-store";
import { WorkspacePanel } from "@/components/terminal/panel";

export function PositionsPanel() {
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const tape = useDesk((s) => s.tape);
  const flatten = useDesk((s) => s.flatten);
  const flattenAll = useDesk((s) => s.flattenAll);
  const setSymbol = useWorkspace((s) => s.setSymbol);

  const book = mode === "live" ? live : demo;
  const eq = equity(book);
  const openPnl = book.positions.reduce((sum, p) => sum + (p.mark - p.entryPrice) * p.qty, 0);

  return (
    <WorkspacePanel
      title="Positions"
      hint={
        <span className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="text-faint">{book.positions.length} open</span>
          <span className={cn(openPnl >= 0 ? "text-gain" : "text-loss")}>
            {openPnl >= 0 ? "+" : ""}
            {money(openPnl)}
          </span>
        </span>
      }
      actions={
        book.positions.length ? (
          <button
            type="button"
            onClick={flattenAll}
            className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint transition-colors hover:border-loss/50 hover:text-loss"
          >
            Flatten all
          </button>
        ) : null
      }
      bodyClassName="flex flex-col"
    >
      {book.positions.length === 0 ? (
        <p className="px-3 py-6 text-center text-[11px] text-faint">
          No open positions. Select a symbol and buy from the ticket.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 border-b border-line/60 px-2.5 py-1 font-mono text-[9px] tracking-wider text-faint uppercase">
            <span>Symbol / Entry</span>
            <span className="text-right">Qty · uPnL</span>
            <span />
          </div>
          {book.positions.map((p) => {
            const pnl = (p.mark - p.entryPrice) * p.qty;
            const pct = p.entryPrice > 0 ? ((p.mark - p.entryPrice) / p.entryPrice) * 100 : 0;
            const risk = p.entryPrice - p.stop;
            const r = risk !== 0 ? (p.mark - p.entryPrice) / risk : 0;
            const onTape = tape.some((c) => c.symbol === p.symbol);
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 border-b border-line/40 px-2.5 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    const c = tape.find((t) => t.symbol === p.symbol);
                    if (c) setSymbol(c.id);
                  }}
                  className={cn("flex min-w-0 flex-col text-left", onTape ? "cursor-pointer" : "cursor-default")}
                >
                  <span className="truncate font-mono text-[11px] font-medium text-cream">{p.symbol}</span>
                  <span className="font-mono text-[9px] text-faint">
                    @{fmt(p.entryPrice)} · stop {fmt(p.stop)}
                    {p.target ? ` · tp ${fmt(p.target)}` : ""}
                  </span>
                </button>
                <div className="flex flex-col items-end font-mono text-[10px]">
                  <span className="text-cream/80">{p.qty.toFixed(4)}</span>
                  <span className={cn(pnl >= 0 ? "text-gain" : "text-loss")}>
                    {pnl >= 0 ? "+" : ""}
                    {money(pnl)}
                  </span>
                  <span className="text-[9px] text-faint">
                    {pct >= 0 ? "+" : ""}
                    {pct.toFixed(2)}% · {r.toFixed(2)}R
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => flatten(p.id)}
                  className="rounded border border-line px-1.5 py-1 font-mono text-[10px] text-faint transition-colors hover:border-loss/50 hover:text-loss"
                >
                  Close
                </button>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-2.5 py-1.5 font-mono text-[10px] text-faint">
            <span>Cash</span>
            <span className="text-cream/80">{money(book.cash)}</span>
          </div>
          <div className="flex items-center justify-between px-2.5 py-0.5 font-mono text-[10px] text-faint">
            <span>Equity</span>
            <span className="text-cream/80">{money(eq)}</span>
          </div>
        </div>
      )}
    </WorkspacePanel>
  );
}

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}
