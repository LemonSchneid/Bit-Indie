import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeToLowercaseOrNull,
  parseOptionalInteger,
  trimToNull,
} from "./normalizers";

test("trimToNull trims and nullifies blank strings", () => {
  assert.equal(trimToNull("  hello "), "hello");
  assert.equal(trimToNull("   "), null);
});

test("parseOptionalInteger respects numeric bounds", () => {
  assert.equal(parseOptionalInteger(" 42 ", "Field", { min: 0 }), 42);
  assert.equal(parseOptionalInteger("", "Field", { min: 0 }), null);
  assert.throws(() => parseOptionalInteger("-5", "Field", { min: 0 }));
  assert.throws(() => parseOptionalInteger("100", "Field", { max: 50 }));
});

test("normalizeToLowercaseOrNull lowercases non-empty values", () => {
  assert.equal(normalizeToLowercaseOrNull(" ABC123 "), "abc123");
  assert.equal(normalizeToLowercaseOrNull("   "), null);
});
