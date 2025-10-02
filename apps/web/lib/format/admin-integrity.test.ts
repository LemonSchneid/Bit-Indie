import assert from "node:assert/strict";
import test from "node:test";

import {
  formatIntegrityCount,
  formatIntegrityHours,
  formatIntegrityMsats,
  formatIntegrityPercentage,
} from "./admin-integrity";

test("formatIntegrityPercentage clamps inputs", () => {
  assert.equal(formatIntegrityPercentage(0.42), "42.0%");
  assert.equal(formatIntegrityPercentage(-1), "0%");
  assert.equal(formatIntegrityPercentage(5), "100.0%");
});

test("formatIntegrityHours includes a single decimal", () => {
  assert.equal(formatIntegrityHours(12.345), "12.3");
  assert.equal(formatIntegrityHours(Number.NaN), "0");
});

test("formatIntegrityMsats renders msats and sats", () => {
  assert.equal(formatIntegrityMsats(123_000), "123,000 msats (123 sats)");
  assert.equal(formatIntegrityMsats(500), "500 msats (0.50 sats)");
});

test("formatIntegrityCount formats with separators", () => {
  assert.equal(formatIntegrityCount(1234567), "1,234,567");
});
