import type { Connection, Transaction } from "@solana/web3.js";
import { clearPinnedAddress, getExpectedAddress, pinExpectedAddress } from "./config";

export type PinCheck = { ok: true; expected: string } | { ok: false; reason: "none-pinned" | "mismatch"; expected: string | null };

/**
 * Address-pin check on every connect. First connection pins; later
 * connections must match or the UI raises a session-swap warning.
 * Call with the wallet's public key in base58.
 */
export function checkAddressPin(address: string): PinCheck {
  const expected = getExpectedAddress();
  if (!expected) {
    pinExpectedAddress(address);
    return { ok: true, expected: address };
  }
  if (expected === address.trim()) return { ok: true, expected };
  return { ok: false, reason: "mismatch", expected };
}

export function unpinAddress(): void {
  clearPinnedAddress();
}

/** Human-readable transaction preview lines for the pre-sign review step. */
export function describeTransfer(destination: string, amountSol: number, network: string): string[] {
  return [
    `Destination: ${destination}`,
    `Amount: ${amountSol} SOL`,
    `Network: ${network}`,
    "Action: transfer — review and approve inside your wallet.",
  ];
}

export type SimulationResult = { ok: boolean; error: string | null };

/**
 * Dry-run a transaction against the cluster. Must pass before any signing
 * UI is ever shown. Read-only — moves nothing.
 */
export async function simulateTransaction(
  connection: Connection,
  transaction: Transaction,
): Promise<SimulationResult> {
  try {
    const result = await connection.simulateTransaction(transaction);
    if (result.value.err) {
      const detail = typeof result.value.err === "string" ? result.value.err : JSON.stringify(result.value.err);
      return { ok: false, error: `Simulation failed: ${detail.slice(0, 200)}` };
    }
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "Simulation failed" };
  }
}
