import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exitHit, oppositeExit } from "./exit.ts";
import type { Position } from "./types.ts";
import { MODELS, exitProfileForModel } from "./risk-models.ts";
import { buildExitPlan, evaluateExit, initExitRuntime, DEFAULT_EXIT_PROFILE } from "./exits.ts";

const TIME_STOP = 28;

function long(over: Partial<Position> = {}): Position {
  return {
    id: "p1",
    symbol: "SPY",
    side: "LONG",
    qty: 10,
    entry: 100,
    stop: 98,
    target: 104,
    openedAt: 0,
    confidence: 0.6,
    features: [],
    ...over,
  };
}

function short(over: Partial<Position> = {}): Position {
  return { ...long(), side: "SHORT", stop: 102, target: 96, ...over };
}

describe("exitHit", () => {
  it("closes a long on its stop", () => {
    assert.deepEqual(exitHit(long(), 97.5, 1, TIME_STOP), { reason: "STOP", fill: 97.5 });
  });

  it("closes a long on its target", () => {
    assert.deepEqual(exitHit(long(), 104.2, 1, TIME_STOP), { reason: "TARGET", fill: 104.2 });
  });

  it("closes a short on its stop and target inverted", () => {
    assert.equal(exitHit(short(), 102.5, 1, TIME_STOP)?.reason, "STOP");
    assert.equal(exitHit(short(), 95.5, 1, TIME_STOP)?.reason, "TARGET");
  });

  it("holds inside the bracket before the time stop", () => {
    assert.equal(exitHit(long(), 100.5, 5, TIME_STOP), null);
  });

  it("falls back to the time stop at the bound and after it", () => {
    assert.deepEqual(exitHit(long(), 100.5, TIME_STOP, TIME_STOP), { reason: "TIME", fill: 100.5 });
    assert.equal(exitHit(long(), 100.5, TIME_STOP + 40, TIME_STOP)?.reason, "TIME");
  });

  it("prefers the stop over the target when a bar spans both", () => {
    const wide = long({ stop: 100.5, target: 100.5 });
    assert.equal(exitHit(wide, 100.5, 1, TIME_STOP)?.reason, "STOP");
  });
});

describe("per-model exit ladders", () => {
  it("banks earlier the more aggressive the model", () => {
    const degen = exitProfileForModel(MODELS["[degen]"]);
    const elvis = exitProfileForModel(MODELS["[elvis]"]);
    const gradient = exitProfileForModel(MODELS.gradient);
    const paranoid = exitProfileForModel(MODELS["[paranoid]"]);
    assert.ok(degen.scaleOut2AtR! < elvis.scaleOut2AtR!);
    assert.ok(elvis.scaleOut2AtR! < gradient.scaleOut2AtR!);
    assert.ok(gradient.scaleOut2AtR! < paranoid.scaleOut2AtR!);
    assert.ok(degen.scaleOut1AtR! < paranoid.scaleOut1AtR!);
  });

  it("Turbo caps the time stop at the run length; others hold longer", () => {
    assert.equal(exitProfileForModel(MODELS["[degen]"]).timeStopMinutes, MODELS["[degen]"].runMinutes);
    assert.ok((exitProfileForModel(MODELS.gradient).timeStopMinutes ?? 0) > MODELS["[degen]"].runMinutes!);
  });

  it("demo training books reap dead tickets in 15 minutes; live keeps 4h", () => {
    const train = exitProfileForModel(MODELS.gradient, { training: true });
    const live = exitProfileForModel(MODELS.gradient);
    assert.equal(train.timeStopMinutes, 15);
    assert.equal(live.timeStopMinutes, 240);
  });

  it("the training time stop actually closes a dead ticket", () => {
    const now = Date.now();
    const plan = buildExitPlan(100, 98, exitProfileForModel(MODELS.gradient, { training: true }));
    const runtime = initExitRuntime(100, plan, 1, 2, now - 16 * 60_000);
    const decision = evaluateExit("LONG", 100, 100.1, plan, runtime, {
      now,
      lastFreshMarkAt: now,
    });
    assert.equal(decision.action.kind, "CLOSE");
    assert.match((decision.action as { reason: string }).reason, /Time stop: 16min/);
  });

  it("a Turbo ladder scales out sooner than the default ladder at the same R", () => {
    const entry = 100;
    const stop = 98; // risk 2
    const turboPlan = buildExitPlan(entry, stop, exitProfileForModel(MODELS["[degen]"]));
    const now = Date.now();
    // +0.75R (mark 101.5) is past Turbo's breakeven trigger, then +1R (102) scales.
    let rt = initExitRuntime(entry, turboPlan, 10, 1.5, now);
    rt = evaluateExit("LONG", entry, 101.5, turboPlan, rt, { now, lastFreshMarkAt: now }).runtime;
    const d = evaluateExit("LONG", entry, 102, turboPlan, rt, { now, lastFreshMarkAt: now });
    assert.equal(d.action.kind, "SCALE_OUT");
  });
});

