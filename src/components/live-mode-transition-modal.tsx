import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  QrCode,
  Sparkles,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { DEPOSIT_NETWORKS, type DepositNetwork } from "@/lib/sniper/deposit-networks";
import { useDesk } from "@/lib/desk-store";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

export function LiveModeTransitionModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [selectedNetwork, setSelectedNetwork] = useState<DepositNetwork>(DEPOSIT_NETWORKS[0]);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [step, setStep] = useState<"briefing" | "address">("briefing");
  const [simulating, setSimulating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const live = useDesk((s) => s.live);
  const fund = useDesk((s) => s.fund);

  if (!isOpen) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(selectedNetwork.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleSimulateDeposit = (amount: number) => {
    setSimulating(true);
    setTimeout(() => {
      fund("in", amount, selectedNetwork.address, selectedNetwork.name);
      setSimulating(false);
      handleActivateLive();
    }, 700);
  };

  const handleActivateLive = () => {
    setIsActivating(true);
    setTimeout(() => {
      setIsActivating(false);
      onConfirm();
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-ink/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-panel shadow-2xl shadow-amber-500/10 text-cream"
      >
        {/* Top Gold Glowing Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-500" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/20 text-amber-400">
              <Zap className="size-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
                  Production Execution
                </span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  REAL CAPITAL RAIL
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-cream">
                Switch to Live Trading Mode
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint hover:bg-panel-2 hover:text-cream transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {step === "briefing" ? (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-faint leading-relaxed">
                You are transitioning the Monroe algorithmic sniper from the{" "}
                <span className="font-semibold text-emerald-400">$500 Demo Sandbox</span> to the{" "}
                <span className="font-semibold text-amber-400">Live Execution Rail</span>. In this mode, trades route through live institutional feeds with real capital accounting.
              </p>

              {/* Security & Risk Safeguards Checklist */}
              <div className="grid gap-2.5 rounded-xl border border-line bg-panel-2 p-4">
                <p className="text-xs font-semibold text-brass uppercase tracking-wider">
                  Live Guardrails & Execution Protocols
                </p>

                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="size-4 shrink-0 text-gain mt-0.5" />
                  <div>
                    <span className="font-semibold text-cream">Pre-Trade Risk Sizing:</span>{" "}
                    <span className="text-faint">
                      Position sizes are hard-capped at 1.5% maximum capital risk per candidate.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="size-4 shrink-0 text-gain mt-0.5" />
                  <div>
                    <span className="font-semibold text-cream">Intraday 3% Drawdown Circuit Breaker:</span>{" "}
                    <span className="text-faint">
                      Automatic halt if portfolio experiences 3 consecutive losses or 3% drawdown.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="size-4 shrink-0 text-gain mt-0.5" />
                  <div>
                    <span className="font-semibold text-cream">Dedicated Multi-Chain Deposit Address:</span>{" "}
                    <span className="text-faint">
                      Direct non-custodial wallet destination generated for your live account.
                    </span>
                  </div>
                </div>
              </div>

              {/* Current Live Account State */}
              <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                <div className="flex items-center gap-2.5">
                  <Wallet className="size-5 text-amber-400" />
                  <div>
                    <p className="text-xs font-semibold text-cream">Current Live Ledger Balance</p>
                    <p className="text-[11px] text-faint">Available cash ready for deployment</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-bold text-amber-300">
                    ${live.cash.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-faint">
                    {live.cash === 0 ? "Deposit required to trade" : "Funded and ready"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="text-xs"
                >
                  Stay on Demo Sandbox
                </Button>
                <Button
                  onClick={() => setStep("address")}
                  className="bg-amber-500 hover:bg-amber-400 text-ink font-bold text-xs gap-2"
                >
                  View Deposit Address & Activate <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-brass uppercase tracking-wider">
                    Assigned Multi-Chain Deposit Address
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep("briefing")}
                    className="text-xs text-faint hover:text-cream underline"
                  >
                    Back to Overview
                  </button>
                </div>
                <p className="mt-1 text-xs text-faint">
                  Transfer USDT, USDC, SOL, ETH, or BTC to your account address below.
                </p>
              </div>

              {/* Network Selector Tabs */}
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-panel-2 p-1">
                {DEPOSIT_NETWORKS.map((net) => (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => {
                      setSelectedNetwork(net);
                      setCopied(false);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                      selectedNetwork.id === net.id
                        ? "bg-amber-500 text-ink font-bold shadow-xs"
                        : "text-faint hover:text-cream hover:bg-panel",
                    )}
                  >
                    <span>{net.name}</span>
                    <span className="text-[10px] opacity-75">({net.id})</span>
                  </button>
                ))}
              </div>

              {/* Address Container Card */}
              <div className="rounded-xl border border-line bg-panel-2 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cream">
                    {selectedNetwork.name} ({selectedNetwork.standard})
                  </span>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    {selectedNetwork.confirmations}
                  </span>
                </div>

                {/* The Address Bar */}
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-line bg-ink px-3 py-2.5">
                  <span className="font-mono text-xs font-semibold text-cream break-all select-all">
                    {selectedNetwork.address}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex shrink-0 items-center gap-1 rounded bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5 text-gain" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>

                <p className="mt-2 text-[11px] text-faint">
                  {selectedNetwork.note} · Est. arrival: {selectedNetwork.estimatedArrival}
                </p>

                {/* QR Code Toggle */}
                <div className="mt-3 border-t border-line/60 pt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowQr(!showQr)}
                    className="flex items-center gap-1.5 text-xs text-brass hover:text-amber-300"
                  >
                    <QrCode className="size-4" />
                    {showQr ? "Hide QR Code" : "Show Deposit QR Code"}
                  </button>

                  <a
                    href={`${selectedNetwork.explorerUrl}${selectedNetwork.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-faint hover:text-cream"
                  >
                    Verify on Explorer <ExternalLink className="size-3" />
                  </a>
                </div>

                {/* Visual SVG QR Representation */}
                {showQr && (
                  <div className="mt-3 flex flex-col items-center justify-center rounded-xl bg-white p-4">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-36 text-black"
                      fill="currentColor"
                      aria-label="Deposit QR Code"
                    >
                      <path d={selectedNetwork.qrSvgPattern} />
                    </svg>
                    <p className="mt-2 text-[10px] text-neutral-800 font-mono text-center">
                      Scan to deposit {selectedNetwork.name} ({selectedNetwork.id})
                    </p>
                  </div>
                )}
              </div>

              {/* Instant Simulation Credit Tool for Prototyping/Testing */}
              <div className="rounded-xl border border-line/80 bg-panel-2/60 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-brass" />
                    <span className="text-xs font-semibold text-cream">
                      Instant Live Wallet Funding Simulator
                    </span>
                  </div>
                  <span className="text-[10px] text-faint">Instant On-Chain Credit</span>
                </div>
                <p className="mt-1 text-[11px] text-faint">
                  Need to test live rail execution immediately? Simulate an incoming confirmed deposit.
                </p>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  {[250, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      disabled={simulating}
                      onClick={() => handleSimulateDeposit(amt)}
                      className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-cream hover:border-amber-400 hover:text-amber-300 transition-colors"
                    >
                      +${amt} on {selectedNetwork.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Final Confirm Button */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={onClose} disabled={isActivating} className="text-xs">
                  Cancel
                </Button>
                <Button
                  onClick={handleActivateLive}
                  disabled={isActivating}
                  className="bg-amber-500 hover:bg-amber-400 text-ink font-bold text-xs gap-2"
                >
                  {isActivating ? (
                    <>
                      <Zap className="size-4 animate-spin text-ink" /> Activating Production Rail...
                    </>
                  ) : (
                    <>
                      <Zap className="size-4 text-ink" /> Activate Live Rail Mode
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Cinematic Activating Overlay */}
        {isActivating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-ink/90 p-6 text-center backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative flex size-20 items-center justify-center rounded-2xl border-2 border-amber-400 bg-amber-500/20 text-amber-400 shadow-2xl shadow-amber-500/50 live-pulse">
              <Zap className="size-10" />
            </div>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-amber-300">
              SWITCHING TO LIVE EXECUTION RAIL
            </h3>
            <p className="mt-1.5 max-w-sm text-xs text-cream/90 font-mono">
              Binding assigned deposit address · Arming 1.5% ATR safeguards · Real-capital routing online
            </p>
            <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 animate-pulse w-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
