import assert from "node:assert/strict";
import test from "node:test";

import { describeAssetUpload, describeChecklistState } from "./presenters";

test("describeAssetUpload surfaces optimistic states", () => {
  const uploading = describeAssetUpload("cover", { status: "uploading", message: "Uploading…" });
  assert.equal(uploading.tone, "info");
  assert.equal(uploading.message, "Uploading…");

  const success = describeAssetUpload("build", { status: "success", message: null });
  assert.equal(success.tone, "success");
  assert.match(success.message, /build archive/i);

  const hero = describeAssetUpload("hero", { status: "success", message: null });
  assert.equal(hero.tone, "success");
  assert.match(hero.message, /hero image/i);

  const error = describeAssetUpload("cover", { status: "error", message: "Upload failed" });
  assert.equal(error.tone, "error");
  assert.equal(error.message, "Upload failed");
});

test("describeChecklistState prioritizes readiness and errors", () => {
  const loading = describeChecklistState({ state: "loading", error: null, checklist: null });
  assert.equal(loading.tone, "info");
  assert.match(loading.message, /checking/i);

  const ready = describeChecklistState({
    state: "success",
    error: null,
    checklist: { is_publish_ready: true, missing_requirements: [] },
  });
  assert.equal(ready.tone, "success");
  assert.match(ready.message, /publish requirements are satisfied/i);

  const missing = describeChecklistState({
    state: "success",
    error: null,
    checklist: {
      is_publish_ready: false,
      missing_requirements: [
        { code: "SUMMARY", message: "Add a summary." },
        { code: "BUILD_UPLOAD", message: "Upload a build." },
      ],
    },
  });
  assert.equal(missing.tone, "info");
  assert.match(missing.message, /summary/i);
  assert.match(missing.message, /Upload a build./);

  const errored = describeChecklistState({ state: "error", error: "Unable to load", checklist: null });
  assert.equal(errored.tone, "error");
  assert.equal(errored.message, "Unable to load");
});
