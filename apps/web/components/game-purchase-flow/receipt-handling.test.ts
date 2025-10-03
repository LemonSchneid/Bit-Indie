import assert from "node:assert/strict";
import test from "node:test";

import { type InvoiceCreateResponse } from "../../lib/api";
import { buildReceiptDownloadLines, extractReceiptIdFromInput } from "./receipt-handling";

const baseInvoice: InvoiceCreateResponse = {
  purchase_id: "purchase-123",
  user_id: "guest",
  invoice_id: "invoice-456",
  payment_request: "lnbc1example",
  amount_msats: 2_000,
  invoice_status: "PENDING",
  check_url: "https://pay.example.com/check",
  hosted_checkout_url: null,
};

test("buildReceiptDownloadLines includes purchase details and optional address", () => {
  const lines = buildReceiptDownloadLines({
    developerLightningAddress: "dev@example.com",
    gameTitle: "Space Adventure",
    invoice: baseInvoice,
    isGuestCheckout: true,
    priceLabel: "2,000 msats",
    receiptLinkToCopy: "https://bitindie.example/purchases/purchase-123/receipt",
  });

  assert(lines.includes("Game: Space Adventure"));
  assert(lines.includes("Purchase ID: purchase-123"));
  assert(lines.includes("Lightning address: dev@example.com"));
  assert(lines.some((line) => line.startsWith("Receipt link:")));
  assert(lines.at(-1)?.includes("restore your purchase later"));
});

test("buildReceiptDownloadLines omits optional fields when unavailable", () => {
  const lines = buildReceiptDownloadLines({
    developerLightningAddress: null,
    gameTitle: "Mystery",
    invoice: baseInvoice,
    isGuestCheckout: false,
    priceLabel: "Free",
    receiptLinkToCopy: "",
  });

  assert(!lines.some((line) => line.startsWith("Lightning address")));
  assert(!lines.some((line) => line.startsWith("Receipt link")));
});

test("extractReceiptIdFromInput handles full URLs", () => {
  const id = extractReceiptIdFromInput("https://bitindie.example/purchases/abc123/receipt");
  assert.equal(id, "abc123");
});

test("extractReceiptIdFromInput falls back to plain IDs", () => {
  assert.equal(extractReceiptIdFromInput("xyz789"), "xyz789");
  assert.equal(extractReceiptIdFromInput(""), "");
});
