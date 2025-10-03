import { useMemo } from "react";

import type { InvoiceCreateResponse } from "../../lib/api";

type UseReceiptLinksOptions = {
  invoice: InvoiceCreateResponse | null;
  isGuestCheckout: boolean;
};

export function useReceiptLinks({ invoice, isGuestCheckout }: UseReceiptLinksOptions) {
  const receiptUrl = useMemo(() => {
    if (!invoice) {
      return null;
    }
    return `/purchases/${invoice.purchase_id}/receipt`;
  }, [invoice]);

  const receiptLinkToCopy = useMemo(() => {
    if (!invoice) {
      return "";
    }

    if (receiptUrl) {
      if (typeof window !== "undefined") {
        try {
          return new URL(receiptUrl, window.location.origin).toString();
        } catch (error) {
          console.error("Failed to build receipt link", error);
        }
      }
      return receiptUrl;
    }

    if (invoice.check_url) {
      return invoice.check_url;
    }

    return "";
  }, [invoice, receiptUrl]);

  return { receiptUrl, receiptLinkToCopy } as const;
}
