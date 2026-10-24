import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldTrigger, shouldExpire, DEFAULT_ORDER_TTL_MINUTES } from "./working-orders";

test("buy limit fills at or below its limit", () => {
  assert.equal(shouldTrigger("limit", "buy", 1.5, 1.61), false);
  assert.equal(shouldTrigger("limit", "buy", 1.5, 1.5), true);
  assert.equal(shouldTrigger("limit", "buy", 1.5, 1.2), true);
});

test("buy stop fills at or above its trigger", () => {
  assert.equal(shouldTrigger("stop", "buy", 1.5, 1.49), false);
  assert.equal(shouldTrigger("stop", "buy", 1.5, 1.5), true);
  assert.equal(shouldTrigger("stop", "buy", 1.5, 1.9), true);
});

test("sell limit fills at or above its limit", () => {
  assert.equal(shouldTrigger("limit", "sell", 1.5, 1.4), false);
  assert.equal(shouldTrigger("limit", "sell", 1.5, 1.5), true);
  assert.equal(shouldTrigger("limit", "sell", 1.5, 1.8), true);
});

test("sell stop fills at or below its trigger", () => {
  assert.equal(shouldTrigger("stop", "sell", 1.5, 1.6), false);
  assert.equal(shouldTrigger("stop", "sell", 1.5, 1.5), true);
  assert.equal(shouldTrigger("stop", "sell", 1.5, 1.1), true);
});

test("non-finite price or trigger never fires", () => {
  assert.equal(shouldTrigger("limit", "buy", Number.NaN, 1), false);
  assert.equal(shouldTrigger("limit", "buy", 1, Number.NaN), false);
  assert.equal(shouldTrigger("stop", "sell", Number.POSITIVE_INFINITY, 1), false);
});

test("a delayed resting order expires at the TTL bound and after", () => {
  const now = Date.now();
  const created = now - DEFAULT_ORDER_TTL_MINUTES * 60_000;
  assert.equal(shouldExpire(created - 1, now), true, "older than TTL must expire");
  assert.equal(shouldExpire(created + 60_000, now), false, "younger than TTL must rest");
});

test("an unfilled order exactly at the TTL fires the expiry (>= bound)", () => {
  const now = Date.now();
  assert.equal(shouldExpire(now - DEFAULT_ORDER_TTL_MINUTES * 60_000, now), true);
});

test("non-finite timestamps or non-positive TTL never expire", () => {
  assert.equal(shouldExpire(Number.NaN, Date.now()), false);
  assert.equal(shouldExpire(Date.now(), Number.NaN), false);
  assert.equal(shouldExpire(Date.now() - 60 * 60_000, Date.now(), 0), false);
  assert.equal(shouldExpire(Date.now() - 60 * 60_000, Date.now(), Number.NaN), false);
});
