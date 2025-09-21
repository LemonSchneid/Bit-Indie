import assert from "node:assert/strict";
import test from "node:test";

import * as lightning from "../lightning";
import { createZapWorkflowController } from "./use-zap-workflow";

test("createZapWorkflowController handles successful zap flow", { concurrency: false }, async (t) => {
  const payParams = {
    callback: "https://example.com/callback",
    minSendable: 1_000,
    maxSendable: 200_000,
    metadata: "[]",
  } satisfies lightning.LnurlPayParams;

  const resolveMock = t.mock.method(lightning, "resolveLightningPayEndpoint", () =>
    "https://example.com/.well-known/lnurlp/alice",
  );
  const fetchMock = t.mock.method(lightning, "fetchLnurlPayParams", async () => payParams);
  const clampMock = t.mock.method(lightning, "clampZapAmount", (amount: number) => amount);
  const requestMock = t.mock.method(lightning, "requestLnurlInvoice", async () => ({ pr: "lnbc1invoice", routes: [] }));
  const weblnAvailableMock = t.mock.method(lightning, "isWeblnAvailable", () => false);
  const payWithWeblnMock = t.mock.method(lightning, "payWithWebln", async () => undefined);
  const openInvoiceMock = t.mock.method(lightning, "openLightningInvoice", () => undefined);

  const controller = createZapWorkflowController({ lightningAddress: "alice@example.com", comment: "Thanks" });

  controller.view.toggleMenu();
  await controller.ensurePayParamsLoaded();
  await controller.view.sendZap(21);

  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(resolveMock.mock.callCount(), 1);
  assert.equal(clampMock.mock.callCount(), 1);
  assert.equal(requestMock.mock.callCount(), 1);
  assert.equal(weblnAvailableMock.mock.callCount(), 1);
  assert.equal(payWithWeblnMock.mock.callCount(), 0);
  assert.equal(openInvoiceMock.mock.callCount(), 1);
  assert.equal(controller.view.showSuccess, true);
  assert.equal(controller.view.lastZapAmount, 21);
  assert.equal(controller.view.amountWasClamped, false);
  assert.equal(controller.view.isMenuOpen, false);
  assert.equal(controller.view.errorMessage, null);

  controller.dispose();
});

test("createZapWorkflowController reports failures from the invoice request", { concurrency: false }, async (t) => {
  const payParams = {
    callback: "https://example.com/callback",
    minSendable: 1_000,
    maxSendable: 200_000,
    metadata: "[]",
  } satisfies lightning.LnurlPayParams;

  t.mock.method(lightning, "resolveLightningPayEndpoint", () => "https://example.com/.well-known/lnurlp/bob");
  t.mock.method(lightning, "fetchLnurlPayParams", async () => payParams);
  t.mock.method(lightning, "clampZapAmount", (amount: number) => amount);
  t.mock.method(lightning, "requestLnurlInvoice", async () => {
    throw new Error("Unable to issue invoice");
  });
  const openInvoiceMock = t.mock.method(lightning, "openLightningInvoice", () => undefined);
  t.mock.method(lightning, "isWeblnAvailable", () => false);

  const controller = createZapWorkflowController({ lnurl: "https://pay.example.com/lnurl" });

  controller.view.toggleMenu();
  await controller.ensurePayParamsLoaded();
  await controller.view.sendZap(50);

  assert.equal(openInvoiceMock.mock.callCount(), 0);
  assert.equal(controller.view.showSuccess, false);
  assert.equal(controller.view.errorMessage, "Unable to issue invoice");
  assert.equal(controller.view.status, "error");

  controller.dispose();
});

test("createZapWorkflowController closes the menu when cancelled", { concurrency: false }, async (t) => {
  const payParams = {
    callback: "https://example.com/callback",
    minSendable: 1_000,
    maxSendable: 200_000,
    metadata: "[]",
  } satisfies lightning.LnurlPayParams;

  t.mock.method(lightning, "resolveLightningPayEndpoint", () => "https://example.com/.well-known/lnurlp/carol");
  t.mock.method(lightning, "fetchLnurlPayParams", async () => payParams);
  t.mock.method(lightning, "clampZapAmount", (amount: number) => amount);

  const controller = createZapWorkflowController({ lightningAddress: "carol@example.com" });

  controller.view.openMenu();
  await controller.ensurePayParamsLoaded();
  assert.equal(controller.view.isMenuOpen, true);

  controller.view.closeMenu();
  assert.equal(controller.view.isMenuOpen, false);
  assert.equal(controller.view.status, "idle");

  controller.dispose();
});
