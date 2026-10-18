import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exitHit, oppositeExit } from "./exit.ts";
import type { Position } from "./types.ts";
import { MODELS, exitProfileForModel } from "./risk-models.ts";
import { buildExitPlan, evaluateExit, initExitRuntime } from "./exits.ts";

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
    const gradient = exitProfileForModel(MODELS["gradient"]);
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
