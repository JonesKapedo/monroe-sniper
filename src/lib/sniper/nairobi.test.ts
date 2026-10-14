import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eatDayParts, formatNairobiTime } from "./nairobi-time.ts";

describe("nairobi time", () => {
  it("reads EAT calendar fields independent of host timezone", () => {
    // 2026-10-14 01:30 UTC == 04:30 EAT on the 14th.
    const parts = eatDayParts(Date.UTC(2026, 9, 14, 1, 30, 0));
    assert.deepEqual(parts, { year: 2026, month: 10, day: 14 });
    // 2026-10-13 22:30 UTC == 2026-10-14 01:30 EAT (past EAT midnight).
    const crossed = eatDayParts(Date.UTC(2026, 9, 13, 22, 30, 0));
    assert.deepEqual(crossed, { year: 2026, month: 10, day: 14 });
  });

  it("counts active days across EAT midnights", () => {
    const start = Date.UTC(2026, 9, 13, 20, 0, 0); // 23:00 EAT Oct 13
    const now = Date.UTC(2026, 9, 14, 1, 0, 0); // 04:00 EAT Oct 14
    const info = formatNairobiTime(start, now);
    assert.equal(info.dayNumber, 2);
    assert.equal(info.dateString, "2026-10-14");
  });
});
