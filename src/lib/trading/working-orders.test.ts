import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldTrigger } from "./working-orders";

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
