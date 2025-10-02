import { getLatestPurchaseForGame, type PurchaseRecord } from "../../lib/api";

type PurchaseLookupOptions = {
  gameId: string;
  userId: string;
  signal?: AbortSignal;
};

type PurchaseLookupResult = {
  purchase: PurchaseRecord;
  downloadUnlocked: boolean;
};

export async function lookupLatestPurchaseForUser({
  gameId,
  userId,
  signal,
}: PurchaseLookupOptions): Promise<PurchaseLookupResult | null> {
  try {
    const latest = await getLatestPurchaseForGame(gameId, userId);
    if (signal?.aborted || !latest) {
      return null;
    }

    const downloadUnlocked = latest.download_granted === true || latest.invoice_status === "PAID";
    return { purchase: latest, downloadUnlocked };
  } catch (_error) {
    if (signal?.aborted) {
      return null;
    }
    return null;
  }
}
