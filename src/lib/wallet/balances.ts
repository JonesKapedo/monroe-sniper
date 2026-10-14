import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { checkAddressPin } from "@/lib/wallet/guard";

export type ConnectionHealth = "live" | "degraded" | "down" | "idle";

const SEEN_KEY = "monroe-wallet-seen-v1";

type SeenBalances = { address: string; sol: number; usdc: number; at: number };

function readSeen(address: string): SeenBalances | null {
  try {
    const raw = window.localStorage.getItem(`${SEEN_KEY}:${address}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SeenBalances;
    if (parsed.address !== address) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSeen(seen: SeenBalances): void {
  try {
    window.localStorage.setItem(`${SEEN_KEY}:${seen.address}`, JSON.stringify(seen));
  } catch {
    // Best-effort.
  }
}

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type WalletBalances = {
  address: string | null;
  sol: number | null;
  usdc: number | null;
  loading: boolean;
  error: string | null;
  health: ConnectionHealth;
  mismatch: boolean;
  expectedAddress: string | null;
  depositNote: string | null;
  refresh: () => void;
};

/**
 * Live wallet state: address pinning, SOL/USDC balances, RPC health, and
 * deposit detection (balance rose since last seen). Read-only — moves nothing.
 */
export function useWalletBalances(): WalletBalances {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const address = publicKey?.toBase58() ?? null;

  const [sol, setSol] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<ConnectionHealth>("idle");
  const [mismatch, setMismatch] = useState(false);
  const [expectedAddress, setExpectedAddress] = useState<string | null>(null);
  const [depositNote, setDepositNote] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const timer = useRef(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!address) {
      setSol(null);
      setUsdc(null);
      setLoading(false);
      setError(null);
      setHealth("idle");
      setMismatch(false);
      setExpectedAddress(null);
      return;
    }
    const check = checkAddressPin(address);
    setExpectedAddress(check.expected);
    setMismatch(!check.ok);
    let live = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const key = new PublicKey(address);
        const [lamports, tokenAccounts, slot] = await Promise.all([
          connection.getBalance(key),
          connection.getParsedTokenAccountsByOwner(key, { mint: new PublicKey(USDC_MINT) }),
          connection.getSlot(),
        ]);
        if (!live) return;
        const solBalance = lamports / LAMPORTS_PER_SOL;
        let usdcBalance = 0;
        for (const { account } of tokenAccounts.value) {
          const info = (account.data as { parsed?: { info?: { tokenAmount?: { uiAmount?: unknown } } } }).parsed?.info?.tokenAmount?.uiAmount;
          if (typeof info === "number" && Number.isFinite(info)) usdcBalance += info;
        }
        setSol(solBalance);
        setUsdc(usdcBalance);
        setHealth(slot > 0 ? "live" : "degraded");
        const seen = readSeen(address);
        if (seen && (solBalance > seen.sol + 1e-9 || usdcBalance > seen.usdc + 1e-9)) {
          const dSol = solBalance - seen.sol;
          const dUsdc = usdcBalance - seen.usdc;
          const parts: string[] = [];
          if (dSol > 1e-9) parts.push(`+${dSol.toFixed(4)} SOL`);
          if (dUsdc > 1e-9) parts.push(`+$${dUsdc.toFixed(2)} USDC`);
          setDepositNote(`Deposit detected: ${parts.join(" · ")} — trading power unlocked against the new balance.`);
        }
        writeSeen({ address, sol: solBalance, usdc: usdcBalance, at: Date.now() });
      } catch (err) {
        if (!live) return;
        setError(err instanceof Error ? err.message.slice(0, 160) : "Balance fetch failed");
        setHealth("down");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [connection, address, nonce]);

  // RPC heartbeat: refresh balances on a slow cadence while connected.
  useEffect(() => {
    if (!address) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => refresh(), 30_000);
    return () => window.clearTimeout(timer.current);
  }, [address, refresh, sol, usdc]);

  return { address, sol, usdc, loading, error, health, mismatch, expectedAddress, depositNote, refresh };
}
