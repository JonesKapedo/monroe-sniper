import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { create } from "zustand";
import { AlertTriangle, LogOut, ShieldCheck, Wallet as WalletIcon, X } from "lucide-react";
import { Button, Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getLiveStatus } from "@/lib/trading/live/live.functions";
import type { LiveStatus } from "@/lib/trading/live/types";
import { SolanaWalletProvider } from "@/lib/wallet/provider";
import {
  formatAddress,
  useSolNetwork,
  walletConnectProjectId,
  type SolanaNetwork,
} from "@/lib/wallet/config";
import { useWalletBalances } from "@/lib/wallet/balances";

export { SolanaWalletProvider };

type ModalState = { open: boolean; setOpen: (open: boolean) => void };

export const useWalletModal = create<ModalState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

function NetworkSwitch() {
  const network = useSolNetwork((s) => s.network);
  const setNetwork = useSolNetwork((s) => s.setNetwork);
  const { disconnect } = useWallet();

  const switchTo = (next: SolanaNetwork) => {
    if (next === network) return;
    if (
      !window.confirm(
        `Switch Solana network to ${next}? This disconnects your wallet first — reconnect afterwards.`,
      )
    ) {
      return;
    }
    void disconnect().catch(() => undefined);
    setNetwork(next);
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-faint">Network:</span>
      {(["devnet", "mainnet-beta"] as const).map((net) => (
        <button
          key={net}
          type="button"
          onClick={() => switchTo(net)}
          aria-pressed={network === net}
          className={cn(
            "rounded-lg px-2.5 py-1 font-semibold",
            network === net
              ? net === "mainnet-beta"
                ? "bg-loss/20 text-loss"
                : "bg-brass text-ink"
              : "border border-line text-faint hover:text-cream",
          )}
        >
          {net === "mainnet-beta" ? "mainnet" : net}
        </button>
      ))}
    </div>
  );
}

/** Header wallet button: connect prompt, or address + network when linked. */
export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { publicKey, disconnect, wallet } = useWallet();
  const network = useSolNetwork((s) => s.network);
  const setOpen = useWalletModal((s) => s.setOpen);
  const { health, mismatch } = useWalletBalances();

  if (!publicKey) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brass/50 bg-brass/10 px-2 text-xs font-semibold text-brass transition-colors hover:bg-brass/20 sm:px-3",
          compact && "min-h-9",
        )}
      >
        <WalletIcon className="size-4" />
        Connect wallet
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title={`${wallet?.adapter.name ?? "Wallet"} connected (click for settings)`}
      onDoubleClick={() => void disconnect().catch(() => undefined)}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-2 font-mono text-xs transition-colors sm:px-3",
        mismatch
          ? "border-loss/60 bg-loss/10 text-loss"
          : "border-gain/50 bg-gain/10 text-gain hover:bg-gain/20",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          health === "live" ? "bg-gain" : health === "idle" ? "bg-faint" : "bg-warn",
        )}
      />
      <span className="hidden text-[10px] tracking-wide text-faint uppercase sm:inline">
        {wallet?.adapter.name ?? "Wallet"}
      </span>
      {formatAddress(publicKey.toBase58())}
      <span className={cn("rounded px-1 text-[10px] uppercase", network === "mainnet-beta" ? "bg-loss/20 text-loss" : "bg-panel-2 text-faint")}>
        {network === "mainnet-beta" ? "main" : "dev"}
      </span>
    </button>
  );
}

