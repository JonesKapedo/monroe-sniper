import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  History,
  QrCode,
  Sparkles,
  Zap,
} from "lucide-react";
import { useMascot } from "@/components/mascot";
import { equity, exposure } from "@/lib/paper";
import { Button, Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEPOSIT_NETWORKS, type DepositNetwork } from "@/lib/sniper/deposit-networks";

const NETWORKS = [
  { id: "ETH", label: "Ethereum (ERC-20)", feeUsd: 1.5 },
  { id: "SOL", label: "Solana (SPL)", feeUsd: 0.05 },
  { id: "BSC", label: "BNB Smart Chain (BEP-20)", feeUsd: 0.2 },
  { id: "BTC", label: "Bitcoin (BTC)", feeUsd: 2.2 },
  { id: "ARB", label: "Arbitrum One", feeUsd: 0.15 },
] as const;

export function WalletView() {
  const mode = useDesk((s) => s.mode);
  const setMode = useDesk((s) => s.setMode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const fund = useDesk((s) => s.fund);
  const walletHistory = useDesk((s) => s.walletHistory);

  const book = mode === "live" ? live : demo;
  const eq = equity(book);
  const exp = exposure(book);

  const [tab, setTab] = useState<"withdraw" | "deposit">("withdraw");
  const [amount, setAmount] = useState("50");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<string>(NETWORKS[0].label);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [depositNet, setDepositNet] = useState<DepositNetwork>(DEPOSIT_NETWORKS[0]);
  const [depositCopied, setDepositCopied] = useState(false);
  const [showDepositQr, setShowDepositQr] = useState(false);

  const selectedNet = NETWORKS.find((n) => n.label === network) ?? NETWORKS[0];
  const numAmount = Number(amount) || 0;
  const netAmount = Math.max(0, numAmount - selectedNet.feeUsd);

  function handleWithdraw() {
    setError("");
    setSuccess("");

    if (!address.trim()) {
      setError("Please enter a valid destination withdrawing address.");
      return;
    }
    if (address.trim().length < 10) {
      setError("Destination wallet address appears too short or invalid.");
      return;
    }
    if (!(numAmount > 0)) {
      setError("Please enter a valid withdrawal amount greater than zero.");
      return;
    }
    if (numAmount > book.cash) {
      setError(`Insufficient free cash. Available: $${book.cash.toFixed(2)}`);
      return;
    }

    const res = fund("out", numAmount, address, network);
    if (!res.ok) {
      setError(res.note);
      return;
    }

    setSuccess(`Withdrawal of $${numAmount.toFixed(2)} posted to ${address.slice(0, 6)}…${address.slice(-4)} (${network}).`);
    useMascot.getState().ping("cigar");
    setConfirming(false);
    setAddress("");
  }

  function handleDeposit() {
    setError("");
    setSuccess("");
    if (!(numAmount > 0)) {
      setError("Please enter a valid deposit amount.");
      return;
    }
    const res = fund("in", numAmount, "", network);
    if (!res.ok) {
      setError(res.note);
      return;
    }
    setSuccess(`Successfully credited $${numAmount.toFixed(2)} to ${mode.toUpperCase()} wallet ledger.`);
    useMascot.getState().ping("boost");
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      {/* Wallet Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Trading Wallet & Ledger</h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase",
                mode === "live"
                  ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
              )}
            >
              {mode.toUpperCase()} WALLET
            </span>
          </div>
          <p className="mt-1 text-xs text-faint md:text-sm">
            {mode === "live"
              ? "Live trading ledger. Deposits and withdrawals reflect on-device ledger accounting for the live trading engine."
              : "Demo sandbox wallet. Starts with $500.00 play funds to test risk sizing, execution speed, and learning memory."}
          </p>
        </div>

        {/* Switch Mode from within Wallet */}
        <div className="flex items-center rounded-xl border border-line bg-panel-2 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("demo");
              setError("");
              setSuccess("");
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              mode === "demo" ? "bg-brass text-ink" : "text-faint hover:text-cream",
            )}
          >
            Demo ($500)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("live");
              setError("");
              setSuccess("");
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              mode === "live" ? "bg-amber-500 text-ink" : "text-faint hover:text-cream",
            )}
          >
            Live (${live.cash.toFixed(0)})
          </button>
        </div>
      </div>

      {/* Dynamic Balances Grid - Reflects Active Mode */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">{mode.toUpperCase()} TOTAL EQUITY</p>
          <p className="usd num mt-1 text-2xl font-bold">${eq.toFixed(2)}</p>
          <p className="text-[11px] text-faint">Combined balance</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">AVAILABLE CASH</p>
          <p className="num mt-1 text-2xl font-bold text-gain">${book.cash.toFixed(2)}</p>
          <p className="text-[11px] text-faint">Free to withdraw or size</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">IN ACTIVE POSITIONS</p>
          <p className="usd num mt-1 text-xl font-bold">${exp.toFixed(2)}</p>
          <p className="text-[11px] text-faint">{book.positions.length} active positions</p>
        </Card>
        <Card>
          <p className="text-[10px] tracking-wider text-faint uppercase">SESSION REALIZED P&L</p>
          <p
            className={cn(
              "num mt-1 text-xl font-bold",
              book.dayPnl >= 0 ? "text-gain" : "text-loss",
            )}
          >
            {book.dayPnl >= 0 ? "+" : ""}${book.dayPnl.toFixed(2)}
          </p>
          <p className="text-[11px] text-faint">{book.trades.length} closes</p>
        </Card>
      </div>

      {/* Main Wallet Operations: Withdraw vs Deposit */}
      <Card className="flex flex-col gap-4">
        <div className="flex border-b border-line pb-3">
          <div className="flex rounded-lg border border-line bg-panel-2 p-1">
            <button
              type="button"
              onClick={() => {
                setTab("withdraw");
                setError("");
                setSuccess("");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors",
                tab === "withdraw" ? "bg-brass text-ink" : "text-faint hover:text-cream",
              )}
            >
              <ArrowUpRight className="size-3.5" /> Withdraw Capital
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("deposit");
                setError("");
                setSuccess("");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors",
                tab === "deposit" ? "bg-brass text-ink" : "text-faint hover:text-cream",
              )}
            >
              <ArrowDownLeft className="size-3.5" /> Deposit Funds
            </button>
          </div>
        </div>

        {tab === "withdraw" ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-cream">Withdraw to External Address</h2>
              <p className="text-xs text-faint">
                Enter your external blockchain or exchange destination wallet address.
              </p>
            </div>

            {/* Withdrawing Address Input with Placeholder */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="withdraw-addr" className="text-xs font-semibold text-faint uppercase">
                Destination Withdrawing Address <span className="text-loss">*</span>
              </label>
              <div className="relative">
                <input
                  id="withdraw-addr"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter destination wallet address (e.g. 0x71C...3a9 or SOL / BTC address)"
                  className="field h-11 w-full rounded-xl border border-line bg-panel-2 px-3.5 text-xs text-cream outline-none focus:border-brass placeholder:text-faint/50"
                />
              </div>
              <p className="text-[11px] text-faint">
                Supports Ethereum (0x…), Solana Base58, Bitcoin SegWit/Taproot, and BSC addresses.
              </p>
            </div>

            {/* Network Selector */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="network-select" className="text-xs font-semibold text-faint uppercase">Transfer Network</label>
              <select
                id="network-select"
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="field h-11 rounded-xl border border-line bg-panel-2 px-3 text-xs text-cream outline-none focus:border-brass"
              >
                {NETWORKS.map((n) => (
                  <option key={n.id} value={n.label}>
                    {n.label} (Est. fee ~${n.feeUsd.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="amount-input" className="text-xs font-semibold text-faint uppercase">Amount (USD)</label>
                <span className="text-xs text-faint">Available: ${book.cash.toFixed(2)}</span>
              </div>
              <input
                id="amount-input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                className="field h-11 rounded-xl border border-line bg-panel-2 px-3.5 font-mono text-base text-cream outline-none focus:border-brass"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {[25, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className="rounded-lg border border-line bg-panel-2 px-3 py-1 text-xs text-faint hover:text-cream"
                  >
                    ${preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.floor(book.cash)))}
                  className="rounded-lg border border-line bg-panel-2 px-3 py-1 text-xs font-semibold text-brass hover:text-cream"
                >
                  MAX (${Math.floor(book.cash)})
                </button>
              </div>
            </div>

            {/* Fee & Summary Breakdown */}
            <div className="rounded-xl border border-line bg-panel-2 p-3 text-xs">
              <div className="flex justify-between py-1 text-faint">
                <span>Withdrawal Amount:</span>
                <span className="font-mono text-cream">${numAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 text-faint">
                <span>Estimated Network Gas Fee:</span>
                <span className="font-mono text-cream">-${selectedNet.feeUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-line/60 pt-2 font-semibold text-cream">
                <span>Net Estimated Receipt:</span>
                <span className="font-mono text-gain">${netAmount.toFixed(2)}</span>
              </div>
            </div>

            {error && <p className="text-xs font-medium text-loss">{error}</p>}
            {success && <p className="text-xs font-medium text-gain">{success}</p>}

            {/* Confirm or Submit */}
            {confirming ? (
              <div className="rounded-xl border border-brass/60 bg-brass/10 p-4">
                <p className="text-xs font-semibold text-brass uppercase">Confirm Withdrawal Order</p>
                <p className="mt-1 text-xs text-cream">
                  Confirm withdrawing <span className="font-bold">${numAmount.toFixed(2)}</span> to:
                </p>
                <p className="num mt-1 break-all rounded bg-panel p-2 text-xs text-cream">
                  {address} ({network})
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="danger" onClick={handleWithdraw}>
                    Confirm & Dispatch
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => {
                  if (!address.trim()) {
                    setError("Destination withdrawing address is required.");
                    return;
                  }
                  if (!(numAmount > 0)) {
                    setError("Enter an amount greater than zero.");
                    return;
                  }
                  setConfirming(true);
                }}
                disabled={book.cash <= 0}
                className="mt-2 font-semibold"
              >
                Withdraw Funds
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-semibold text-cream">Deposit Funds & On-Chain Addresses</h2>
              <p className="text-xs text-faint">
                {mode === "live"
                  ? "Send cryptocurrency or stablecoins to your dedicated Live Monroe execution address below."
                  : "Send simulated crypto to test deposit confirmation, ledger auditing, and live equity sizing."}
              </p>
            </div>

            {/* Select Deposit Network */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-faint uppercase">1. Select Blockchain Network</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {DEPOSIT_NETWORKS.map((net) => (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => {
                      setDepositNet(net);
                      setDepositCopied(false);
                      setShowDepositQr(false);
                    }}
                    className={cn(
                      "flex flex-col rounded-xl border p-2.5 text-left transition-all",
                      depositNet.id === net.id
                        ? "border-amber-400 bg-amber-500/15 text-cream shadow-xs"
                        : "border-line bg-panel-2 text-faint hover:border-line/80 hover:text-cream",
                    )}
                  >
                    <span className="text-xs font-bold">{net.name}</span>
                    <span className="text-[10px] text-brass">{net.symbol}</span>
                    <span className="mt-1 text-[9px] text-faint">{net.standard}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Deposit Address Box */}
            <div className="rounded-xl border border-line bg-panel-2 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-bold text-cream">
                    {depositNet.name} Deposit Address ({depositNet.standard})
                  </span>
                  <p className="text-[11px] text-faint">{depositNet.note}</p>
                </div>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {depositNet.confirmations}
                </span>
              </div>

              {/* The Address Bar with Copy */}
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-ink p-3">
                <span className="font-mono text-xs font-semibold text-cream break-all select-all">
                  {depositNet.address}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(depositNet.address);
                    setDepositCopied(true);
                    setTimeout(() => setDepositCopied(false), 2000);
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  {depositCopied ? (
                    <>
                      <Check className="size-4 text-gain" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" /> Copy Address
                    </>
                  )}
                </button>
              </div>

              {/* Network specs & explorer */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-xs">
                <div className="flex items-center gap-3 text-faint">
                  <span>Min deposit: <strong className="text-cream">${depositNet.minDepositUsd}</strong></span>
                  <span>Arrival: <strong className="text-cream">{depositNet.estimatedArrival}</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDepositQr(!showDepositQr)}
                    className="flex items-center gap-1 text-brass hover:text-amber-300"
                  >
                    <QrCode className="size-3.5" />
                    {showDepositQr ? "Hide QR" : "Show QR Code"}
                  </button>
                  <a
                    href={`${depositNet.explorerUrl}${depositNet.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-faint hover:text-cream"
                  >
                    Explorer <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>

              {/* QR Code Container */}
              {showDepositQr && (
                <div className="mt-3 flex flex-col items-center justify-center rounded-xl bg-white p-4">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-32 text-black"
                    fill="currentColor"
                    aria-label="Deposit QR Code"
                  >
                    <path d={depositNet.qrSvgPattern} />
                  </svg>
                  <p className="mt-2 text-[10px] text-neutral-800 font-mono text-center">
                    Deposit {depositNet.name} ({depositNet.id})
                  </p>
                </div>
              )}
            </div>

            {/* Instant Deposit Simulator Tool */}
            <div className="rounded-xl border border-line/80 bg-panel-2/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brass" />
                  <span className="text-xs font-semibold text-cream">
                    Fast Simulation & Direct Credit
                  </span>
                </div>
                <span className="text-[10px] text-faint">Immediate Settlement</span>
              </div>
              <p className="mt-1 text-xs text-faint">
                Simulate an incoming on-chain deposit confirmation to fund the {mode.toUpperCase()} desk.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="deposit-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                  placeholder="Amount in USD"
                  className="field h-10 w-full rounded-lg border border-line bg-ink px-3 font-mono text-sm text-cream sm:w-48 outline-none focus:border-brass"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[100, 250, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(String(preset))}
                      className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs text-faint hover:text-cream"
                    >
                      +${preset}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={handleDeposit}
                  className="h-10 text-xs font-bold ml-auto shrink-0"
                >
                  Confirm & Credit ${numAmount.toFixed(0)}
                </Button>
              </div>
            </div>

            {error && <p className="text-xs font-medium text-loss">{error}</p>}
            {success && <p className="text-xs font-medium text-gain">{success}</p>}
          </div>
        )}
      </Card>

      {/* Transaction & Settlement Ledger */}
      <Card>
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-brass" />
            <Label>Wallet & Ledger Audit History</Label>
          </div>
          <span className="text-xs text-faint">{walletHistory.length} ledger events</span>
        </div>

        {walletHistory.length === 0 ? (
          <p className="mt-3 text-xs text-faint">No transactions posted yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-line text-[10px] tracking-wider text-faint uppercase">
                <tr>
                  <th className="pb-2 font-normal">Date / Time</th>
                  <th className="pb-2 font-normal">Type</th>
                  <th className="pb-2 font-normal">Mode</th>
                  <th className="pb-2 font-normal">Destination / Details</th>
                  <th className="pb-2 text-right font-normal">Amount</th>
                  <th className="pb-2 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {walletHistory.map((tx) => {
                  const isDeposit = tx.type === "DEPOSIT";
                  return (
                    <tr key={tx.id} className="hover:bg-panel-2/50">
                      <td className="py-2.5 text-faint">
                        {new Date(tx.ts).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            isDeposit
                              ? "bg-gain/20 text-gain"
                              : "bg-amber-500/20 text-amber-300",
                          )}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 text-cream uppercase">{tx.mode}</td>
                      <td className="py-2.5 text-faint" title={tx.address || tx.note}>
                        {tx.address
                          ? `${tx.address.slice(0, 8)}…${tx.address.slice(-6)} (${tx.network})`
                          : tx.note}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-bold",
                          isDeposit ? "text-gain" : "text-loss",
                        )}
                      >
                        {isDeposit ? "+" : "-"}${tx.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right text-gain">
                        <span className="inline-flex items-center gap-1 rounded bg-gain/10 px-1.5 py-0.5 text-[10px] font-medium text-gain">
                          <CheckCircle2 className="size-3" /> Confirmed
                        </span>
                      </td>
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
