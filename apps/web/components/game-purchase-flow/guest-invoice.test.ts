import assert from "node:assert/strict";
import test from "node:test";

import { createGuestInvoice } from "./guest-invoice";

test("createGuestInvoice issues a Lightning request with normalized address", async (t) => {
  let capturedEndpoint = "";
  let capturedAmount = 0;

  const invoice = await createGuestInvoice(
    {
      developerLightningAddress: "  alice@example.com  ",
      priceMsats: 1_500,
      gameTitle: "Space Adventure",
    },
    {
      getOrCreateAnonId: () => "anon-123",
      resolveLightningPayEndpoint: ({ lightningAddress }) => {
        capturedEndpoint = `https://pay.example.com/.well-known/${lightningAddress}`;
        return capturedEndpoint;
      },
      fetchLnurlPayParams: async (endpoint) => {
        assert.equal(endpoint, capturedEndpoint);
        return {
          callback: "https://pay.example.com/callback",
          minSendable: 1_000,
          maxSendable: 500_000,
          metadata: "[]",
        };
      },
      requestLnurlInvoice: async (_params, amountSats, comment) => {
        capturedAmount = amountSats;
        assert.equal(comment, "Bit Indie — Space Adventure");
        return { pr: "lnbc1example", routes: [] };
      },
      generatePurchaseId: () => "guest-anon-123",
      generateInvoiceId: () => "lnurl-abc123",
    },
  );

  assert.equal(capturedAmount, 2);
  assert.equal(invoice.purchase_id, "guest-anon-123");
  assert.equal(invoice.invoice_id, "lnurl-abc123");
  assert.equal(invoice.payment_request, "lnbc1example");
  assert.equal(invoice.amount_msats, 2_000);
  assert.equal(invoice.check_url, capturedEndpoint);
  assert.equal(invoice.invoice_status, "PENDING");
});

test("createGuestInvoice rejects when no Lightning address is configured", async () => {
  await assert.rejects(
    () =>
      createGuestInvoice({
        developerLightningAddress: "  ",
        priceMsats: 5_000,
        gameTitle: "Mystery",
      }),
    /This developer has not configured a Lightning address yet/,
  );
});

test("createGuestInvoice enforces a minimum invoice amount of 1 sat", async (t) => {
  let capturedAmount = 0;

  await createGuestInvoice(
    {
      developerLightningAddress: "carol@example.com",
      priceMsats: 500,
      gameTitle: "Tiny Price",
    },
    {
      getOrCreateAnonId: () => "anon-999",
      resolveLightningPayEndpoint: () => "https://pay.example.com/.well-known/carol",
      fetchLnurlPayParams: async () => ({
        callback: "https://pay.example.com/callback",
        minSendable: 1,
        maxSendable: 500_000,
        metadata: "[]",
      }),
      requestLnurlInvoice: async (_params, amountSats) => {
        capturedAmount = amountSats;
        return { pr: "lnbc1tiny", routes: [] };
      },
      generatePurchaseId: () => "guest-anon-999",
      generateInvoiceId: () => "lnurl-xyz",
    },
  );

  assert.equal(capturedAmount, 1);
});
