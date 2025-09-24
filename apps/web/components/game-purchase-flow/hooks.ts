"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  type InvoiceCreateRequest,
  type InvoiceCreateResponse,
  type InvoiceStatus,
  type PurchaseRecord,
  createGameInvoice,
  getGameDownloadUrl,
  getLatestPurchaseForGame,
} from "../../lib/api";
import { getOrCreateAnonId } from "../../lib/anon-id";
import { useInvoicePolling } from "../../lib/hooks/use-invoice-polling";
import { useStoredUserProfile } from "../../lib/hooks/use-stored-user-profile";
import { buildQrCodeUrl } from "../../lib/qr-code";
import {
  fetchLnurlPayParams,
  requestLnurlInvoice,
  resolveLightningPayEndpoint,
} from "../../lib/lightning";

export type InvoiceFlowState = "idle" | "creating" | "polling" | "paid" | "expired" | "error";
export type CopyState = "idle" | "copied" | "error";

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

function generateGuestPurchaseId(anonId: string): string {
  const cryptoObject = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
    return `guest-${anonId}-${cryptoObject.randomUUID()}`;
  }
  const randomSegment = Math.random().toString(16).slice(2, 10);
  return `guest-${anonId}-${Date.now()}-${randomSegment}`;
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
  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrGenerationFailed, setQrGenerationFailed] = useState(false);
  const [showReceiptLookup, setShowReceiptLookup] = useState(false);
  const [manualReceiptId, setManualReceiptId] = useState("");
  const [receiptCopyState, setReceiptCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (!isPurchasable || !user || purchase || invoice) {
      return;
    }

    let cancelled = false;

    const restorePurchase = async () => {
      try {
        const existing = await getLatestPurchaseForGame(gameId, user.id);
        if (cancelled || !existing) {
          return;
        }

        setPurchase(existing);
        if (existing.download_granted) {
          setFlowState("paid");
          setErrorMessage(null);
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
  }, [gameId, invoice, isPurchasable, purchase, user]);

  const handlePurchaseUpdate = useCallback((latest: PurchaseRecord) => {
    setPurchase(latest);
    setErrorMessage(null);

    if (latest.download_granted) {
      setFlowState("paid");
    }
  }, []);

  const handleInvoiceExpired = useCallback(() => {
    setFlowState("expired");
    setErrorMessage(
      "The Lightning invoice is no longer payable. Generate a new invoice to try again.",
    );
  }, []);

  const handlePollingError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  useInvoicePolling({
    invoiceId: invoice?.purchase_id ?? null,
    enabled: flowState === "polling" && Boolean(invoice) && !isGuestCheckout,
    pollIntervalMs: 4000,
    onPurchase: handlePurchaseUpdate,
    onExpired: handleInvoiceExpired,
    onError: handlePollingError,
  });

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyState("idle");
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copyState]);

  useEffect(() => {
    setCopyState("idle");
  }, [invoice?.payment_request]);

  useEffect(() => {
    if (receiptCopyState !== "copied") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setReceiptCopyState("idle");
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [receiptCopyState]);

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

  const receiptUrl = useMemo(() => {
    if (!invoice || isGuestCheckout) {
      return null;
    }

    return `/purchases/${invoice.purchase_id}/receipt`;
  }, [invoice, isGuestCheckout]);

  const receiptLinkToCopy = useMemo(() => {
    if (!invoice) {
      return "";
    }

    if (!isGuestCheckout) {
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
    }

    return invoice.payment_request;
  }, [invoice, isGuestCheckout, receiptUrl]);

  useEffect(() => {
    setReceiptCopyState("idle");
  }, [receiptLinkToCopy]);

  useEffect(() => {
    const paymentRequest = invoice?.payment_request;
    if (!paymentRequest) {
      setQrCodeUrl(null);
      setQrGenerationFailed(false);
      return;
    }

    setQrCodeUrl(null);
    setQrGenerationFailed(false);

    try {
      const url = buildQrCodeUrl(paymentRequest);
      setQrCodeUrl(url);
    } catch (error) {
      console.error("Failed to generate Lightning invoice QR code.", error);
      setQrGenerationFailed(true);
    }
  }, [invoice?.payment_request]);

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

      const anonId = getOrCreateAnonId();
      const normalizedLightningAddress = developerLightningAddress?.trim();
      if (!normalizedLightningAddress) {
        throw new Error(
          "This developer has not configured a Lightning address yet. Please try again later.",
        );
      }

      const endpoint = resolveLightningPayEndpoint({ lightningAddress: normalizedLightningAddress });
      const payParams = await fetchLnurlPayParams(endpoint);
      const amountSats = Math.max(1, Math.ceil(Number(priceMsats) / 1000));
      const invoiceResponse = await requestLnurlInvoice(
        payParams,
        amountSats,
        `Bit Indie — ${gameTitle}`,
      );

      const guestInvoice: InvoiceCreateResponse = {
        purchase_id: generateGuestPurchaseId(anonId),
        user_id: "guest",
        invoice_id: `lnurl-${Date.now()}`,
        payment_request: invoiceResponse.pr,
        amount_msats: amountSats * 1000,
        invoice_status: "PENDING",
        check_url: endpoint,
        hosted_checkout_url: null,
      };

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

  const handleCopyInvoice = useCallback(async () => {
    if (!invoice) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(invoice.payment_request);
      setCopyState("copied");
    } catch (error) {
      setCopyState("error");
    }
  }, [invoice]);

  const handleCopyReceiptLink = useCallback(async () => {
    if (!receiptLinkToCopy) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setReceiptCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(receiptLinkToCopy);
      setReceiptCopyState("copied");
    } catch (error) {
      console.error("Failed to copy receipt link", error);
      setReceiptCopyState("error");
    }
  }, [receiptLinkToCopy]);

  const handleDownloadReceipt = useCallback(() => {
    if (!invoice) {
      return;
    }

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
      const label = isGuestCheckout ? "Payment request" : "Receipt link";
      lines.push(`${label}: ${receiptLinkToCopy}`);
    }

    lines.push("", "Keep this file so you can restore your purchase later.");
    if (isGuestCheckout) {
      lines.push(
        "Guest checkout does not unlock downloads automatically. Share this receipt with the developer if you need support.",
      );
    }

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
      let receiptId = trimmed;
      try {
        const maybeUrl = new URL(trimmed);
        const segments = maybeUrl.pathname.split("/").filter(Boolean);
        const idSegment = segments[segments.length - 2] === "purchases" ? segments[segments.length - 1] : null;
        if (idSegment) {
          receiptId = idSegment;
        }
      } catch (_error) {
        const match = trimmed.match(/purchases\/(.+?)(?:\/|$)/);
        if (match?.[1]) {
          receiptId = match[1];
        }
      }

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
