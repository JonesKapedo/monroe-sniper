import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPaperAccount,
  cashBalance,
  equityUsd,
  exposureUsd,
  ledgerOpen,
  ledgerClose,
  syncLedgerFromBook,
} from "./ledger";

describe("unified trading ledger", () => {
  it("seeds cash and opens/closes without going negative", () => {
    let ledger = createPaperAccount(500);
    assert.equal(cashBalance(ledger), 500);
    const open = ledgerOpen({
      ledger,
      instrumentId: "sol:abc",
      symbol: "TEST",
      qty: 10,
      priceUsd: 5,
      engine: "scanner",
    });
    assert.equal(open.ok, true);
    ledger = open.ledger;
    assert.equal(cashBalance(ledger), 450);
    assert.equal(exposureUsd(ledger), 50);
    assert.equal(equityUsd(ledger), 500);
    const close = ledgerClose({
      ledger,
      instrumentId: "sol:abc",
      priceUsd: 6,
      engine: "desk",
    });
    assert.equal(close.ok, true);
    ledger = close.ledger;
    assert.equal(cashBalance(ledger), 510);
    assert.equal(ledger.positions.length, 0);
  });

  it("syncs from desk book", () => {
    const ledger = syncLedgerFromBook(
      {
        cash: 400,
        positions: [
          { tokenId: "t1", symbol: "AAA", qty: 2, entryPrice: 50, mark: 55, openedAt: 1 },
        ],
      },
      createPaperAccount(500),
    );
    assert.equal(cashBalance(ledger), 400);
    assert.equal(ledger.positions[0]?.symbol, "AAA");
    assert.equal(exposureUsd(ledger), 110);
  });
});
