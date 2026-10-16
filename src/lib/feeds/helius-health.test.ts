import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  heliusHealthVerdict,
  HELIUS_LATENCY_BUDGET_MS,
  probeHeliusRpc,
} from "./helius-health.ts";

describe("helius feed health verdict", () => {
  it("reports no-key as a config error, not an outage", () => {
    const h = heliusHealthVerdict(undefined, null, null);
    assert.equal(h.status, "no-key");
    assert.equal(h.ok, false);
  });

  it("treats a live slot under budget as alive", () => {
    const h = heliusHealthVerdict("test-key", 123456, 320);
    assert.equal(h.status, "alive");
    assert.equal(h.ok, true);
    assert.equal(h.slot, 123456);
  });

  it("flags a live but slow RPC as slow (still ok for feed purposes)", () => {
    const h = heliusHealthVerdict("test-key", 123456, HELIUS_LATENCY_BUDGET_MS + 500);
    assert.equal(h.status, "slow");
    assert.equal(h.ok, true);
  });

  it("treats a non-positive slot as down — feed not advancing", () => {
    const h = heliusHealthVerdict("test-key", 0, 120);
    assert.equal(h.status, "down");
    assert.equal(h.ok, false);
  });

  it("probe with missing key returns no-key without any network call", async () => {
    const h = await probeHeliusRpc(undefined);
    assert.equal(h.status, "no-key");
  });
});
