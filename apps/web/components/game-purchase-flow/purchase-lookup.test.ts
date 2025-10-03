import assert from "node:assert/strict";
import test from "node:test";

import type { PurchaseRecord } from "../../lib/api";
import {
  lookupLatestPurchaseForUser,
  resetPurchaseLookupCache,
} from "./purchase-lookup";

function buildPurchase(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  const now = new Date().toISOString();
  return {
    id: "purchase-1",
    user_id: "user-1",
    game_id: "game-1",
    invoice_id: "invoice-1",
    invoice_status: "PENDING",
    amount_msats: 1_000,
    paid_at: null,
    download_granted: false,
    refund_requested: false,
    refund_status: "NONE",
    developer_payout_status: "PENDING",
    developer_payout_reference: null,
    developer_payout_error: null,
    platform_payout_status: "PENDING",
    platform_payout_reference: null,
    platform_payout_error: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

test("lookup uses user identifier when provided", async () => {
  resetPurchaseLookupCache();

  const purchase = buildPurchase({ download_granted: true });
  const recordedRequests: unknown[] = [];

  const result = await lookupLatestPurchaseForUser(
    { gameId: "game-xyz", userId: " user-123 " },
    {
      lookupPurchase: async (request) => {
        recordedRequests.push(request);
        return purchase;
      },
      resolveAnonId: () => "anon-should-not-be-used",
      now: () => 0,
      missingTtlMs: 5000,
    },
  );

  assert.ok(result);
  assert.equal(result?.purchase, purchase);
  assert.equal(result?.downloadUnlocked, true);

  const [request] = recordedRequests as Array<{ userId?: string | null; anonId?: string | null }>;
  assert.equal(request.userId, "user-123");
  assert.equal(request.anonId, undefined);
});

test("lookup falls back to anonymous identifier when user is missing", async () => {
  resetPurchaseLookupCache();

  const purchase = buildPurchase({ invoice_status: "PAID" });
  const recordedRequests: unknown[] = [];

  const result = await lookupLatestPurchaseForUser(
    { gameId: "game-xyz", userId: "" },
    {
      lookupPurchase: async (request) => {
        recordedRequests.push(request);
        return purchase;
      },
      resolveAnonId: () => "anon-123",
      now: () => 100,
      missingTtlMs: 5000,
    },
  );

  assert.ok(result);
  assert.equal(result?.downloadUnlocked, true);

  const [request] = recordedRequests as Array<{ userId?: string | null; anonId?: string | null }>;
  assert.equal(request.userId, undefined);
  assert.equal(request.anonId, "anon-123");
});

test("lookup caches missing responses for a short interval", async () => {
  resetPurchaseLookupCache();

  let callCount = 0;
  let currentTime = 0;

  const dependencies = {
    lookupPurchase: async () => {
      callCount += 1;
      return null;
    },
    resolveAnonId: () => "anon-xyz",
    now: () => currentTime,
    missingTtlMs: 1000,
  } as const;

  // First attempt should hit the lookup function.
  const first = await lookupLatestPurchaseForUser(
    { gameId: "game-xyz", userId: null },
    dependencies,
  );
  assert.equal(first, null);
  assert.equal(callCount, 1);

  // Second attempt within the TTL should be skipped.
  const second = await lookupLatestPurchaseForUser(
    { gameId: "game-xyz", userId: null },
    dependencies,
  );
  assert.equal(second, null);
  assert.equal(callCount, 1);

  // After the TTL passes we should attempt again.
  currentTime = 1500;
  const third = await lookupLatestPurchaseForUser(
    { gameId: "game-xyz", userId: null },
    dependencies,
  );
  assert.equal(third, null);
  assert.equal(callCount, 2);
});
