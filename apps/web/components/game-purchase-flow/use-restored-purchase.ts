import { useEffect, useState } from "react";

import { type InvoiceCreateResponse, type PurchaseRecord } from "../../lib/api";
import { lookupLatestPurchaseForUser } from "./purchase-lookup";

type UseRestoredPurchaseOptions = {
  gameId: string;
  invoice: InvoiceCreateResponse | null;
  isPurchasable: boolean;
  userId: string | null;
  onDownloadUnlocked: () => void;
};

export function useRestoredPurchase({
  gameId,
  invoice,
  isPurchasable,
  userId,
  onDownloadUnlocked,
}: UseRestoredPurchaseOptions) {
  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null);

  useEffect(() => {
    if (!isPurchasable || !userId || purchase || invoice) {
      return undefined;
    }

    const controller = new AbortController();

    const restorePurchase = async () => {
      const existing = await lookupLatestPurchaseForUser({
        gameId,
        userId,
        signal: controller.signal,
      });

      if (!existing) {
        return;
      }

      setPurchase(existing.purchase);
      if (existing.downloadUnlocked) {
        onDownloadUnlocked();
      }
    };

    void restorePurchase();

    return () => {
      controller.abort();
    };
  }, [gameId, invoice, isPurchasable, onDownloadUnlocked, purchase, userId]);

  return { purchase, setPurchase } as const;
}