describe("default exit ladder", () => {
  function ladder() {
    const entry = 100;
    const stop = 94; // risk 6 → 1R = 6 points
    const plan = buildExitPlan(entry, stop);
    return { entry, plan, now: Date.now() };
  }

  it("arms a breakeven stop at +0.5R so a winner cannot round-trip", () => {
    const { entry, plan, now } = ladder();
    let rt = initExitRuntime(entry, plan, 10, 6, now);
    const arms = evaluateExit("LONG", entry, 100 + 0.5 * 6, plan, rt, { now, lastFreshMarkAt: now });
    assert.equal(arms.action.kind, "MOVE_STOP");
    assert.ok(arms.runtime.stopPrice >= entry, "stop must be at or above entry once breakeven arms");
    rt = arms.runtime;
    // +0.4R sits above the armed +0.25R buffer stop — the runner holds.
    const held = evaluateExit("LONG", entry, 100 + 0.4 * 6, plan, rt, { now, lastFreshMarkAt: now });
    assert.equal(held.action.kind, "HOLD", "pulling back above the armed stop must not exit after breakeven armed");
  });

  it("closes at the armed breakeven stop when the winner round-trips to it — worst case is a tiny win", () => {
    const { entry, plan, now } = ladder();
    let rt = initExitRuntime(entry, plan, 10, 6, now);
    rt = evaluateExit("LONG", entry, 100 + 0.6 * 6, plan, rt, { now, lastFreshMarkAt: now }).runtime;
    // Pull back exactly onto the +0.25R buffer stop (101.5) — the stop closes it above entry.
    const d = evaluateExit("LONG", entry, 100 + 0.25 * 6, plan, rt, { now, lastFreshMarkAt: now });
    assert.equal(d.action.kind, "CLOSE");
    assert.ok(rt.stopPrice > entry, "the armed stop sits above entry — the close books a tiny win");
  });

  it("banks the first third at +1R", () => {
    const { entry, plan, now } = ladder();
    let rt = initExitRuntime(entry, plan, 10, 6, now);
    rt = evaluateExit("LONG", entry, 100 + 0.6 * 6, plan, rt, { now, lastFreshMarkAt: now }).runtime;
    const scale = evaluateExit("LONG", entry, 100 + 1.05 * 6, plan, rt, { now, lastFreshMarkAt: now });
    assert.equal(scale.action.kind, "SCALE_OUT");
    if (scale.action.kind === "SCALE_OUT") assert.ok(scale.action.fractionOfOriginal > 0.3);
  });
});

