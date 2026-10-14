import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { isBase58Wallet, parseWhaleMoves } from "./whales/helius";

export type WhaleWatch = {
  wallet: string;
  chain: string;
  label: string;
  follow: boolean;
  minUsd: number;
};

export type WhaleMoveRow = {
  signature: string;
  wallet: string;
  mint: string;
  symbol: string;
  direction: string;
  amount: number;
  usdEstimate: number;
  acted: boolean;
  observedAt: number;
};

function heliusKey(): string | null {
  const key = process.env.HELIUS_API_KEY?.trim();
  return key || null;
}

async function heliusTxs(wallet: string, limit = 20): Promise<unknown[]> {
  const key = heliusKey();
  if (!key) throw new Error("HELIUS_API_KEY is missing on the host");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${encodeURIComponent(wallet)}/transactions?api-key=${encodeURIComponent(key)}&limit=${limit}`,
      { headers: { Accept: "application/json" }, signal: ctrl.signal },
    );
    if (!res.ok) throw new Error(`Helius HTTP ${res.status}`);
    const body: unknown = await res.json();
    return Array.isArray(body) ? body : [];
  } finally {
    clearTimeout(timer);
  }
}

async function solPriceUsd(): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(
        "https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112",
        { headers: { Accept: "application/json" }, signal: ctrl.signal },
      );
      if (!res.ok) return null;
      const body = (await res.json()) as Record<string, { usdPrice?: unknown }>;
      const px = body.So11111111111111111111111111111111111111112?.usdPrice;
      return typeof px === "number" && Number.isFinite(px) && px > 0 ? px : null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export const addWhaleWatch = createServerFn({ method: "POST" })
  .validator((input: { wallet?: string; label?: string; minUsd?: number }) => ({
    wallet: String(input?.wallet ?? "").trim(),
    label: String(input?.label ?? "").trim().slice(0, 64),
    minUsd: Math.max(1000, Math.min(10_000_000, Math.floor(Number(input?.minUsd) || 25000))),
  }))
  .handler(async ({ data }): Promise<{ watch: WhaleWatch | null; note: string }> => {
    if (!isBase58Wallet(data.wallet)) {
      return { watch: null, note: "Not a valid Solana wallet address" };
    }
    // Verify the wallet exists on-chain before watching it.
    try {
      const key = heliusKey();
      if (!key) return { watch: null, note: "HELIUS_API_KEY is missing on the host" };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [data.wallet] }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Helius RPC HTTP ${res.status}`);
        const body = (await res.json()) as { result?: { value?: unknown } };
        if (!body.result || body.result.value == null) {
          return { watch: null, note: "Wallet has no on-chain account — check the address" };
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verification failed";
      return { watch: null, note: `Could not verify wallet: ${message}` };
    }
    const sql = await getSql();
    await sql.query(
      `INSERT INTO whale_watches (wallet, chain, label, follow, min_usd)
       VALUES ($1, 'solana', $2, TRUE, $3)
       ON CONFLICT (wallet) DO UPDATE SET label = EXCLUDED.label, min_usd = EXCLUDED.min_usd`,
      [data.wallet, data.label, data.minUsd],
    );
    return {
      watch: { wallet: data.wallet, chain: "solana", label: data.label, follow: true, minUsd: data.minUsd },
      note: `Watching ${data.label || data.wallet.slice(0, 8)} — moves over $${data.minUsd.toLocaleString()} will be analyzed`,
    };
  });

export const listWhaleWatches = createServerFn({ method: "GET" }).handler(async (): Promise<{
  watches: WhaleWatch[];
}> => {
  try {
    const sql = await getSql();
    const rows = await sql<{ wallet: string; chain: string; label: string; follow: boolean; min_usd: number | string }>`
      SELECT wallet, chain, label, follow, min_usd FROM whale_watches ORDER BY created_at DESC LIMIT 50
    `;
    return {
      watches: rows.map((r) => ({
        wallet: r.wallet,
        chain: r.chain,
        label: r.label,
        follow: Boolean(r.follow),
        minUsd: Number(r.min_usd),
      })),
    };
  } catch {
    return { watches: [] };
  }
});

