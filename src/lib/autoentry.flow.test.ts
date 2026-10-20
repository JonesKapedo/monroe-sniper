import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chooseEntry, emptyBook, enter, equity, exposure, explainTapeIdle, type Book, type Candidate } from "./paper.ts";
import { defaultRiskSettings, evaluateRiskAndSize } from "./sniper/risk-engine.ts";
import { applyStakeBudget, TIER_CONFIGS } from "./sniper/tier-config.ts";
import { exitProfileForModel, MODELS } from "./sniper/risk-models.ts";
import { resolveConcurrentSlots } from "./sniper/slots.ts";
import { assessEdge } from "./intel/emh.ts";
import { currentRelax, initFlowGovernor, tickGovernor } from "./flow/governor.ts";

const TICK = Date.parse("2026-10-18T12:00:00Z");

function major(symbol: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id: `binance:${symbol.toLowerCase()}`,
    symbol,
    name: symbol,
    chain: "binance",
    address: symbol,
    priceUsd: 2.4,
    liquidityUsd: 0,
    volume24h: 0,
    change24h: 0.8,
    pairAgeHours: null,
    url: null,
    score: 50,
    flags: [],
    rationale: [],
    venue: "binance",
    liquidityUnknown: true,
    ...over,
  };
}

const settings = () => defaultRiskSettings;
const slots = () => resolveConcurrentSlots(defaultRiskSettings.maxPositions);

/** A CoinGecko/CMC reference major: depth unpublished, market cap posed as
 * liquidity. Before the fix these were screened as AMM pools and starved. */
function refMajor(symbol: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id: `coingecko:${symbol.toLowerCase()}`,
    symbol,
    name: `${symbol} · CoinGecko`,
    chain: "coingecko",
    address: symbol,
    priceUsd: 12.5,
    liquidityUsd: 2_000_000_000,
    volume24h: 40_000_000,
    change24h: 0.3,
    pairAgeHours: null,
    url: null,
    score: 80,
    flags: [],
    rationale: [],
    venue: "dex",
    liquidityUnknown: true,
    ...over,
  };
}

/** Exact replica of the desk autoStep tape branch (gates in the same order). */
function tapeAttempt(book: Book, tape: Candidate[], floor: number, relaxStep: number): {
  pick: Candidate | null;
  book: Book;
  ok: boolean;
  note: string;
} {
  const pick = chooseEntry(book, tape, floor, TICK, () => "unknown", relaxStep);
  if (!pick) return { pick, book, ok: false, note: "no pick" };
  const verdict = evaluateRiskAndSize(
    book,
    pick,
    settings(),
    floor,
    TICK,
    { winnerVectors: [], openVectors: [] },
    "gradient",
  );
  if (!verdict.allowed || verdict.notional <= 0) {
    return { pick, book, ok: false, note: verdict.reasons.join("; ") || "verdict" };
  }
  const stake = applyStakeBudget({
    equity: equity(book),
    tier: TIER_CONFIGS["accelerate"],
    currentExposure: exposure(book),
    riskNotional: verdict.notional,
    targetPct: verdict.takeProfitPct,
    openPositionCount: book.positions.length,
    maxConcurrentPositions: slots(),
  });
  if (stake.blocked) return { pick, book, ok: false, note: stake.reason };
  const res = enter(book, pick, TICK, floor, {
    notional: stake.notional,
    stop: verdict.stopPrice,
    target: verdict.targetPrice,
    priceSource: `tape:${pick.id}`,
    maxPositions: slots(),
    exitProfile: exitProfileForModel(MODELS["gradient"]),
  });
  return { pick, book: res.book, ok: res.ok, note: res.note };
}