describe("stale feed handling (delayed quotes)", () => {
  const entry = 100;
  const stop = 98; // risk 2 → 1R = 2 points

  it("default ladder keeps the strict freeze on a stale mark — plain HOLD, stop unmoved", () => {
    const plan = buildExitPlan(entry, stop);
    const openedAt = Date.now() - 30 * 60_000;
    const rt = initExitRuntime(entry, plan, 10, 1.5, openedAt);
    const d = evaluateExit("LONG", entry, 101, plan, rt, {
      now: Date.now(),
      lastFreshMarkAt: openedAt, // 30 min stale > 15 min failsafe
    });
    assert.equal(d.action.kind, "HOLD");
    assert.equal(d.runtime.stopPrice, plan.stopPrice, "stale mark must not move the stop");
  });

  it("banks a known small win when the feed delays (staleBankR opt-in)", () => {
    // Profile as the desk builds it: staleBankR 0.5, staleCutR 0.75.
    const plan = buildExitPlan(entry, stop, exitProfileForModel(MODELS.gradient));
    const now = Date.now();
    // Fresh marks climb to +1R — recorded in the runtime as mfeR — then the quote stalls.
    let rt = initExitRuntime(entry, plan, 10, 1.5, now - 40 * 60_000);
    rt = evaluateExit("LONG", entry, 101.2, plan, rt, {
      now: now - 40 * 60_000,
      lastFreshMarkAt: now - 40 * 60_000,
    }).runtime; // +0.6R
    rt = evaluateExit("LONG", entry, 102, plan, rt, {
      now: now - 39 * 60_000,
      lastFreshMarkAt: now - 39 * 60_000,
    }).runtime; // +1R — mfeR = 1
    // 20 minutes of quote delay later:
    const d = evaluateExit("LONG", entry, 101, plan, rt, {
      now,
      lastFreshMarkAt: now - 39 * 60_000,
    });
    assert.equal(d.action.kind, "CLOSE");
    assert.match((d.action as { reason: string }).reason, /Stale feed — banking/);
  });

  it("cuts a known loss when the feed delays (staleCutR opt-in)", () => {
    const plan = buildExitPlan(entry, stop, exitProfileForModel(MODELS.gradient));
    const now = Date.now();
    // Fresh marks sag to −0.8R (maeR = 0.8) — not enough to hit the −1R initial stop —
    // then the quote stalls.
    let rt = initExitRuntime(entry, plan, 10, 1.5, now - 40 * 60_000);
    rt = evaluateExit("LONG", entry, 98.4, plan, rt, {
      now: now - 40 * 60_000,
      lastFreshMarkAt: now - 40 * 60_000,
    }).runtime; // −0.8R
    const d = evaluateExit("LONG", entry, 99, plan, rt, {
      now,
      lastFreshMarkAt: now - 40 * 60_000, // > 15 min stale
    });
    assert.equal(d.action.kind, "CLOSE");
    assert.match((d.action as { reason: string }).reason, /Stale feed — cutting/);
  });

  it("does not act on a stale mark when neither threshold was reached while fresh", () => {
    const plan = buildExitPlan(entry, stop, exitProfileForModel(MODELS.gradient));
    const now = Date.now();
    // Flat drift, never reached ±0.5R — mfeR/maeR both below the opt-in thresholds.
    let rt = initExitRuntime(entry, plan, 10, 1.5, now - 40 * 60_000);
    rt = evaluateExit("LONG", entry, 100.3, plan, rt, {
      now: now - 40 * 60_000,
      lastFreshMarkAt: now - 40 * 60_000,
    }).runtime; // +0.15R
    const d = evaluateExit("LONG", entry, 100.1, plan, rt, {
      now,
      lastFreshMarkAt: now - 40 * 60_000,
    });
    assert.equal(d.action.kind, "HOLD");
  });

  it("DEFAULT_EXIT_PROFILE keeps the strict freeze (no opt-in thresholds)", () => {
    assert.equal(DEFAULT_EXIT_PROFILE.staleBankR, null);
    assert.equal(DEFAULT_EXIT_PROFILE.staleCutR, null);
  });
});

describe("oppositeExit", () => {
  it("unwinds a long only on a sell", () => {
    assert.equal(oppositeExit("LONG", "SELL"), true);
    assert.equal(oppositeExit("LONG", "BUY"), false);
    assert.equal(oppositeExit("LONG", "FLAT"), false);
  });

  it("unwinds a short only on a buy", () => {
    assert.equal(oppositeExit("SHORT", "BUY"), true);
    assert.equal(oppositeExit("SHORT", "SELL"), false);
    assert.equal(oppositeExit("SHORT", "FLAT"), false);
  });
});
