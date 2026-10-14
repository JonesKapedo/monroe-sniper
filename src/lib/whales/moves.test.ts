import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBase58Wallet, parseWhaleMoves } from "./helius.ts";
import { SOL_MINT } from "../solana-swaps.ts";

const WALLET = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

describe("whale moves", () => {
  it("nets wallet-relative flows with SOL USD estimates", () => {
    const moves = parseWhaleMoves(
      [
        {
          signature: "sig1",
          timestamp: 1790000000,
          nativeTransfers: [{ fromUserAccount: "other", toUserAccount: WALLET, amount: 200_000_000 }],
          tokenTransfers: [
            { fromUserAccount: WALLET, toUserAccount: "other", mint: "Mint1111111111111111111111111111111111111", tokenAmount: 50 },
          ],
        },
      ],
      WALLET,
      200,
    );
    const sol = moves.find((m) => m.mint === SOL_MINT);
    assert.equal(sol?.direction, "IN");
    assert.equal(sol?.amount, 0.2);
    assert.equal(sol?.usdEstimate, 40);
    const spl = moves.find((m) => m.direction === "OUT");
    assert.equal(spl?.usdEstimate, 0);
  });

  it("ignores unrelated transfers and validates wallets", () => {
    assert.deepEqual(parseWhaleMoves([{ signature: "x", nativeTransfers: [] }], WALLET, 100), []);
    assert.equal(isBase58Wallet(WALLET), true);
    assert.equal(isBase58Wallet("0xabc"), false);
    assert.equal(isBase58Wallet(""), false);
  });
});
