import { buildApiUrl, parseErrorMessage } from "./core";

export type InvoiceStatus = "PENDING" | "PAID" | "EXPIRED" | "REFUNDED";
export type RefundStatus = "NONE" | "REQUESTED" | "APPROVED" | "DENIED" | "PAID";

export interface InvoiceCreateRequest {
  user_id: string;
}

export interface InvoiceCreateResponse {
  purchase_id: string;
  invoice_id: string;
  payment_request: string;
  amount_msats: number;
  invoice_status: InvoiceStatus;
  check_url: string;
}

export interface PurchaseRecord {
  id: string;
  user_id: string;
  game_id: string;
  invoice_id: string;
  invoice_status: InvoiceStatus;
  amount_msats: number | null;
  paid_at: string | null;
  download_granted: boolean;
  refund_requested: boolean;
  refund_status: RefundStatus;
  created_at: string;
  updated_at: string;
}

export interface PurchaseReceiptGame {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  price_msats: number | null;
  build_available: boolean;
}

export interface PurchaseReceiptBuyer {
  id: string;
  pubkey_hex: string;
  display_name: string | null;
}

export interface PurchaseReceipt {
  purchase: PurchaseRecord;
  game: PurchaseReceiptGame;
  buyer: PurchaseReceiptBuyer;
}

export async function createGameInvoice(
  gameId: string,
  payload: InvoiceCreateRequest,
): Promise<InvoiceCreateResponse> {
  const normalizedId = gameId.trim();
  if (!normalizedId) {
    throw new Error("Game ID is required to create an invoice.");
  }

  const response = await fetch(
    buildApiUrl(`/v1/games/${encodeURIComponent(normalizedId)}/invoice`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to create Lightning invoice.");
    throw new Error(message);
  }

  return (await response.json()) as InvoiceCreateResponse;
}

export async function getLatestPurchaseForGame(
  gameId: string,
  userId: string,
): Promise<PurchaseRecord | null> {
  const normalizedGameId = gameId.trim();
  if (!normalizedGameId) {
    throw new Error("Game ID is required to look up purchases.");
  }

  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("User ID is required to look up purchases.");
  }

  const url = new URL(buildApiUrl("/v1/purchases/lookup"));
  url.searchParams.set("game_id", normalizedGameId);
  url.searchParams.set("user_id", normalizedUserId);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load purchase status.");
    throw new Error(message);
  }

  return (await response.json()) as PurchaseRecord;
}

export async function getPurchase(purchaseId: string): Promise<PurchaseRecord> {
  const normalizedId = purchaseId.trim();
  if (!normalizedId) {
    throw new Error("Purchase ID is required.");
  }

  const response = await fetch(
    buildApiUrl(`/v1/purchases/${encodeURIComponent(normalizedId)}`),
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    throw new Error("Purchase not found.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load purchase status.");
    throw new Error(message);
  }

  return (await response.json()) as PurchaseRecord;
}

export async function getPurchaseReceipt(purchaseId: string): Promise<PurchaseReceipt> {
  const normalizedId = purchaseId.trim();
  if (!normalizedId) {
    throw new Error("Purchase ID is required.");
  }

  const response = await fetch(
    buildApiUrl(`/v1/purchases/${encodeURIComponent(normalizedId)}/receipt`),
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    throw new Error("Purchase not found.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load purchase receipt.");
    throw new Error(message);
  }

  return (await response.json()) as PurchaseReceipt;
}

export function getGameDownloadUrl(gameId: string): string {
  const normalizedId = gameId.trim();
  if (!normalizedId) {
    throw new Error("Game ID is required.");
  }

  return buildApiUrl(`/v1/games/${encodeURIComponent(normalizedId)}/download`);
}
