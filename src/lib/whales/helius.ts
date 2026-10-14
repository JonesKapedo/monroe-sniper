import { SOL_MINT, USDC_MINT } from "../solana-swaps";

export type WhaleMove = {
  signature: string;
  mint: string;
  symbol: string;
  direction: "IN" | "OUT";
  amount: number;
  usdEstimate: number;
  observedAt: number;
};

const KNOWN_MINTS: Record<string, string> = {
  [SOL_MINT]: "SOL",
  [USDC_MINT]: "USDC",
};

function shortMint(mint: string): string {
  return mint.length > 12 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : mint;
}

type RawTransfer = {
  from?: unknown;
  to?: unknown;
  fromUserAccount?: unknown;
  toUserAccount?: unknown;
  mint?: unknown;
  amount?: unknown;
  tokenAmount?: unknown;
};

function num(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parse Helius enhanced transactions into wallet-relative moves.
 * Token amounts ride through as-is; SOL/USDC get USD estimates via solPrice.
 */
export function parseWhaleMoves(
  transactions: unknown[],
  wallet: string,
  solPriceUsd: number | null,
): WhaleMove[] {
  const moves: WhaleMove[] = [];
  for (const tx of transactions) {
    if (tx === null || typeof tx !== "object") continue;
    const t = tx as Record<string, unknown>;
    const signature = typeof t.signature === "string" ? t.signature : null;
    if (!signature) continue;
    const observedAt =
      typeof t.timestamp === "number" && Number.isFinite(t.timestamp)
        ? t.timestamp * 1000
        : typeof t.blockTime === "number" && Number.isFinite(t.blockTime)
          ? t.blockTime * 1000
          : Date.now();
    const aggregated = new Map<string, { mint: string; net: number }>();

    const natives = Array.isArray(t.nativeTransfers) ? (t.nativeTransfers as RawTransfer[]) : [];
    for (const xfer of natives) {
      const from = typeof xfer.fromUserAccount === "string" ? xfer.fromUserAccount : xfer.from;
      const to = typeof xfer.toUserAccount === "string" ? xfer.toUserAccount : xfer.to;
      const lamports = num(xfer.amount);
      if (lamports === null) continue;
      const sol = lamports / 1_000_000_000;
      if (to === wallet) {
        const cur = aggregated.get(SOL_MINT) ?? { mint: SOL_MINT, net: 0 };
        cur.net += sol;
        aggregated.set(SOL_MINT, cur);
      } else if (from === wallet) {
        const cur = aggregated.get(SOL_MINT) ?? { mint: SOL_MINT, net: 0 };
        cur.net -= sol;
        aggregated.set(SOL_MINT, cur);
      }
    }

    const tokens = Array.isArray(t.tokenTransfers) ? (t.tokenTransfers as RawTransfer[]) : [];
    for (const xfer of tokens) {
      const from = typeof xfer.fromUserAccount === "string" ? xfer.fromUserAccount : xfer.from;
      const to = typeof xfer.toUserAccount === "string" ? xfer.toUserAccount : xfer.to;
      const mint = typeof xfer.mint === "string" ? xfer.mint : null;
      const amount = num(xfer.tokenAmount) ?? num(xfer.amount);
      if (!mint || amount === null) continue;
      if (to !== wallet && from !== wallet) continue;
      const cur = aggregated.get(mint) ?? { mint, net: 0 };
      cur.net += to === wallet ? amount : -amount;
      aggregated.set(mint, cur);
    }

    for (const { mint, net } of aggregated.values()) {
      if (net === 0) continue;
      const symbol = KNOWN_MINTS[mint] ?? shortMint(mint);
      const usdEstimate =
        mint === SOL_MINT && solPriceUsd !== null
          ? Math.abs(net) * solPriceUsd
          : mint === USDC_MINT
            ? Math.abs(net)
            : 0;
      moves.push({
        signature,
        mint,
        symbol,
        direction: net > 0 ? "IN" : "OUT",
        amount: Math.abs(net),
        usdEstimate: Math.round(usdEstimate * 100) / 100,
        observedAt,
      });
    }
  }
  return moves;
}

export function isBase58Wallet(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}
