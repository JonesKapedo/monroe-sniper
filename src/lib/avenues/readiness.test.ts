import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculatePaperReadiness } from "./engine.ts";
import { emptyBook } from "../paper.ts";

function bookWithUnrealized() {
  return emptyBook(500);
}

const win = (n: number, reason = "TARGET") =>
  Array.from({ length: n }, () => ({ pnl: 10, reason }));
const loss = (n: number, reason = "STOP") =>
  Array.from({ length: n }, () => ({ pnl: -10, reason }));

describe("paper readiness (qualifying TP/SL trades, 65% win-rate floor)", () => {
  it("starts low with no history and stays in TRAINING", () => {
    const r = calculatePaperReadiness(bookWithUnrealized(), []);
    assert.equal(r.completedDemoTrades, 0);
    assert.equal(r.targetDemoTrades, 200);
    assert.ok(r.readinessScore <= 25);
    assert.equal(r.status, "TRAINING");
  });

  it("ignores non-qualifying closes (manual, time, reason-less)", () => {
    const history = [
      ...Array.from({ length: 30 }, () => ({ pnl: 10, reason: "MANUAL" })),
      ...Array.from({ length: 30 }, () => ({ pnl: 10, reason: "TIME" })),
      ...Array.from({ length: 30 }, () => ({ pnl: 10 })),
    ];
    const r = calculatePaperReadiness(bookWithUnrealized(), history);
    assert.equal(r.completedDemoTrades, 0);
    assert.ok(r.readinessScore <= 25);
  });

  it("caps the score at 25 below the 65% win-rate floor", () => {
    // 30% win rate over a large sample must never read as disciplined.
    const history = [...win(30), ...loss(70)];
    const r = calculatePaperReadiness(bookWithUnrealized(), history);
    assert.equal(r.completedDemoTrades, 100);
    assert.equal(r.currentWinRatePct, 30);
    assert.ok(r.readinessScore <= 25, `score was ${r.readinessScore}`);
    assert.equal(r.status, "TRAINING");
  });

  it("a better win rate reads higher at the same sample size", () => {
    const mixed = [...win(60), ...loss(40)];
    const hot = [...win(90), ...loss(10)];
    const book = bookWithUnrealized();
    assert.ok(
      calculatePaperReadiness(book, hot).readinessScore >
        calculatePaperReadiness(book, mixed).readinessScore,
    );
  });

  it("counts stop hits as qualifying disciplined exits", () => {
    const history = [...win(70), ...loss(30)];
    const r = calculatePaperReadiness(bookWithUnrealized(), history);
    assert.equal(r.completedDemoTrades, 100);
    assert.equal(r.currentWinRatePct, 70);
    assert.ok(r.readinessScore > 25);
  });

  it("reaches PAPER_PROVEN only with 200 qualifying trades at 65%+", () => {
    const proven = calculatePaperReadiness(bookWithUnrealized(), win(200));
    assert.equal(proven.completedDemoTrades, 200);
    assert.equal(proven.status, "PAPER_PROVEN");
    const short = calculatePaperReadiness(bookWithUnrealized(), win(199));
    assert.notEqual(short.status, "PAPER_PROVEN");
    const weak = calculatePaperReadiness(bookWithUnrealized(), [...win(129), ...loss(71)]);
    assert.notEqual(weak.status, "PAPER_PROVEN");
  });
});
