import { describe, expect, it } from "vitest";
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
    expect(cashBalance(ledger)).toBe(500);
    const open = ledgerOpen({
      ledger,
      instrumentId: "sol:abc",
      symbol: "TEST",
      qty: 10,
      priceUsd: 5,
      engine: "scanner",
    });
    expect(open.ok).toBe(true);
    ledger = open.ledger!;
    expect(cashBalance(ledger)).toBe(450);
    expect(exposureUsd(ledger)).toBe(50);
    expect(equityUsd(ledger)).toBe(500);
    const close = ledgerClose({
      ledger,
      instrumentId: "sol:abc",
      priceUsd: 6,
      engine: "desk",
    });
    expect(close.ok).toBe(true);
    ledger = close.ledger!;
    expect(cashBalance(ledger)).toBe(510);
    expect(ledger.positions.length).toBe(0);
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
    expect(cashBalance(ledger)).toBe(400);
    expect(ledger.positions[0]?.symbol).toBe("AAA");
    expect(exposureUsd(ledger)).toBe(110);
  });
});
