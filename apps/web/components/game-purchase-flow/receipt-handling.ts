import { type InvoiceCreateResponse } from "../../lib/api";

export type ReceiptDownloadContext = {
  developerLightningAddress: string | null;
  gameTitle: string;
  invoice: InvoiceCreateResponse;
  isGuestCheckout: boolean;
  priceLabel: string;
  receiptLinkToCopy: string;
};

export function buildReceiptDownloadLines(context: ReceiptDownloadContext): string[] {
  const { developerLightningAddress, gameTitle, invoice, isGuestCheckout, priceLabel, receiptLinkToCopy } =
    context;

  const lines = [
    "Bit Indie — Lightning Purchase Receipt",
    "",
    `Game: ${gameTitle}`,
    `Purchase ID: ${invoice.purchase_id}`,
    `Invoice ID: ${invoice.invoice_id}`,
    `Amount: ${priceLabel}`,
  ];

  if (developerLightningAddress) {
    lines.push(`Lightning address: ${developerLightningAddress}`);
  }

  if (receiptLinkToCopy) {
    const label = "Receipt link";
    lines.push(`${label}: ${receiptLinkToCopy}`);
  }

  lines.push("", "Keep this file so you can restore your purchase later.");

  return lines;
}

export function extractReceiptIdFromInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  let receiptId = trimmed;
  try {
    const maybeUrl = new URL(trimmed);
    const segments = maybeUrl.pathname.split("/").filter(Boolean);
    const purchasesIndex = segments.lastIndexOf("purchases");
    if (purchasesIndex >= 0 && purchasesIndex + 1 < segments.length) {
      receiptId = segments[purchasesIndex + 1];
    }
  } catch (_error) {
    const match = trimmed.match(/purchases\/(.+?)(?:\/|$)/);
    if (match?.[1]) {
      receiptId = match[1];
    }
  }

  return receiptId;
}
