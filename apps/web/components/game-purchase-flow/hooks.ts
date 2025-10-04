"use client";

import { useCallback, useMemo, useState } from "react";

import {
  type InvoiceCreateRequest,
  type InvoiceCreateResponse,
  type InvoiceStatus,
  type PurchaseRecord,
  createGameInvoice,
  getGameDownloadUrl,
  restorePurchaseDownload,
} from "../../lib/api";
import { useInvoicePolling } from "../../lib/hooks/use-invoice-polling";
import { useStoredUserProfile } from "../../lib/hooks/use-stored-user-profile";
import { getOrCreateAnonId } from "../../lib/anon-id";
import { lookupLatestPurchaseForUser } from "./purchase-lookup";
import { createPurchasePollingHandlers } from "./purchase-polling";
import { useClipboardCopy } from "./use-clipboard-copy";
import { useLightningQrCode } from "./use-qr-code";
import { useReceiptLinks } from "./use-receipt-links";
import { useReceiptDownload } from "./use-receipt-download";
import { useRestoredPurchase } from "./use-restored-purchase";
import { useReceiptLookupForm } from "./use-receipt-lookup";
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
    return "Generate an invoice to pay with your Lightning wallet.";
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
  const user = useStoredUserProfile();
  const isGuestCheckout = !user;
  const isPurchasable = Number.isFinite(priceMsats) && priceMsats > 0;

  const [flowState, setFlowState] = useState<InvoiceFlowState>("idle");
  const [invoice, setInvoice] = useState<InvoiceCreateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloadRequestPending, setIsDownloadRequestPending] = useState(false);
  const {
    showReceiptLookup,
    manualReceiptId,
    setManualReceiptId,
    handleReceiptLookupSubmit,
    toggleReceiptLookup,
    closeReceiptLookup,
  } = useReceiptLookupForm();
  const handleDownloadUnlocked = useCallback(() => {
    setFlowState("paid");
    setErrorMessage(null);
  }, [setErrorMessage, setFlowState]);
  const { purchase, setPurchase } = useRestoredPurchase({
    gameId,
    invoice,
    isPurchasable,
    userId: user?.id ?? null,
    onDownloadUnlocked: handleDownloadUnlocked,
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
    enabled: flowState === "polling" && Boolean(invoice),
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
    if (!buildAvailable || isGuestCheckout) {
      return null;
    }

    try {
      return getGameDownloadUrl(gameId);
    } catch (error) {
      return null;
    }
  }, [buildAvailable, gameId, isGuestCheckout]);

  const finalizeUnlockedPurchase = useCallback(
    (latest: PurchaseRecord) => {
      setPurchase(latest);
      setInvoice(null);
      setFlowState("paid");
      setErrorMessage(null);
    },
    [setErrorMessage, setFlowState, setInvoice, setPurchase],
  );

  const handleInvoiceCreationError = useCallback((error: unknown) => {
    setInvoice(null);
    setFlowState("error");
    if (error instanceof Error) {
      setErrorMessage(error.message);
      return;
    }
    setErrorMessage("Unable to create a Lightning invoice. Please try again.");
  }, [setErrorMessage, setFlowState, setInvoice]);

  const handleGuestDownload = useCallback(async () => {
    if (!buildAvailable) {
      return;
    }

    const receiptId = purchase?.id ?? invoice?.purchase_id ?? null;
    if (!receiptId) {
      setDownloadError("The receipt is still syncing. Try again shortly.");
      return;
    }

    setIsDownloadRequestPending(true);
    setDownloadError(null);

    try {
      const response = await restorePurchaseDownload(receiptId);
      window.location.assign(response.download_url);
    } catch (error) {
      console.error("Failed to restore download from receipt", error);
      if (error instanceof Error) {
        if (error.message === "Purchase is not eligible for download.") {
          setDownloadError("Payment confirmation is still processing. Try again soon.");
          return;
        }
        if (error.message === "Game build is not available for download.") {
          setDownloadError("The developer hasn't uploaded a downloadable build yet.");
          return;
        }
        setDownloadError(error.message);
        return;
      }

      setDownloadError("Unable to open the download link. Please try again.");
    } finally {
      setIsDownloadRequestPending(false);
    }
  }, [
    buildAvailable,
    invoice,
    purchase,
    setDownloadError,
    setIsDownloadRequestPending,
  ]);

  const createAuthenticatedInvoice = useCallback(
    async (userId: string) => {
      const payload: InvoiceCreateRequest = { user_id: userId };
      const created = await createGameInvoice(gameId, payload);
      setInvoice(created);
      setFlowState("polling");
    },
    [gameId],
  );

  const createGuestInvoiceFlow = useCallback(async () => {
    if (!isPurchasable) {
      throw new Error("This game is not currently available for paid checkout.");
    }

    const anonId = getOrCreateAnonId();
    const payload: InvoiceCreateRequest = { anon_id: anonId };
    const created = await createGameInvoice(gameId, payload);
    setInvoice(created);
    setFlowState("polling");
  }, [gameId, isPurchasable]);

  const loadExistingPurchase = useCallback(async () => {
    if (!user) {
      return null;
    }

    return lookupLatestPurchaseForUser({ gameId, userId: user.id });
  }, [gameId, user]);

  const handleCreateInvoice = useCallback(async () => {
    setErrorMessage(null);

    if (user) {
      const existing = await loadExistingPurchase();
      if (existing?.downloadUnlocked) {
        finalizeUnlockedPurchase(existing.purchase);
        return;
      }
    }

    setFlowState("creating");
    setInvoice(null);
    setPurchase(null);

    try {
      if (user) {
        await createAuthenticatedInvoice(user.id);
        return;
      }

      await createGuestInvoiceFlow();
    } catch (error) {
      handleInvoiceCreationError(error);
    }
  }, [
    createAuthenticatedInvoice,
    createGuestInvoiceFlow,
    finalizeUnlockedPurchase,
    handleInvoiceCreationError,
    loadExistingPurchase,
    setPurchase,
    user,
  ]);

  const handleDownloadReceipt = useReceiptDownload({
    developerLightningAddress,
    gameTitle,
    invoice,
    isGuestCheckout,
    priceLabel,
    receiptLinkToCopy,
  });

  const statusMessage = describeInvoiceStatus(invoiceStatus, flowState, downloadUnlocked, isGuestCheckout);

  const prepareCheckout = useCallback(() => {
    setErrorMessage(null);
    setDownloadError(null);
  }, []);

  const handleDownloadBuild = isGuestCheckout ? handleGuestDownload : null;

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
    downloadError,
    isDownloadRequestPending,
    receiptUrl,
    receiptLinkToCopy,
    statusMessage,
    handleCreateInvoice,
    handleCopyInvoice,
    handleCopyReceiptLink,
    handleDownloadReceipt,
    handleDownloadBuild,
    handleReceiptLookupSubmit,
    prepareCheckout,
    toggleReceiptLookup,
    closeReceiptLookup,
    setManualReceiptId,
  };
}
