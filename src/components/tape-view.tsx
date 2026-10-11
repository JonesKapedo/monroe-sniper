import { reasonLabel, sessionClock, signedMoney } from "@/lib/sniper/format";
import { useSniper } from "@/lib/sniper/store";
import { Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

export function TapeView() {
  const trades = useSniper((s) => s.book.trades);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const net = trades.reduce((sum, t) => sum + t.pnl, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium md:text-3xl">Tape</h1>
        <p className="mt-1 text-sm text-faint">
          {trades.length} closes · {trades.length ? `${wins} winners` : "no fills yet"} · net {signedMoney(net)}
        </p>
      </div>
      <Card className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="text-xs tracking-wide text-faint uppercase">
            <tr>
              <th className="pb-3 font-normal">When</th>
              <th className="pb-3 font-normal">Name</th>
              <th className="pb-3 font-normal">Side</th>
              <th className="pb-3 font-normal">Qty</th>
              <th className="pb-3 font-normal">Entry</th>
              <th className="pb-3 font-normal">Exit</th>
              <th className="pb-3 font-normal">Why</th>
              <th className="pb-3 text-right font-normal">P&L</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 40).map((trade) => (
              <tr key={trade.id} className="border-t border-line">
                <td className="py-3 font-mono text-xs text-faint">{sessionClock(trade.closedAt).label}</td>
                <td className="py-3">{trade.symbol}</td>
                <td className="py-3">{trade.side === "LONG" ? "Long" : "Short"}</td>
                <td className="py-3 font-mono">{trade.qty}</td>
                <td className="py-3 font-mono">{trade.entry.toFixed(2)}</td>
                <td className="py-3 font-mono">{trade.exit.toFixed(2)}</td>
                <td className="py-3 text-faint">{reasonLabel(trade.reason)}</td>
                <td className={cn("py-3 text-right font-mono", trade.pnl >= 0 ? "text-gain" : "text-loss")}>
                  {signedMoney(trade.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {trades.length === 0 ? <p className="text-sm text-faint">The tape is empty.</p> : null}
      </Card>
      <div className="flex flex-col gap-3 md:hidden">
        {trades.length === 0 ? (
          <Card>
            <p className="text-sm text-faint">The tape is empty.</p>
          </Card>
        ) : (
          trades.slice(0, 30).map((trade) => (
            <Card key={trade.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label>{sessionClock(trade.closedAt).label}</Label>
                  <p className="mt-1 font-medium">
                    {trade.side === "LONG" ? "Long" : "Short"} {trade.symbol}
                  </p>
                  <p className="font-mono text-xs text-faint">
                    {trade.qty} · {trade.entry.toFixed(2)} → {trade.exit.toFixed(2)} · {reasonLabel(trade.reason)}
                  </p>
                </div>
                <p className={cn("font-mono", trade.pnl >= 0 ? "text-gain" : "text-loss")}>{signedMoney(trade.pnl)}</p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
