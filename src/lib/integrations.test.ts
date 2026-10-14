import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseLunarCoin, parseXSearch } from "./integrations.functions.ts";

describe("integration parsers", () => {
  it("parses X search mentions with public metrics", () => {
    const mentions = parseXSearch({
      data: [
        {
          id: "1",
          text: "$SOL ripping",
          created_at: "2026-10-14T10:00:00Z",
          public_metrics: { like_count: 12, retweet_count: 3, reply_count: 1 },
        },
        { id: "", text: "" },
      ],
    });
    assert.equal(mentions.length, 1);
    assert.equal(mentions[0].likes, 12);
    assert.equal(mentions[0].reposts, 3);
  });

  it("parses LunarCrush coin metrics defensively", () => {
    const social = parseLunarCoin(
      { data: { galaxy_score: 72.5, alt_rank: 3, social_volume_24h: 91000, social_contributors: 1200, sentiment: 68 } },
      "SOL",
    );
    assert.equal(social?.galaxyScore, 72.5);
    assert.equal(social?.socialVolume24h, 91000);
    assert.equal(parseLunarCoin({}, "SOL"), null);
    assert.equal(parseLunarCoin({ data: {} }, "SOL"), null);
  });
});
