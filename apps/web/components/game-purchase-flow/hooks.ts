"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";

import {
  type InvoiceCreateRequest,
  type InvoiceCreateResponse,
  type InvoiceStatus,
  type PurchaseRecord,
  createGameInvoice,
  getGameDownloadUrl,
  getLatestPurchaseForGame,
} from "../../lib/api";
import { useInvoicePolling } from "../../lib/hooks/use-invoice-polling";
import { useStoredUserProfile } from "../../lib/hooks/use-stored-user-profile";
import { createGuestInvoice } from "./guest-invoice";
import { createPurchasePollingHandlers } from "./purchase-polling";
import { buildReceiptDownloadLines, extractReceiptIdFromInput } from "./receipt-handling";
import { useClipboardCopy } from "./use-clipboard-copy";
import { useLightningQrCode } from "./use-qr-code";
import { useReceiptLinks } from "./use-receipt-links";
import { useRestoredPurchase } from "./use-restored-purchase";
export { type CopyState, type InvoiceFlowState } from "./types";

import type { InvoiceFlowState } from "./types";

export function describeInvoiceStatus(
  status: InvoiceStatus | null,
  flowState: InvoiceFlowState,
  downloadUnlocked: boolean,
  isGuestCheckout: boolean,
): string {
  if (downloadUnlocked) {
    return "Payment received! Your download is unlocked.";
  }

  if (flowState === "expired") {
    return "The Lightning invoice expired before payment was detected.";
  }

  if (flowState === "creating") {
    return "Creating your Lightning invoice…";
  }

  if (!status) {
    return isGuestCheckout
      ? "Generate a guest invoice to pay with your Lightning wallet."
      : "Generate an invoice to pay with your Lightning wallet.";
  }

  switch (status) {
    case "PAID":
      return "Payment detected. Finalizing the unlock…";
    case "EXPIRED":
      return "The Lightning invoice expired. Generate a new invoice to try again.";
    case "REFUNDED":
      return "This purchase was refunded. Generate a new invoice to retry.";
    case "PENDING":
    default:
      if (isGuestCheckout) {
        return "Pay the invoice with your Lightning wallet and keep the receipt for your records.";
      }
      return "Waiting for payment confirmation. We refresh the status every few seconds.";
  }
}

export type UseGamePurchaseFlowOptions = {
  gameId: string;
  gameTitle: string;
  priceMsats: number;
  priceLabel: string;
  buildAvailable: boolean;
  developerLightningAddress: string | null;
};

