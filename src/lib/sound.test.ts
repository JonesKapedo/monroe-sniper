import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSoundEnabled, playHawkCry, playSoftChirp, setSoundEnabled } from "./sound.ts";

describe("sound guards (no browser)", () => {
  it("defaults enabled without a window and never plays headless", () => {
    assert.equal(isSoundEnabled(), true);
    setSoundEnabled(false); // no-op without a window, must not throw
    assert.equal(playHawkCry(), false);
    assert.equal(playSoftChirp(), false);
  });
});
