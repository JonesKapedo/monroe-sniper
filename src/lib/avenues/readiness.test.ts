import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculatePaperReadiness } from "./engine.ts";
import { emptyBook } from "../paper.ts";

function bookWithUnrealized() {
  return emptyBook(500);
}

describe("paper readiness (proportional, history-backed)", () => {
  it("starts low with no history and stays in TRAINING", () => {
    const r = calculatePaperReadiness(bookWithUnrealized(), []);
    assert.equal(r.completedDemoTrades, 0);
    assert.ok(r.readinessScore < 60);
    assert.equal(r.status, "TRAINING");
  });

  it("rises with every additional win — no plateau", () => {
    const wins = (n: number) => Array.from({ length: n }, () => ({ pnl: 10 }));
    const scores = [1, 2, 3, 5, 10, 20, 29, 30].map(
      (n) => calculatePaperReadiness(bookWithUnrealized(), wins(n)).readinessScore,
    );
    for (let i = 1; i < scores.length; i += 1) {
      assert.ok(
        scores[i] > scores[i - 1],
        `score must grow with each win: ${scores.join(",")}`,
      );
    }
  });

  it("a better win rate reads higher at the same sample size", () => {
    const mixed = [
      ...Array.from({ length: 6 }, () => ({ pnl: 10 })),
      ...Array.from({ length: 4 }, () => ({ pnl: -10 })),
    ];
    const hot = Array.from({ length: 10 }, () => ({ pnl: 10 }));
    const book = bookWithUnrealized();
    assert.ok(
      calculatePaperReadiness(book, hot).readinessScore >
        calculatePaperReadiness(book, mixed).readinessScore,
    );
  });

  it("counts persisted DB history even when the local book is empty", () => {
    const history = [
      ...Array.from({ length: 20 }, () => ({ pnl: 12 })),
      ...Array.from({ length: 5 }, () => ({ pnl: -8 })),
    ];
    const r = calculatePaperReadiness(bookWithUnrealized(), history);
    assert.equal(r.completedDemoTrades, 25);
    assert.equal(r.currentWinRatePct, 80);
    assert.ok(r.readinessScore > 60);
    assert.equal(r.status, "QUALIFYING");
  });

  it("reaches PAPER_PROVEN only with a full quality sample", () => {
    const proven = calculatePaperReadiness(
      bookWithUnrealized(),
      Array.from({ length: 30 }, () => ({ pnl: 10 })),
    );
    assert.equal(proven.status, "PAPER_PROVEN");
    const short = calculatePaperReadiness(
      bookWithUnrealized(),
      Array.from({ length: 29 }, () => ({ pnl: 10 })),
    );
    assert.notEqual(short.status, "PAPER_PROVEN");
  });
});