describe("auto-entry flow proof (desk tape branch replica)", () => {
  it("opens a position on a plain CEX major with baseline gates", () => {
    const tape = [major("WAL"), major("ATOM", { change24h: 0.6 })];
    const res = tapeAttempt(emptyBook(500), tape, 42, 0);
    assert.ok(res.ok, `expected fill, got: ${res.note}`);
    assert.equal(res.book.positions.length, 1, "position opened");
  });

  it("opens a position on a reference (index) major that previously starved", () => {
    const tape = [refMajor("ATOM")];
    const res = tapeAttempt(emptyBook(500), tape, 42, 0);
    assert.ok(res.ok, `expected fill, got: ${res.note}`);
    assert.equal(res.book.positions.length, 1, "position opened");
  });

  it("fills nothing when the tape is all near-misses at relax 0", () => {
    const tape = [major("WAL", { change24h: 0.5, score: 48 })];
    const res = tapeAttempt(emptyBook(500), tape, 42, 0);
    assert.ok(!res.ok, "near-miss must not fill before the ladder relaxes");
    assert.equal(res.pick, null);
  });

  it("the first ladder step admits the same near-miss", () => {
    const tape = [major("WAL", { change24h: 0.5, score: 48 })];
    const edge = assessEdge(tape[0], 1);
    assert.equal(edge.act, true, "relax step 1 should admit a 0.5% mover");
    const res = tapeAttempt(emptyBook(500), tape, 40, 1);
    assert.ok(res.pick, "pick appears once relaxed");
    assert.ok(res.ok, `expected fill under relaxation, got: ${res.note}`);
    assert.equal(res.book.positions.length, 1);
  });

  it("relaxing never bypasses hard risk flags or the $10k book floor", () => {
    const honey = major("HON", { flags: ["HONEYPOT"] });
    for (let step = 0; step <= 3; step++) {
      const edge = assessEdge(honey, step);
      assert.equal(edge.act, false, `HONEYPOT must skip at relax ${step}`);
    }
    const thin = major("THN", { liquidityUsd: 5_000, liquidityUnknown: false, change24h: 3, score: 70 });
    for (let step = 0; step <= 3; step++) {
      const edge = assessEdge(thin, step);
      assert.equal(edge.act, false, `thin book must skip at relax ${step}`);
    }
  });

  it("the ladder caps at 3 steps producing a 6-point floor delta", () => {
    let g = initFlowGovernor();
    for (let i = 0; i < 30 * 3; i++) {
      g = tickGovernor(g, { entriesFilled: 0, guardHalted: false, feedsAlive: 2 }).state;
    }
    assert.equal(g.relaxStep, 3, "ladder saturates at 3");
    assert.equal(currentRelax(g), 6, "cumulative score-floor relief is 6");
    assert.equal(g.alerts.length, 3, "each fired step is alerted once");
  });

  it("idle diagnostics name the top near-miss and its reason", () => {
    const tape = [major("WAL", { change24h: 0.1, score: 30 })];
    const msg = explainTapeIdle(emptyBook(500), tape, 42, 0).summary;
    assert.ok(msg.includes("0 tradeable"), `requires acted count in: ${msg}`);
    assert.ok(msg.includes("WAL"), `requires top symbol in: ${msg}`);
  });

  it("fills multiple distinct slots on one tape pass (concurrency)", () => {
    const tape = [
      major("WAL"),
      major("ATOM", { change24h: 0.6 }),
      major("DOT", { change24h: 0.9 }),
      major("LNK", { change24h: 0.4 }),
    ];
    let book = emptyBook(500);
    const attempted = new Set<string>();
    for (const c of tape) {
      if (attempted.has(c.id) || book.positions.some((p) => p.tokenId === c.id)) continue;
      attempted.add(c.id);
      const res = tapeAttempt(book, [c], 42, 0);
      if (res.ok) book = res.book;
    }
    assert.ok(book.positions.length >= 2, `expected concurrent slots, got ${book.positions.length}`);
    const ids = book.positions.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, "no duplicate positions");
  });

  it("stamps entry conditions on each position so learning has features", () => {    const tape = [major("WAL", { change24h: 1.1 }), major("ATOM", { change24h: 0.7 })];
    let book = emptyBook(500);
    for (const c of tape) {
      const res = tapeAttempt(book, [c], 42, 0);
      if (res.ok) book = res.book;
    }
    assert.ok(book.positions.length >= 1, "at least one entry");
    for (const p of book.positions) {
      assert.equal(typeof p.entryScore, "number", `${p.symbol} entryScore captured`);
      assert.equal(typeof p.entryChange24h, "number", `${p.symbol} entryChange24h captured`);
    }
  });
});
