import assert from "node:assert/strict";
import test from "node:test";

import { type GameDraft } from "../../lib/api";
import {
  buildCreatePayload,
  buildUpdatePayload,
  createInitialValues,
  mapDraftToValues,
} from "./form-utils";

test("createInitialValues returns empty defaults", () => {
  const values = createInitialValues();
  assert.deepEqual(values, {
    title: "",
    slug: "",
    summary: "",
    description_md: "",
    price_msats: "",
    cover_url: "",
    trailer_url: "",
    category: "PROTOTYPE",
    build_object_key: "",
    build_size_bytes: "",
    checksum_sha256: "",
  });
});

test("buildCreatePayload normalizes strings and numeric inputs", () => {
  const payload = buildCreatePayload(
    {
      title: "  My Game  ",
      slug: " sluggy ",
      summary: "  short ",
      description_md: " detailed ",
      price_msats: " 2000 ",
      cover_url: "  https://cover ",
      trailer_url: "  ",
      category: "FINISHED",
      build_object_key: "",
      build_size_bytes: "",
      checksum_sha256: "",
    },
    "user-1",
  );

  assert.deepEqual(payload, {
    user_id: "user-1",
    title: "My Game",
    slug: "sluggy",
    summary: "short",
    description_md: "detailed",
    price_msats: 2000,
    cover_url: "https://cover",
    trailer_url: null,
    category: "FINISHED",
  });
});

test("buildUpdatePayload includes normalized build metadata", () => {
  const payload = buildUpdatePayload(
    {
      title: "My Game",
      slug: "sluggy",
      summary: "",
      description_md: "",
      price_msats: "",
      cover_url: "",
      trailer_url: "",
      category: "PROTOTYPE",
      build_object_key: " games/demo/build.zip ",
      build_size_bytes: " 2048 ",
      checksum_sha256: " ABC ",
    },
    "user-1",
  );

  assert.equal(payload.build_object_key, "games/demo/build.zip");
  assert.equal(payload.build_size_bytes, 2048);
  assert.equal(payload.checksum_sha256, "abc");
});

test("mapDraftToValues flattens draft objects to form values", () => {
  const now = new Date().toISOString();
  const draft: GameDraft = {
    id: "game-1",
    developer_id: "dev-1",
    title: "Solar Drift",
    slug: "solar-drift",
    summary: "A fast-paced racer",
    description_md: "Race around the sun.",
    price_msats: 5000,
    cover_url: "https://cdn.example.com/cover.png",
    trailer_url: null,
    category: "EARLY_ACCESS",
    build_object_key: "games/game-1/build.zip",
    build_size_bytes: 4096,
    checksum_sha256: "abc123",
    developer_lightning_address: "dev@ln.example.com",
    status: "UNLISTED",
    active: false,
    build_scan_status: "PENDING",
    build_scan_message: "Scanning",
    build_scanned_at: now,
    created_at: now,
    updated_at: now,
  };

  const values = mapDraftToValues(draft);
  assert.deepEqual(values, {
    title: "Solar Drift",
    slug: "solar-drift",
    summary: "A fast-paced racer",
    description_md: "Race around the sun.",
    price_msats: "5000",
    cover_url: "https://cdn.example.com/cover.png",
    trailer_url: "",
    category: "EARLY_ACCESS",
    build_object_key: "games/game-1/build.zip",
    build_size_bytes: "4096",
    checksum_sha256: "abc123",
  });
});
