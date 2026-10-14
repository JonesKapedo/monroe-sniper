import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, History, Wallet } from "lucide-react";
import { useMascot } from "@/lib/mascot";
import { useDesk } from "@/lib/desk-store";
import { equity, exposure } from "@/lib/paper";
import { Button, Card, Label } from "@/components/ui";
import { Money, capitalMoodClass } from "@/components/money";
import { cn } from "@/lib/cn";
import { WalletButton } from "@/components/wallet-modal";
import { useWalletBalances } from "@/lib/wallet/balances";
import { formatAddress, useSolNetwork } from "@/lib/wallet/config";

function OnchainBalancesCard() {
  const { address, sol, usdc, loading, error, health, mismatch, expectedAddress, depositNote } =
    useWalletBalances();
  const network = useSolNetwork((s) => s.network);

  if (!address) {
    return (
      <Card className="flex flex-col gap-2 border-dashed">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-brass" aria-hidden="true" />
          <Label>On-chain wallet</Label>
        </div>
        <p className="text-xs text-faint">
          No wallet linked. Connect Phantom or Trust Wallet to see real SOL/USDC balances here
          (read-only — the desk still cannot move funds).
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-gain" aria-hidden="true" />
          <Label>On-chain wallet</Label>
          <span className="font-mono text-xs text-cream">{formatAddress(address)}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
              network === "mainnet-beta" ? "bg-loss/20 text-loss" : "bg-panel-2 text-faint",
            )}
          >
            {network === "mainnet-beta" ? "mainnet" : "devnet"}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
              health === "live" ? "bg-gain/20 text-gain" : "bg-warn/20 text-warn",
            )}
          >
            RPC {health}
          </span>
        </div>
      </div>
      {mismatch && (
        <p className="rounded-lg border border-loss/40 bg-loss/10 p-2.5 text-xs text-loss">
          Different wallet than expected ({expectedAddress ? formatAddress(expectedAddress) : "unknown"}).
          If you did not switch wallets yourself, disconnect immediately.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] tracking-wider text-faint uppercase">Real SOL</p>
          <p className="num mt-1 text-2xl font-bold text-cream">
            {loading ? "…" : sol !== null ? `${sol.toFixed(4)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] tracking-wider text-faint uppercase">Real USDC</p>
          <p className="num mt-1 text-2xl font-bold text-cream">
            {loading ? "…" : usdc !== null ? `$${usdc.toFixed(2)}` : "—"}
          </p>
        </div>
      </div>
      {depositNote && <p className="text-xs text-gain">{depositNote}</p>}
      {error && <p className="text-xs text-loss">{error}</p>}
      <p className="text-[11px] text-faint">
        Read-only link. Deposits are manual transfers you make in your wallet; the desk detects
        new balance and sizes paper risk against it. Trading stays paper-only.
      </p>
    </Card>
  );
}

export function WalletView() {
  const demo = useDesk((state) => state.demo);
  const fund = useDesk((state) => state.fund);
  const walletHistory = useDesk((state) => state.walletHistory);
  const [operation, setOperation] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
            Paper-trading balance only — no real deposits, withdrawals, or on-chain transfers occur
            here. Connect your wallet below to link real on-chain balances (read-only).
          </p>
        </div>
        <div className="shrink-0">
          <WalletButton />
        </div>
      </header>

      <OnchainBalancesCard />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Paper account summary">
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">PAPER EQUITY</p>
          <p className="num mt-1 text-2xl font-bold"><Money value={totalEquity} kind="balance" className={capitalMoodClass(demo.dayPnl)} /></p>
          <p className="mt-1 text-[11px] text-faint">Simulated balance</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">AVAILABLE</p>
          <p className="num mt-1 text-2xl font-bold"><Money value={demo.cash} kind="balance" className={capitalMoodClass(demo.dayPnl)} /></p>
          <p className="mt-1 text-[11px] text-faint">Paper cash</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">EXPOSURE</p>
          <p className="num mt-1 text-2xl font-bold"><Money value={currentExposure} kind="balance" className={capitalMoodClass(demo.dayPnl)} /></p>
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

    </div>
  );
}
