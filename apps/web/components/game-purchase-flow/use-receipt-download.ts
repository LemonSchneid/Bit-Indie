import { useCallback } from "react";

import { type InvoiceCreateResponse } from "../../lib/api";
import { buildReceiptDownloadLines } from "./receipt-handling";

type UseReceiptDownloadOptions = {
  developerLightningAddress: string | null;
  gameTitle: string;
  invoice: InvoiceCreateResponse | null;
  isGuestCheckout: boolean;
  priceLabel: string;
  receiptLinkToCopy: string;
};

export function useReceiptDownload({
  developerLightningAddress,
  gameTitle,
  invoice,
  isGuestCheckout,
  priceLabel,
  receiptLinkToCopy,
}: UseReceiptDownloadOptions) {
  return useCallback(() => {
    if (!invoice) {
      return;
    }

    const lines = buildReceiptDownloadLines({
      developerLightningAddress,
      gameTitle,
      invoice,
      isGuestCheckout,
      priceLabel,
      receiptLinkToCopy,
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    try {
      triggerDownload(url, `bit-indie-receipt-${invoice.purchase_id}.txt`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [
    developerLightningAddress,
    gameTitle,
    invoice,
    isGuestCheckout,
    priceLabel,
    receiptLinkToCopy,
  ]);
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
