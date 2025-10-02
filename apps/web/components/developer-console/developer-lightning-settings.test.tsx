import assert from "node:assert/strict";
import test from "node:test";

import {
  describeLightningStatus,
  normalizeLightningAddress,
  type LightningStatusDescriptor,
} from "./developer-lightning-settings";

test("normalizeLightningAddress trims whitespace and newlines", () => {
  assert.equal(normalizeLightningAddress(" dev@example.com "), "dev@example.com");
  assert.equal(normalizeLightningAddress("\nlightning@wallet.test\t"), "lightning@wallet.test");
  assert.equal(normalizeLightningAddress(""), "");
});

test("describeLightningStatus prioritizes explicit tones", () => {
  let descriptor: LightningStatusDescriptor;

  descriptor = describeLightningStatus("error", "Unable to save");
  assert.equal(descriptor.tone, "error");
  assert.equal(descriptor.message, "Unable to save");

  descriptor = describeLightningStatus("success", "Saved");
  assert.equal(descriptor.tone, "success");
  assert.equal(descriptor.message, "Saved");

  descriptor = describeLightningStatus("idle", "Provide an address");
  assert.equal(descriptor.tone, "info");
  assert.equal(descriptor.message, "Provide an address");

  descriptor = describeLightningStatus("idle", null);
  assert.equal(descriptor.tone, "info");
  assert.match(descriptor.message, /Lightning payouts settle/i);
});

