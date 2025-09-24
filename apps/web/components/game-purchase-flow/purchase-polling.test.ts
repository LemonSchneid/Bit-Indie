import assert from "node:assert/strict";
import test from "node:test";

import { type PurchaseRecord } from "../../lib/api";
import { createPurchasePollingHandlers } from "./purchase-polling";

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

test("handlePurchaseUpdate clears errors and unlocks downloads", () => {
  let recordedPurchase: PurchaseRecord | null = null;
  let recordedState: string | null = null;
  let recordedError: string | null = "previous-error";

  const handlers = createPurchasePollingHandlers({
    onPurchaseUpdate(purchase) {
      recordedPurchase = purchase;
    },
    onFlowStateChange(state) {
      recordedState = state;
    },
    onErrorMessage(message) {
      recordedError = message;
    },
  });

  const purchase = buildPurchase({ download_granted: true, invoice_status: "PAID" });
  handlers.handlePurchaseUpdate(purchase);

  assert.equal(recordedPurchase, purchase);
  assert.equal(recordedState, "paid");
  assert.equal(recordedError, null);
});

test("handleInvoiceExpired updates the flow state and message", () => {
  let recordedState: string | null = null;
  let recordedError: string | null = null;

  const handlers = createPurchasePollingHandlers({
    onPurchaseUpdate() {},
    onFlowStateChange(state) {
      recordedState = state;
    },
    onErrorMessage(message) {
      recordedError = message;
    },
  });

  handlers.handleInvoiceExpired();

  assert.equal(recordedState, "expired");
  assert.match(recordedError ?? "", /Lightning invoice is no longer payable/);
});

test("handlePollingError forwards polling errors", () => {
  let recordedError: string | null = null;

  const handlers = createPurchasePollingHandlers({
    onPurchaseUpdate() {},
    onFlowStateChange() {},
    onErrorMessage(message) {
      recordedError = message;
    },
  });

  handlers.handlePollingError("network down");
  assert.equal(recordedError, "network down");
});
