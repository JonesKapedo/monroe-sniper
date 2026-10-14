import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, History, LockKeyhole, Wallet } from "lucide-react";
import { useMascot } from "@/lib/mascot";
import { useDesk } from "@/lib/desk-store";
import { equity, exposure } from "@/lib/paper";
import { Button, Card, Label } from "@/components/ui";
import { Money } from "@/components/money";
import { cn } from "@/lib/cn";
import { LiveModeTransitionModal } from "@/components/live-mode-transition-modal";

export function WalletView() {
  const demo = useDesk((state) => state.demo);
  const fund = useDesk((state) => state.fund);
  const walletHistory = useDesk((state) => state.walletHistory);
  const [operation, setOperation] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showLiveStatus, setShowLiveStatus] = useState(false);

  const amountValue = Number(amount);
  const amountIsValid = Number.isFinite(amountValue) && amountValue > 0;
  const totalEquity = equity(demo);
  const currentExposure = exposure(demo);

  function postPaperAdjustment() {
    setError("");
    setSuccess("");
    if (!amountIsValid) {
      setError("Enter an amount greater than zero.");
      return;
    }

    const result = fund(operation, amountValue);
    if (!result.ok) {
      setError(result.note);
      return;
    }
    setSuccess(
      operation === "in"
        ? `$${amountValue.toFixed(2)} added to the local paper balance.`
        : `$${amountValue.toFixed(2)} removed from the local paper balance.`,
    );
    useMascot.getState().ping(operation === "in" ? "bright" : "focus");
    setAmount("");
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Paper Wallet & Ledger</h1>
            <span className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-faint">
              SIMULATION
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-faint">
            No wallet or broker is connected. Adjustments on this page change only the paper-trading balance;
            no real deposits, withdrawals, or on-chain transfers occur.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setShowLiveStatus(true)} className="min-h-11 shrink-0">
          <LockKeyhole className="mr-2 size-4" aria-hidden="true" />
          Live unavailable
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Paper account summary">
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">PAPER EQUITY</p>
          <p className="num mt-1 text-2xl font-bold"><Money value={totalEquity} kind="balance" /></p>
          <p className="mt-1 text-[11px] text-faint">Simulated balance</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">AVAILABLE</p>
          <p className="num mt-1 text-2xl font-bold text-gain"><Money value={demo.cash} kind="balance" className="text-gain" /></p>
          <p className="mt-1 text-[11px] text-faint">Paper cash</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">EXPOSURE</p>
          <p className="num mt-1 text-2xl font-bold"><Money value={currentExposure} kind="balance" /></p>
          <p className="mt-1 text-[11px] text-faint">{demo.positions.length} paper positions</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">REALIZED P&L</p>
          <p className="num mt-1 text-2xl font-bold"><Money value={demo.dayPnl} kind="delta" /></p>
          <p className="mt-1 text-[11px] text-faint">{demo.trades.length} paper closes</p>
        </Card>
      </section>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Wallet className="size-4 text-brass" aria-hidden="true" />
          <Label>Paper balance adjustment</Label>
        </div>
        <div className="flex w-fit rounded-lg border border-line bg-panel-2 p-1">
          <button
            type="button"
            onClick={() => {
              setOperation("in");
              setError("");
              setSuccess("");
            }}
            aria-pressed={operation === "in"}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-semibold",
              operation === "in" ? "bg-brass text-ink" : "text-faint hover:text-cream",
            )}
          >
            <ArrowDownLeft className="size-3.5" aria-hidden="true" />
            Add paper funds
          </button>
          <button
            type="button"
            onClick={() => {
              setOperation("out");
              setError("");
              setSuccess("");
            }}
            aria-pressed={operation === "out"}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-semibold",
              operation === "out" ? "bg-brass text-ink" : "text-faint hover:text-cream",
            )}
          >
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
            Remove paper funds
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-faint" htmlFor="paper-amount">
            Amount (simulation only)
            <input
              id="paper-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError("");
                setSuccess("");
              }}
              placeholder="Enter an amount"
              className="field h-11 rounded-xl border border-line bg-panel-2 px-3.5 font-mono text-base text-cream outline-none focus:border-brass"
            />
          </label>
          <Button onClick={postPaperAdjustment} className="min-h-11 sm:min-w-44">
            {operation === "in" ? "Add to paper balance" : "Remove from paper balance"}
          </Button>
        </div>
        {error ? <p role="alert" className="text-xs font-medium text-loss">{error}</p> : null}
        {success ? <p role="status" className="text-xs font-medium text-gain">{success}</p> : null}
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-brass" aria-hidden="true" />
            <Label>Paper ledger history</Label>
          </div>
          <span className="text-xs text-faint">{walletHistory.length} local records</span>
        </div>

        {walletHistory.length === 0 ? (
          <p className="mt-3 text-xs text-faint">No paper ledger adjustments recorded.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead className="border-b border-line text-[10px] tracking-wider text-faint uppercase">
                <tr>
                  <th className="pb-2 font-normal">Time</th>
                  <th className="pb-2 font-normal">Entry</th>
                  <th className="pb-2 font-normal">Details</th>
                  <th className="pb-2 text-right font-normal">Paper amount</th>
                  <th className="pb-2 text-right font-normal">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {walletHistory.map((transaction) => {
                  const isDeposit = transaction.type === "DEPOSIT";
                  return (
                    <tr key={transaction.id} className="hover:bg-panel-2/50">
                      <td className="py-2.5 text-faint">
                        {new Date(transaction.ts).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 text-cream">{isDeposit ? "Add" : "Remove"}</td>
                      <td className="py-2.5 text-faint">{transaction.note}</td>
                      <td className={cn("py-2.5 text-right font-mono font-semibold", isDeposit ? "text-gain" : "text-loss")}>
                        {isDeposit ? "+" : "-"}${transaction.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right text-faint">Local only</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <LiveModeTransitionModal
        isOpen={showLiveStatus}
        onClose={() => setShowLiveStatus(false)}
      />
    </div>
  );
}
