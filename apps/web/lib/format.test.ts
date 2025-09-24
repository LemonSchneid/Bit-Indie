import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCategory,
  formatDateLabel,
  formatPriceMsats,
  formatStatus,
  formatZapAmount,
} from "./format";

test("formatPriceMsats", async (t) => {
  await t.test("returns a free label when price is null", () => {
    assert.equal(formatPriceMsats(null), "Free download");
  });

  await t.test("supports custom free labels", () => {
    assert.equal(formatPriceMsats(null, { freeLabel: "No cost" }), "No cost");
  });

  await t.test("formats milli-satoshi values", () => {
    assert.equal(formatPriceMsats(1500), "1.5 sats");
    assert.equal(formatPriceMsats(2000), "2 sats");
  });
});

test("formatCategory", async (t) => {
  await t.test("maps known categories", () => {
    assert.equal(formatCategory("PROTOTYPE"), "Prototype");
    assert.equal(formatCategory("EARLY_ACCESS"), "Early Access");
    assert.equal(formatCategory("FINISHED"), "Finished");
  });

  await t.test("title-cases unknown values", () => {
    assert.equal(formatCategory("GAME_JAM_BUILD"), "Game Jam Build");
  });
});

test("formatStatus", async (t) => {
  await t.test("maps known statuses", () => {
    assert.equal(formatStatus("UNLISTED"), "Unlisted preview");
    assert.equal(formatStatus("DISCOVER"), "Discover");
    assert.equal(formatStatus("FEATURED"), "Featured");
  });

  await t.test("falls back to original value", () => {
    assert.equal(formatStatus("ARCHIVED"), "ARCHIVED");
  });
});

test("formatDateLabel", async (t) => {
  await t.test("formats ISO timestamps", () => {
    const label = formatDateLabel("2024-01-15T00:00:00Z", { locale: "en-US" });
    assert.equal(label, "Jan 15, 2024");
  });

  await t.test("returns a fallback when the date is invalid", () => {
    assert.equal(formatDateLabel("not-a-date"), "Recently updated");
    assert.equal(formatDateLabel(null), "Recently updated");
  });

  await t.test("supports custom fallbacks", () => {
    assert.equal(formatDateLabel("", { fallback: "sometime" }), "sometime");
  });
});

test("formatZapAmount", async (t) => {
  await t.test("returns a zero label for non-positive values", () => {
    assert.equal(formatZapAmount(0), "0 sats");
    assert.equal(formatZapAmount(Number.NaN), "0 sats");
  });

  await t.test("supports custom zero labels", () => {
    assert.equal(formatZapAmount(0, { zeroLabel: "no zaps yet" }), "no zaps yet");
  });

  await t.test("formats milli-satoshi totals", () => {
    assert.equal(formatZapAmount(1250), "1.25 sats");
    assert.equal(formatZapAmount(3000), "3 sats");
  });
});