export function WalletModal() {
  const open = useWalletModal((s) => s.open);
  const setOpen = useWalletModal((s) => s.setOpen);
  const { wallets, select, connect, disconnect, publicKey, connecting, wallet } = useWallet();
  const { sol, usdc, loading, error, health, mismatch, expectedAddress, depositNote, refresh } = useWalletBalances();
  const [connectError, setConnectError] = useState<string | null>(null);
  const wcReady = Boolean(walletConnectProjectId());
  const [live, setLive] = useState<LiveStatus | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    void getLiveStatus()
      .then((s) => {
        if (!cancel) setLive(s);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [open]);

  if (!open) return null;

  const phantom = wallets.find((w) => w.adapter.name === "Phantom");
  const walletConnect = wallets.find((w) => w.adapter.name === "WalletConnect");
  const phantomInstalled =
    phantom?.readyState === "Installed" ||
    (typeof window !== "undefined" && Boolean((window as unknown as { solana?: { isPhantom?: boolean } }).solana?.isPhantom));

  const choose = async (name: "Phantom" | "WalletConnect") => {
    setConnectError(null);
    try {
      select(name as never);
      // select() applies on next tick; connect after it settles.
      await new Promise((r) => setTimeout(r, 50));
      await connect();
      setOpen(false);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message.slice(0, 200) : "Connection failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close wallet"
        className="fixed inset-0 cursor-default bg-ink/80 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Connect wallet"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel text-cream shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-brass uppercase">
              {publicKey ? "Wallet connected" : "Connect wallet"}
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {publicKey ? formatAddress(publicKey.toBase58()) : "Link your wallet"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex size-10 items-center justify-center rounded-lg text-faint hover:bg-panel-2 hover:text-cream"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {mismatch && (
            <div className="flex gap-2 rounded-xl border border-loss/40 bg-loss/10 p-3 text-xs text-loss">
              <AlertTriangle className="size-4 shrink-0" />
              <p>
                Different wallet than expected ({expectedAddress ? formatAddress(expectedAddress) : "unknown"}).
                If you did not switch wallets yourself, disconnect immediately.
              </p>
            </div>
          )}

          {live && (
            <div
              className={cn(
                "flex gap-2 rounded-xl border p-3 text-xs",
                live.configured ? "border-gain/40 bg-gain/10 text-gain" : "border-line bg-panel-2 text-faint",
              )}
            >
              <ShieldCheck className="size-4 shrink-0" />
              <div>
                <p className="font-semibold">Live execution · {live.venueLabel}</p>
                <p className="mt-0.5 leading-relaxed">{live.note}</p>
                <p className="mt-1 text-[10px] text-faint">
                  Cap ${live.caps.maxNotionalUsd}/order · daily loss ${live.caps.dailyLossLimitUsd} · max {live.caps.maxOpenPositions} open
                  {live.caps.allowlist.length ? ` · allowlist ${live.caps.allowlist.join(", ")}` : ""}
                </p>
              </div>
            </div>
          )}

          {!publicKey ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="solid"
                disabled={connecting || !phantomInstalled}
                onClick={() => void choose("Phantom")}
                className="h-12 justify-start font-semibold"
              >
                <WalletIcon className="mr-2 size-4" />
                {phantomInstalled ? "Phantom (recommended)" : "Phantom — install the extension first"}
              </Button>
              <Button
                variant="ghost"
                disabled={connecting || !wcReady}
                onClick={() => void choose("WalletConnect")}
                className="h-12 justify-start border border-line"
                title={wcReady ? "Scan with Trust Wallet or 300+ wallets" : "Add VITE_WALLETCONNECT_PROJECT_ID in Vercel first"}
              >
                <WalletIcon className="mr-2 size-4" />
                {wcReady ? "WalletConnect — Trust Wallet & more" : "WalletConnect — project ID not configured"}
              </Button>
              {(connectError || connecting) && (
                <p className="text-xs text-faint" aria-live="polite">
                  {connectError ?? "Waiting for wallet approval…"}
                </p>
              )}
              <p className="text-[11px] leading-relaxed text-faint">
                Connection is read-only: the site learns your address and requests signatures.
                Your seed phrase never leaves your wallet — never enter it anywhere here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] tracking-wider text-faint uppercase">SOL balance</p>
                  <p className="num text-xl font-bold text-cream">
                    {loading ? "…" : sol !== null ? `${sol.toFixed(4)} SOL` : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] tracking-wider text-faint uppercase">USDC balance</p>
                  <p className="num text-xl font-bold text-cream">
                    {loading ? "…" : usdc !== null ? `$${usdc.toFixed(2)}` : "—"}
                  </p>
                </div>
              </Card>
              {depositNote && <p className="text-xs text-gain">{depositNote}</p>}
              {error && <p className="text-xs text-loss">{error}</p>}
              <p className="text-[11px] text-faint">
                RPC: <span className={health === "live" ? "text-gain" : "text-warn"}>{health}</span>
                {" · "}
                <button type="button" onClick={refresh} className="text-brass hover:underline">
                  Refresh balances
                </button>
              </p>
              <NetworkSwitch />
              <Button
                variant="ghost"
                onClick={() => {
                  void disconnect()
                    .catch(() => undefined)
                    .finally(() => setOpen(false));
                }}
                className="border border-line text-xs text-loss hover:bg-loss/10"
              >
                <LogOut className="mr-1.5 size-3.5" /> Disconnect {wallet?.adapter.name ?? "wallet"}
              </Button>
              <p className="text-[11px] leading-relaxed text-faint">
                Execution stays simulated: the desk sizes against detected balances but
                cannot move funds. Live routing requires a connected broker.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
