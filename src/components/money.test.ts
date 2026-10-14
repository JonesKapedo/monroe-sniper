import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { capitalMood, capitalMoodClass } from "./money.tsx";

describe("capital mood", () => {
  it("is blue when flat, green on wins, red on losses", () => {
    assert.equal(capitalMood(0), "flat");
    assert.equal(capitalMood(NaN), "flat");
    assert.equal(capitalMood(12.5), "win");
    assert.equal(capitalMood(-0.01), "loss");
  });

  it("maps mood to tone classes with blue default", () => {
    assert.equal(capitalMoodClass(0), "text-sky-400");
    assert.equal(capitalMoodClass(5), "text-gain");
    assert.equal(capitalMoodClass(-5), "text-loss");
  });
});
