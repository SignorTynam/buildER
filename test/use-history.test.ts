import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_HISTORY_LIMIT,
  areHistoryValuesEqual,
  cloneHistoryValue,
  normalizeHistoryLimit,
  trimFutureEntries,
  trimPastEntries,
} from "../src/hooks/useHistory.ts";

test("trimPastEntries keeps the latest entries", () => {
  assert.deepEqual(trimPastEntries([1, 2, 3, 4], 2), [3, 4]);
});

test("trimFutureEntries keeps the next redo entries", () => {
  assert.deepEqual(trimFutureEntries([1, 2, 3, 4], 2), [1, 2]);
});

test("history trimming returns empty arrays for zero or negative limits", () => {
  assert.deepEqual(trimPastEntries([1, 2, 3], 0), []);
  assert.deepEqual(trimFutureEntries([1, 2, 3], 0), []);
  assert.deepEqual(trimPastEntries([1, 2, 3], -1), []);
  assert.deepEqual(trimFutureEntries([1, 2, 3], -1), []);
});

test("normalizeHistoryLimit floors positive values and clamps invalid values", () => {
  assert.equal(normalizeHistoryLimit(2.8), 2);
  assert.equal(normalizeHistoryLimit(-3), 0);
  assert.equal(normalizeHistoryLimit(Number.POSITIVE_INFINITY), DEFAULT_HISTORY_LIMIT);
});

test("areHistoryValuesEqual returns true for the same reference", () => {
  const value = { a: 1 };

  assert.equal(areHistoryValuesEqual(value, value), true);
});

test("areHistoryValuesEqual keeps JSON equality fallback", () => {
  assert.equal(areHistoryValuesEqual({ a: 1 }, { a: 1 }), true);
});

test("areHistoryValuesEqual uses a custom comparator", () => {
  assert.equal(areHistoryValuesEqual({ a: 1 }, { a: 2 }, () => true), true);
});

test("cloneHistoryValue creates an independent nested copy", () => {
  const original = { nested: { value: 1 } };
  const cloned = cloneHistoryValue(original);

  cloned.nested.value = 2;

  assert.equal(original.nested.value, 1);
  assert.equal(cloned.nested.value, 2);
});

test("useHistory source keeps history bounded", () => {
  const source = readFileSync(new URL("../src/hooks/useHistory.ts", import.meta.url), "utf8");

  assert.equal(source.includes("DEFAULT_HISTORY_LIMIT"), true);
  assert.equal(source.includes("maxEntries"), true);
  assert.equal(source.includes("setPast((currentPast) => [...currentPast, cloneValue(previous)])"), false);
  assert.equal(source.includes("setPast((currentPast) => [...currentPast, clone(present)])"), false);
});
