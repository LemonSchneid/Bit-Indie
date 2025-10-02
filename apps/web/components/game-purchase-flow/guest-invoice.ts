import { type InvoiceCreateResponse } from "../../lib/api";
import { getOrCreateAnonId } from "../../lib/anon-id";
import {
  fetchLnurlPayParams,
  requestLnurlInvoice,
  resolveLightningPayEndpoint,
} from "../../lib/lightning";

export type GuestInvoiceOptions = {
  developerLightningAddress: string | null;
  priceMsats: number;
  gameTitle: string;
};

export type GuestInvoiceDependencies = {
  getOrCreateAnonId: typeof getOrCreateAnonId;
  resolveLightningPayEndpoint: typeof resolveLightningPayEndpoint;
  fetchLnurlPayParams: typeof fetchLnurlPayParams;
  requestLnurlInvoice: typeof requestLnurlInvoice;
  generatePurchaseId: (anonId: string) => string;
  generateInvoiceId: () => string;
};

function generateGuestPurchaseId(anonId: string): string {
  const cryptoObject = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
    return `guest-${anonId}-${cryptoObject.randomUUID()}`;
  }
  const randomSegment = Math.random().toString(16).slice(2, 10);
  return `guest-${anonId}-${Date.now()}-${randomSegment}`;
}

function generateGuestInvoiceId(): string {
  return `lnurl-${Date.now()}`;
}

const defaultDependencies: GuestInvoiceDependencies = {
  getOrCreateAnonId,
  resolveLightningPayEndpoint,
  fetchLnurlPayParams,
  requestLnurlInvoice,
  generatePurchaseId: generateGuestPurchaseId,
  generateInvoiceId: generateGuestInvoiceId,
};

export async function createGuestInvoice(
  options: GuestInvoiceOptions,
  dependencies: Partial<GuestInvoiceDependencies> = {},
): Promise<InvoiceCreateResponse> {
  const { developerLightningAddress, priceMsats, gameTitle } = options;
  const deps: GuestInvoiceDependencies = { ...defaultDependencies, ...dependencies };

  const normalizedLightningAddress = developerLightningAddress?.trim();
  if (!normalizedLightningAddress) {
    throw new Error(
      "This developer has not configured a Lightning address yet. Please try again later.",
    );
  }

  const anonId = deps.getOrCreateAnonId();
  const endpoint = deps.resolveLightningPayEndpoint({ lightningAddress: normalizedLightningAddress });
  const payParams = await deps.fetchLnurlPayParams(endpoint);
  const amountSats = Math.max(1, Math.ceil(Number(priceMsats) / 1000));
  const desiredMsats = amountSats * 1000;

  if (desiredMsats < payParams.minSendable) {
    const minSats = Math.ceil(payParams.minSendable / 1000);
    throw new Error(
      `This developer's LNURL minimum is ${minSats} sats, which is above the game price (${amountSats} sats). Ask the developer to lower their LNURL minimum or raise the game price.`,
    );
  }
  if (payParams.maxSendable && desiredMsats > payParams.maxSendable) {
    const maxSats = Math.floor(payParams.maxSendable / 1000);
    throw new Error(
      `This developer's LNURL maximum is ${maxSats} sats, which is below the game price (${amountSats} sats).`;
    );
  }
  const invoiceResponse = await deps.requestLnurlInvoice(
    payParams,
    amountSats,
    `Bit Indie — ${gameTitle}`,
  );

  return {
    purchase_id: deps.generatePurchaseId(anonId),
    user_id: "guest",
    invoice_id: deps.generateInvoiceId(),
    payment_request: invoiceResponse.pr,
    amount_msats: amountSats * 1000,
    invoice_status: "PENDING",
    check_url: endpoint,
    hosted_checkout_url: null,
  } satisfies InvoiceCreateResponse;
}