export const setWhaleFollow = createServerFn({ method: "POST" })
  .validator((input: { wallet?: string; follow?: boolean }) => ({
    wallet: String(input?.wallet ?? "").trim(),
    follow: Boolean(input?.follow),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const sql = await getSql();
      await sql.query(`UPDATE whale_watches SET follow = $1 WHERE wallet = $2`, [data.follow, data.wallet]);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const removeWhaleWatch = createServerFn({ method: "POST" })
  .validator((input: { wallet?: string }) => ({ wallet: String(input?.wallet ?? "").trim() }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const sql = await getSql();
      await sql.query(`DELETE FROM whale_watches WHERE wallet = $1`, [data.wallet]);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

/** Pull fresh moves for a wallet, persist the significant ones, return what's new. */
export const refreshWhaleMoves = createServerFn({ method: "POST" })
  .validator((input: { wallet?: string }) => ({ wallet: String(input?.wallet ?? "").trim() }))
  .handler(async ({ data }): Promise<{ moves: WhaleMoveRow[]; note: string }> => {
    const empty = (note: string): { moves: WhaleMoveRow[]; note: string } => ({ moves: [], note });
    if (!isBase58Wallet(data.wallet)) return empty("Invalid wallet address");
    const sql = await getSql();
    const watchRows = await sql<{ min_usd: number | string; follow: boolean }>`
      SELECT min_usd, follow FROM whale_watches WHERE wallet = ${data.wallet}
    `;
    const watch = watchRows[0];
    if (!watch) return empty("Wallet is not watched");
    const minUsd = Number(watch.min_usd);
    try {
      const [txs, solPx] = await Promise.all([heliusTxs(data.wallet), solPriceUsd()]);
      const moves = parseWhaleMoves(txs, data.wallet, solPx).filter((m) => m.usdEstimate >= minUsd);
      const fresh: WhaleMoveRow[] = [];
      for (const m of moves.slice(0, 20)) {
        try {
          const rows = await sql<{ signature: string }>`
            INSERT INTO whale_moves (signature, wallet, mint, symbol, direction, amount, usd_estimate, observed_at)
            VALUES (${`${m.signature}:${data.wallet.slice(0, 8)}`}, ${data.wallet}, ${m.mint}, ${m.symbol}, ${m.direction}, ${m.amount}, ${m.usdEstimate}, ${m.observedAt})
            ON CONFLICT (signature) DO NOTHING
            RETURNING signature
          `;
          if (rows.length) {
            fresh.push({
              signature: `${m.signature}:${data.wallet.slice(0, 8)}`,
              wallet: data.wallet,
              mint: m.mint,
              symbol: m.symbol,
              direction: m.direction,
              amount: m.amount,
              usdEstimate: m.usdEstimate,
              acted: false,
              observedAt: m.observedAt,
            });
          }
        } catch {
          // One bad move never sinks the sweep.
        }
      }
      return { moves: fresh, note: fresh.length ? `${fresh.length} new significant move(s)` : "No new significant moves" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Whale refresh failed";
      return empty(message);
    }
  });

export const getWhaleMoves = createServerFn({ method: "POST" })
  .validator((input: { wallet?: string; limit?: number }) => ({
    wallet: String(input?.wallet ?? "").trim(),
    limit: Math.max(1, Math.min(50, Math.floor(Number(input?.limit) || 10))),
  }))
  .handler(async ({ data }): Promise<{ moves: WhaleMoveRow[] }> => {
    try {
      const sql = await getSql();
      const rows = await sql<{
        signature: string; wallet: string; mint: string; symbol: string; direction: string;
        amount: number | string; usd_estimate: number | string; acted: boolean; observed_at: number | string;
      }>`
        SELECT signature, wallet, mint, symbol, direction, amount, usd_estimate, acted, observed_at
        FROM whale_moves
        WHERE wallet = ${data.wallet}
        ORDER BY observed_at DESC
        LIMIT ${data.limit}
      `;
      return {
        moves: rows.map((r) => ({
          signature: r.signature,
          wallet: r.wallet,
          mint: r.mint,
          symbol: r.symbol,
          direction: r.direction,
          amount: Number(r.amount),
          usdEstimate: Number(r.usd_estimate),
          acted: Boolean(r.acted),
          observedAt: Number(r.observed_at),
        })),
      };
    } catch {
      return { moves: [] };
    }
  });

export const markWhaleActed = createServerFn({ method: "POST" })
  .validator((input: { signatures?: string[] }) => ({
    signatures: (Array.isArray(input?.signatures) ? input.signatures : []).map((s) => String(s).slice(0, 128)).slice(0, 20),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const sql = await getSql();
      for (const sig of data.signatures) {
        await sql.query(`UPDATE whale_moves SET acted = TRUE WHERE signature = $1`, [sig]);
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
