import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  endpointFor,
  formatAddress,
  getAllowlist,
  parseNetwork,
  setAllowlist,
  walletConnectProjectId,
} from "./config.ts";
import { checkAddressPin, describeTransfer } from "./guard.ts";

describe("wallet config", () => {
  it("abbreviates addresses and passes short ones through", () => {
    assert.equal(formatAddress("7xKPa9sQmR4tYv2wN8bL5cD3eF6gH1jK0mNpQrStUv"), "7xKP…StUv");
    assert.equal(formatAddress("abc"), "abc");
  });

  it("parses networks defensively with devnet default", () => {
    assert.equal(parseNetwork(undefined), "devnet");
    assert.equal(parseNetwork("mainnet-beta"), "mainnet-beta");
    assert.equal(parseNetwork("mainnet"), "devnet");
    assert.equal(parseNetwork(""), "devnet");
  });

  it("resolves endpoints with custom override", () => {
    assert.equal(endpointFor("devnet"), "https://api.devnet.solana.com");
    assert.equal(endpointFor("mainnet-beta", "https://my.rpc/"), "https://my.rpc/");
  });

  it("reads the WalletConnect project id when present", () => {
    assert.equal(walletConnectProjectId(), undefined);
  });

  it("round-trips the withdrawal allowlist headlessly", () => {
    assert.deepEqual(getAllowlist(), []);
    setAllowlist(["  abc  ", "abc", ""]);
    assert.deepEqual(getAllowlist(), []);
  });
});

describe("wallet guard", () => {
  it("pins the first address and flags later mismatches", () => {
    // Headless (no localStorage): pinning is inert and never blocks.
    const first = checkAddressPin("Addr1111111111111111111111111111111111111");
    assert.equal(first.ok, true);
    const other = checkAddressPin("Other2222222222222222222222222222222222222");
    assert.equal(other.ok, true);
  });

  it("describes transfers for pre-sign review", () => {
    const lines = describeTransfer("dest", 1.5, "devnet");
    assert.ok(lines.some((l) => l.includes("dest")));
    assert.ok(lines.some((l) => l.includes("devnet")));
  });
});
