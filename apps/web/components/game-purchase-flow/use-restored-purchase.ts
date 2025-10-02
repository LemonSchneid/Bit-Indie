import { useEffect, useState } from "react";

import { getLatestPurchaseForGame, type InvoiceCreateResponse, type PurchaseRecord } from "../../lib/api";

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

    let cancelled = false;

    const restorePurchase = async () => {
      try {
        const existing = await getLatestPurchaseForGame(gameId, userId);
        if (cancelled || !existing) {
          return;
        }

        setPurchase(existing);
        if (existing.download_granted) {
          onDownloadUnlocked();
        }
      } catch (_error) {
        if (cancelled) {
          return;
        }
        // Ignore lookup errors and allow the normal purchase flow to proceed.
      }
    };

    void restorePurchase();

    return () => {
      cancelled = true;
    };
  }, [gameId, invoice, isPurchasable, onDownloadUnlocked, purchase, userId]);

  return { purchase, setPurchase } as const;
}
