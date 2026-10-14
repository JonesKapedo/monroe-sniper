import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CATCHUP_TICKS,
  catchUpTicks,
  dueTicks,
  unreplayedMs,
} from "./catchup.ts";

const SCAN = 2; // seconds per simulated minute, the app default
const MIN = SCAN * 1000;

describe("dueTicks", () => {
  it("runs one tick on the first pass with no recorded wall clock", () => {
    assert.equal(dueTicks(1_000_000, 0, SCAN), 1);
  });

  it("runs nothing when no full cadence has elapsed", () => {
    assert.equal(dueTicks(10_000, 9_500, SCAN), 0);
  });

  it("divides the elapsed gap by the cadence", () => {
    assert.equal(dueTicks(100_000, 100_000 - 5 * MIN, SCAN), 5);
  });

  it("caps at 240 ticks (8 sim-minutes at the 2s cadence)", () => {
    assert.equal(dueTicks(10_000_000, 10_000_000 - MAX_CATCHUP_TICKS * MIN, SCAN), MAX_CATCHUP_TICKS);
  });

  it("floors an over-cap gap to the tick cap, never replaying it", () => {
    const tenHoursMs = 10 * 60 * 60 * 1000;
    assert.equal(dueTicks(20_000_000 + tenHoursMs, 20_000_000, SCAN), MAX_CATCHUP_TICKS);
  });

  it("returns zero instead of a negative count on a clock rollback", () => {
    assert.equal(dueTicks(1_000, 1_000 + 5 * MIN, SCAN), 0);
  });

  it("falls back to one tick when a timestamp is not finite", () => {
    assert.equal(dueTicks(Number.NaN, 5_000, SCAN), 1);
    assert.equal(dueTicks(5_000, Number.NaN, SCAN), 1);
  });
});

describe("catchUpTicks", () => {
  it("passes a normal gap straight through", () => {
    assert.equal(catchUpTicks(100_000, 100_000 - 3 * MIN, SCAN), 3);
  });

  it("never answers above the tick cap nor below zero", () => {
    const out = catchUpTicks(50_000_000, 1, SCAN);
    assert.equal(out, MAX_CATCHUP_TICKS);
    assert.equal(catchUpTicks(1, 999_999_999, SCAN), 0);
  });

  it("treats a non-positive cadence as one second rather than dividing by zero", () => {
    assert.equal(dueTicks(150_000, 60_000, 0), 90);
  });

  it("reports discarded sim history instead of pretending it replayed", () => {
    const tenHoursMs = 10 * 60 * 60 * 1000;
    const ran = catchUpTicks(20_000_000 + tenHoursMs, 20_000_000, SCAN);
    assert.equal(ran, MAX_CATCHUP_TICKS);
    assert.ok(unreplayedMs(20_000_000 + tenHoursMs, 20_000_000, SCAN, ran) > tenHoursMs / 2);
    assert.equal(unreplayedMs(100_000, 100_000 - 3 * MIN, SCAN, 3), 0);
  });
});
