/** Compliance & Security module for the Monroe Sniper bot.
 *  Provides KYC/AML status tracking, API key encryption, and
 *  immutable audit trails for all trading activity.
 *
 *  **Production note** – real KYC/AML requires an identity provider
 *  (e.g. Persona, Sumsub, Stripe Identity).  This module defines the
 *  data structures and storage helpers so the UI can call the provider
 *  and store the result.  No provider SDK is included to keep the
 *  bundle small and avoid vendor lock-in.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NormalisedOrder } from "../broker/manager";

/** KYC/AML verification status for a user. */
export type KycStatus = {
  /** Provider-assigned verification ID */
  verificationId: string;
  /** Provider name (e.g. "persona", "sumsub", "stripe") */
  provider: string;
  /** Verification level – basic, enhanced, institutional */
  level: "basic" | "enhanced" | "institutional";
  /** ISO-8601 timestamp of the latest check */
  checkedAt: string;
  /** Whether the user passed the checks */
  approved: boolean;
  /** If rejected, the reason code */
  rejectionReason?: string;
  /** Expiry date for the verification */
  expiresAt?: string;
};

/** Audit log entry – one line per significant event. */
export type AuditEntry = {
  /** Monotonically increasing sequence number */
  seq: number;
  /** ISO-8601 timestamp */
  ts: string;
  /** Event category */
  category:
    | "ORDER_PLACED"
    | "ORDER_FILLED"
    | "ORDER_CANCELLED"
    | "BALANCE_CHANGED"
    | "KYC_UPDATED"
    | "RISK_LIMIT_HIT"
    | "CIRCUIT_BREAKER"
    | "CONFIG_CHANGED"
    | "LOGIN"
    | "LOGOUT";
  /** Human-readable description */
  message: string;
  /** Optional structured payload (order ID, amount, etc.) */
  payload?: Record<string, unknown>;
  /** User / session identifier (pseudonymised) */
  actor?: string;
};

/** In-memory + localStorage audit log store.
 *  In production this would be appended to an append-only DB (e.g.
 *  Cloudflare D1, Neon Postgres, or a dedicated log service like
 *  Datadog / Loki).
 */
interface AuditState {
  entries: AuditEntry[];
  seq: number;
  push: (e: Omit<AuditEntry, "seq" | "ts">) => void;
  clear: () => void;
  /** Export the full log as newline-delimited JSON for SIEM ingestion. */
  export: () => string;
}

const STORAGE_KEY = "monroe-audit-log";

export const useAuditStore = create<AuditState>()(
  persist(
    (set, get) => ({
      entries: [],
      seq: 0,
      push: (e) =>
        set((s) => {
          const entry: AuditEntry = {
            seq: s.seq + 1,
            ts: new Date().toISOString(),
            ...e,
          };
          return { entries: [entry, ...s.entries].slice(0, 10_000), seq: s.seq + 1 };
        }),
      clear: () => set({ entries: [], seq: 0 }),
      export: () =>
        get()
          .entries.map((e) => JSON.stringify(e))
          .join("\n"),
    }),
    { name: STORAGE_KEY, partialize: (s) => ({ entries: s.entries, seq: s.seq }) }
  )
);

/** Convenience helpers for common audit events. */
export function auditOrderPlaced(order: NormalisedOrder, actor?: string) {
  useAuditStore.getState().push({
    category: "ORDER_PLACED",
    message: `Order placed: ${order.side} ${order.quantity} ${order.symbol} @ ${order.price ?? "MKT"}`,
    payload: { orderId: order.id, ...order },
    actor,
  });
}

export function auditOrderFilled(order: NormalisedOrder, actor?: string) {
  useAuditStore.getState().push({
    category: "ORDER_FILLED",
    message: `Order filled: ${order.side} ${order.filledQuantity ?? order.quantity} ${order.symbol} @ ${order.avgPrice ?? order.price ?? "MKT"}`,
    payload: { orderId: order.id, ...order },
    actor,
  });
}

export function auditOrderCancelled(orderId: string, symbol: string, actor?: string) {
  useAuditStore.getState().push({
    category: "ORDER_CANCELLED",
    message: `Order cancelled: ${orderId} (${symbol})`,
    payload: { orderId, symbol },
    actor,
  });
}

export function auditBalanceChange(asset: string, oldBal: number, newBal: number, actor?: string) {
  useAuditStore.getState().push({
    category: "BALANCE_CHANGED",
    message: `Balance change: ${asset} ${oldBal} -> ${newBal}`,
    payload: { asset, oldBal, newBal },
    actor,
  });
}