export function useGamePurchaseFlow({
  gameId,
  gameTitle,
  priceMsats,
  priceLabel,
  buildAvailable,
  developerLightningAddress,
}: UseGamePurchaseFlowOptions) {
  const router = useRouter();
  const user = useStoredUserProfile();
  const isGuestCheckout = !user;
  const isPurchasable = Number.isFinite(priceMsats) && priceMsats > 0;

  const [flowState, setFlowState] = useState<InvoiceFlowState>("idle");
  const [invoice, setInvoice] = useState<InvoiceCreateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReceiptLookup, setShowReceiptLookup] = useState(false);
  const [manualReceiptId, setManualReceiptId] = useState("");
  const { purchase, setPurchase } = useRestoredPurchase({
    gameId,
    invoice,
    isPurchasable,
    userId: user?.id ?? null,
    onDownloadUnlocked: () => {
      setFlowState("paid");
      setErrorMessage(null);
    },
  });

  const { handlePurchaseUpdate, handleInvoiceExpired, handlePollingError } = useMemo(
    () =>
      createPurchasePollingHandlers({
        onPurchaseUpdate: (latest: PurchaseRecord) => {
          setPurchase(latest);
        },
        onFlowStateChange: setFlowState,
        onErrorMessage: setErrorMessage,
      }),
    [setFlowState, setErrorMessage, setPurchase],
  );

  useInvoicePolling({
    invoiceId: invoice?.purchase_id ?? null,
    enabled: flowState === "polling" && Boolean(invoice) && !isGuestCheckout,
    pollIntervalMs: 4000,
    onPurchase: handlePurchaseUpdate,
    onExpired: handleInvoiceExpired,
    onError: handlePollingError,
  });

  const { receiptUrl, receiptLinkToCopy } = useReceiptLinks({ invoice, isGuestCheckout });

  const { qrCodeUrl, qrGenerationFailed } = useLightningQrCode(invoice?.payment_request ?? null);

  const { copyState, handleCopy: handleCopyInvoice } = useClipboardCopy({
    text: invoice?.payment_request ?? null,
  });

  const { copyState: receiptCopyState, handleCopy: handleCopyReceiptLink } = useClipboardCopy({
    text: receiptLinkToCopy,
    onError: (error) => {
      console.error("Failed to copy receipt link", error);
    },
  });

  const downloadUnlocked = flowState === "paid" || purchase?.download_granted === true;
  const invoiceStatus: InvoiceStatus | null = purchase?.invoice_status ?? invoice?.invoice_status ?? null;

  const downloadUrl = useMemo(() => {
    if (!buildAvailable) {
      return "#";
    }

    try {
      return getGameDownloadUrl(gameId);
    } catch (error) {
      return "#";
    }
  }, [buildAvailable, gameId]);

  const handleCreateInvoice = useCallback(async () => {
    setErrorMessage(null);

    let existing: PurchaseRecord | null = null;
    if (user) {
      try {
        existing = await getLatestPurchaseForGame(gameId, user.id);
      } catch (_error) {
        // Ignore lookup errors and attempt to generate a fresh invoice below.
      }

      if (existing) {
        if (existing.download_granted || existing.invoice_status === "PAID") {
          setPurchase(existing);
          setInvoice(null);
          setFlowState("paid");
          return;
        }
      }
    }

    setFlowState("creating");
    setInvoice(null);
    setPurchase(null);

    try {
      if (user) {
        const payload: InvoiceCreateRequest = { user_id: user.id };
        const created = await createGameInvoice(gameId, payload);
        setInvoice(created);
        setFlowState("polling");
        return;
      }

      if (!isPurchasable) {
        throw new Error("This game is not currently available for paid checkout.");
      }

      const guestInvoice = await createGuestInvoice({
        developerLightningAddress,
        priceMsats,
        gameTitle,
      });
      setInvoice(guestInvoice);
      setFlowState("polling");
    } catch (error) {
      setInvoice(null);
      setFlowState("error");
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to create a Lightning invoice. Please try again.");
      }
    }
  }, [
    developerLightningAddress,
    gameId,
    gameTitle,
    isPurchasable,
    priceMsats,
    user,
  ]);

  const handleDownloadReceipt = useCallback(() => {
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
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bit-indie-receipt-${invoice.purchase_id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [
    developerLightningAddress,
    gameTitle,
    invoice,
    isGuestCheckout,
    priceLabel,
    receiptLinkToCopy,
  ]);

  const statusMessage = describeInvoiceStatus(invoiceStatus, flowState, downloadUnlocked, isGuestCheckout);

  const handleReceiptLookupSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = manualReceiptId.trim();
      if (!trimmed) {
        return;
      }

      setShowReceiptLookup(false);
      setManualReceiptId("");
      const receiptId = extractReceiptIdFromInput(trimmed);
      router.push(`/purchases/${encodeURIComponent(receiptId)}/receipt`);
    },
    [manualReceiptId, router],
  );

  const prepareCheckout = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const toggleReceiptLookup = useCallback(() => {
    setShowReceiptLookup((current) => {
      const next = !current;
      if (!next) {
        setManualReceiptId("");
      }
      return next;
    });
  }, []);

  const closeReceiptLookup = useCallback(() => {
    setShowReceiptLookup(false);
    setManualReceiptId("");
  }, []);

  return {
    isPurchasable,
    isGuestCheckout,
    flowState,
    invoice,
    purchase,
    errorMessage,
    copyState,
    qrCodeUrl,
    qrGenerationFailed,
    showReceiptLookup,
    manualReceiptId,
    receiptCopyState,
    downloadUnlocked,
    invoiceStatus,
    downloadUrl,
    receiptUrl,
    receiptLinkToCopy,
    statusMessage,
    handleCreateInvoice,
    handleCopyInvoice,
    handleCopyReceiptLink,
    handleDownloadReceipt,
    handleReceiptLookupSubmit,
    prepareCheckout,
    toggleReceiptLookup,
    closeReceiptLookup,
    setManualReceiptId,
  };
}
