import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SolanaNetwork = "devnet" | "mainnet-beta";

const DEFAULT_RPC: Record<SolanaNetwork, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

function readEnv(key: string): string | undefined {
  try {
    const value =
      typeof import.meta !== "undefined"
        ? (import.meta.env as Record<string, string | undefined>)[key]?.trim()
        : undefined;
    return value || undefined;
  } catch {
    return undefined;
  }
}

/** WalletConnect Cloud project ID (public routing id, Vercel env). */
export function walletConnectProjectId(): string | undefined {
  return readEnv("VITE_WALLETCONNECT_PROJECT_ID");
}

/** Devnet unless explicitly set to mainnet-beta — never anything else. */
export function parseNetwork(value: string | undefined): SolanaNetwork {
  return value === "mainnet-beta" ? "mainnet-beta" : "devnet";
}

export function configuredNetwork(): SolanaNetwork {
  return parseNetwork(readEnv("VITE_SOLANA_NETWORK"));
}

/** Custom RPC override, else the network default. */
export function endpointFor(network: SolanaNetwork, customRpc?: string): string {
  return customRpc?.trim() || DEFAULT_RPC[network];
}

/** 7xKP…9sQ display form; passthrough when too short to abbreviate. */
export function formatAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length < 12) return trimmed;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

const PIN_KEY = "monroe-expected-wallet";
const ALLOWLIST_KEY = "monroe-withdraw-allowlist";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Address pinning: the first connected wallet becomes the expected one.
 * A different address later raises a mismatch warning (possible session swap).
 */
export function getExpectedAddress(): string | null {
  return storage()?.getItem(PIN_KEY) ?? null;
}

export function pinExpectedAddress(address: string): void {
  try {
    storage()?.setItem(PIN_KEY, address.trim());
  } catch {
    // Pinning is best-effort hardening.
  }
}

export function clearPinnedAddress(): void {
  try {
    storage()?.removeItem(PIN_KEY);
  } catch {
    // Ignore.
  }
}

/** Withdrawal allowlist (device-local). Empty means "no address approved yet". */
export function getAllowlist(): string[] {
  try {
    const raw = storage()?.getItem(ALLOWLIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setAllowlist(addresses: string[]): void {
  try {
    storage()?.setItem(ALLOWLIST_KEY, JSON.stringify([...new Set(addresses.map((a) => a.trim()).filter(Boolean))]));
  } catch {
    // Best-effort.
  }
}

type NetworkState = {
  network: SolanaNetwork;
  customRpc: string;
  setNetwork: (network: SolanaNetwork) => void;
  setCustomRpc: (rpc: string) => void;
};

/** Explicit network state — devnet default, mainnet only by deliberate switch. */
export const useSolNetwork = create<NetworkState>()(
  persist(
    (set) => ({
      network: configuredNetwork(),
      customRpc: "",
      setNetwork: (network) => set({ network }),
      setCustomRpc: (customRpc) => set({ customRpc }),
    }),
    { name: "monroe-sol-network-v1" },
  ),
);