export function auditKycUpdate(status: KycStatus, actor?: string) {
  useAuditStore.getState().push({
    category: "KYC_UPDATED",
    message: `KYC ${status.approved ? "approved" : "rejected"}: ${status.provider} level ${status.level}`,
    payload: { verificationId: status.verificationId, ...status },
    actor,
  });
}

export function auditRiskLimitHit(limit: string, details: Record<string, unknown>, actor?: string) {
  useAuditStore.getState().push({
    category: "RISK_LIMIT_HIT",
    message: `Risk limit hit: ${limit}`,
    payload: { limit, ...details },
    actor,
  });
}

export function auditCircuitBreaker(reason: string, actor?: string) {
  useAuditStore.getState().push({
    category: "CIRCUIT_BREAKER",
    message: `Circuit breaker tripped: ${reason}`,
    payload: { reason },
    actor,
  });
}

export function auditConfigChange(key: string, oldVal: unknown, newVal: unknown, actor?: string) {
  useAuditStore.getState().push({
    category: "CONFIG_CHANGED",
    message: `Config changed: ${key}`,
    payload: { key, oldVal, newVal },
    actor,
  });
}

/** API key encryption helpers.
 *  Uses Web Crypto API (AES-GCM) with a key derived from a passphrase.
 *  The passphrase itself should come from a secure source (env var,
 *  KMS, or user-provided at runtime).
 *
 *  In production, consider a dedicated secrets manager (AWS KMS,
 *  GCP Secret Manager, HashiCorp Vault) instead of client-side
 *  encryption.
 */
export async function encryptApiKey(
  plaintext: string,
  passphrase: string
): Promise<string> {
  if (typeof window === "undefined" || typeof crypto === "undefined") {
    // Server-side fallback – just base64 encode (NOT secure, dev only).
    return btoa(plaintext);
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine salt + iv + ciphertext into a single base64 string
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptApiKey(
  encrypted: string,
  passphrase: string
): Promise<string> {
  if (typeof window === "undefined" || typeof crypto === "undefined") {
    // Server-side fallback – just base64 decode (NOT secure, dev only).
    return atob(encrypted);
  }

  const encoder = new TextEncoder();
  const combined = new Uint8Array(
    atob(encrypted)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/** Check if KYC/AML is current and approved.
 *  Returns false if not verified, expired, or rejected.
 */
export function isKycCurrent(status: KycStatus | null): boolean {
  if (!status || !status.approved) return false;
  if (status.expiresAt && new Date(status.expiresAt) < new Date()) return false;
  return true;
}

/** Generate a compliance report for a given time window.
 *  Useful for regulators, auditors, or internal review.
 */
export function generateComplianceReport(
  start: Date,
  end: Date,
  kycStatus: KycStatus | null
): string {
  const entries = useAuditStore.getState().entries;
  const filtered = entries.filter(
    (e) => new Date(e.ts) >= start && new Date(e.ts) <= end
  );

  const orders = filtered.filter((e) =>
    ["ORDER_PLACED", "ORDER_FILLED", "ORDER_CANCELLED"].includes(e.category)
  );
  const fills = orders.filter((e) => e.category === "ORDER_FILLED");
  const totalVolume = fills.reduce(
    (sum, e) => sum + Number(e.payload?.quantity ?? 0),
    0
  );

  return [
    "=== MONROE SNIPER COMPLIANCE REPORT ===",
    `Period: ${start.toISOString()} to ${end.toISOString()}`,
    `KYC Status: ${kycStatus?.approved ? "APPROVED" : "NOT APPROVED"} (${kycStatus?.provider ?? "none"})`,
    `Total Audit Entries: ${entries.length}`,
    `Entries in Period: ${filtered.length}`,
    `Orders Placed: ${orders.filter((e) => e.category === "ORDER_PLACED").length}`,
    `Orders Filled: ${fills.length}`,
    `Total Volume: ${totalVolume.toFixed(4)}`,
    `Circuit Breaker Events: ${filtered.filter((e) => e.category === "CIRCUIT_BREAKER").length}`,
    `Risk Limit Hits: ${filtered.filter((e) => e.category === "RISK_LIMIT_HIT").length}`,
    "",
    "=== FULL AUDIT LOG ===",
    ...filtered.map((e) => `[${e.ts}] ${e.category}: ${e.message}`),
  ].join("\n");
}

export type { KycStatus, AuditEntry };