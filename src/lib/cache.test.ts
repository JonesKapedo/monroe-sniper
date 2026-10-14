import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCache, fetchCached, isNegativeWorthy } from "./cache.ts";

describe("single-flight ttl cache", () => {
  it("shares one in-flight promise across concurrent callers", async () => {
    const store = createCache<string>();
    let calls = 0;
    const loader = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return "v";
    };
    const [a, b] = await Promise.all([
      fetchCached(store, "k", 1000, loader),
      fetchCached(store, "k", 1000, loader),
    ]);
    assert.equal(a, "v");
    assert.equal(b, "v");
    assert.equal(calls, 1);
    // Second wave hits the warm cache without calling again.
    assert.equal(await fetchCached(store, "k", 1000, loader), "v");
    assert.equal(calls, 1);
  });

  it("negative-caches rate limits and expires them", async () => {
    const store = createCache<string>();
    let calls = 0;
    const failing = async (): Promise<string> => {
      calls += 1;
      throw new Error("HTTP 429");
    };
    await assert.rejects(fetchCached(store, "k", 1000, failing, 50));
    await assert.rejects(fetchCached(store, "k", 1000, failing, 50));
    assert.equal(calls, 1);
    await new Promise((r) => setTimeout(r, 60));
    await assert.rejects(fetchCached(store, "k", 1000, failing, 50));
    assert.equal(calls, 2);
  });

  it("does not negative-cache programming errors", async () => {
    const store = createCache<string>();
    let calls = 0;
    const bug = async (): Promise<string> => {
      calls += 1;
      throw new Error("cannot read property of undefined");
    };
    await assert.rejects(fetchCached(store, "k", 1000, bug));
    await assert.rejects(fetchCached(store, "k", 1000, bug));
    assert.equal(calls, 2);
  });

  it("evicts oldest entries past capacity", async () => {
    const store = createCache<string>(2);
    await fetchCached(store, "a", 1000, async () => "a");
    await fetchCached(store, "b", 1000, async () => "b");
    await fetchCached(store, "c", 1000, async () => "c");
    assert.equal(store.values.has("a"), false);
    assert.equal(store.values.has("c"), true);
  });

  it("classifies negative-worthy failures", () => {
    assert.equal(isNegativeWorthy("HTTP 429"), true);
    assert.equal(isNegativeWorthy("HTTP 503"), true);
    assert.equal(isNegativeWorthy("Gateway Timeout"), true);
    assert.equal(isNegativeWorthy("Feed unavailable"), true);
    assert.equal(isNegativeWorthy("TypeError: x is not a function"), false);
  });
});
