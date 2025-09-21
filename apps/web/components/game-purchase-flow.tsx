"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  InvoiceCreateResponse,
  InvoiceStatus,
  PurchaseRecord,
  createGameInvoice,
  getGameDownloadUrl,
  getLatestPurchaseForGame,
} from "../lib/api";
import type { InvoiceCreateRequest } from "../lib/api";
import { getOrCreateAnonId } from "../lib/anon-id";
import { useInvoicePolling } from "../lib/hooks/use-invoice-polling";
import { useStoredUserProfile } from "../lib/hooks/use-stored-user-profile";
import { buildQrCodeUrl } from "../lib/qr-code";
import { Modal } from "./ui/modal";

type FlowState = "idle" | "creating" | "polling" | "paid" | "expired" | "error";
type CopyState = "idle" | "copied" | "error";

type GamePurchaseFlowProps = {
  gameId: string;
  gameTitle: string;
  priceMsats: number;
  priceLabel: string;
  buildAvailable: boolean;
};

const POLL_INTERVAL_MS = 4000;

function describeStatus(
  status: InvoiceStatus | null,
  flowState: FlowState,
  downloadUnlocked: boolean,
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

export function GamePurchaseFlow({
  gameId,
  gameTitle,
  priceMsats,
  priceLabel,
  buildAvailable,
}: GamePurchaseFlowProps): JSX.Element | null {
  const isPurchasable = Number.isFinite(priceMsats) && priceMsats > 0;

  const router = useRouter();
  const user = useStoredUserProfile();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flowState, setFlowState] = useState<FlowState>("idle");
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

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

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
    enabled: flowState === "polling" && Boolean(invoice),
    pollIntervalMs: POLL_INTERVAL_MS,
    onPurchase: handlePurchaseUpdate,
    onExpired: handleInvoiceExpired,
    onError: handlePollingError,
  });

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeout = setTimeout(() => {
      setCopyState("idle");
    }, 3000);

    return () => {
      clearTimeout(timeout);
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

  useEffect(() => {
    setReceiptCopyState("idle");
  }, [receiptLinkToCopy]);

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
    if (!invoice) {
      return null;
    }

    return `/purchases/${invoice.purchase_id}/receipt`;
  }, [invoice]);

  const receiptLinkToCopy = useMemo(() => {
    if (!receiptUrl) {
      return "";
    }
    if (typeof window !== "undefined") {
      try {
        return new URL(receiptUrl, window.location.origin).toString();
      } catch (error) {
        console.error("Failed to build receipt link", error);
      }
    }
    return receiptUrl;
  }, [receiptUrl]);

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
    setFlowState("creating");
    setErrorMessage(null);
    setInvoice(null);
    setPurchase(null);

    try {
      const payload: InvoiceCreateRequest = user ? { user_id: user.id } : { anon_id: getOrCreateAnonId() };
      const created = await createGameInvoice(gameId, payload);
      setInvoice(created);
      setFlowState("polling");
    } catch (error) {
      setFlowState("error");
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to create a Lightning invoice. Please try again.");
      }
    }
  }, [user, gameId]);

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
    if (!receiptLinkToCopy || !invoice) {
      return;
    }

    const lines = [
      "Proof of Play — Lightning Purchase Receipt",
      "",
      `Game: ${gameTitle}`,
      `Purchase ID: ${invoice.purchase_id}`,
      `Invoice ID: ${invoice.invoice_id}`,
      `Amount: ${priceLabel}`,
      `Receipt link: ${receiptLinkToCopy}`,
      "",
      "Keep this file or the receipt link to restore your download later.",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `proof-of-play-receipt-${invoice.purchase_id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [gameTitle, priceLabel, receiptLinkToCopy, invoice]);

  const statusMessage = describeStatus(invoiceStatus, flowState, downloadUnlocked);

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

  if (!isPurchasable) {
    return null;
  }

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
            Purchase &amp; download
          </h2>
          <span className="inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-400/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-emerald-200">
            Lightning
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Pay {priceLabel} with any Lightning wallet to unlock the current build of {gameTitle}.
        </p>

        {downloadUnlocked ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="text-base font-semibold text-emerald-50">Download unlocked</p>
            {buildAvailable ? (
              <a
                href={downloadUrl}
                className="inline-flex w-full items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/30"
              >
                Download build
              </a>
            ) : (
              <p className="text-xs text-emerald-100/80">
                The developer hasn&apos;t uploaded a downloadable build yet. You&apos;ll be notified once it&apos;s ready.
              </p>
            )}
            {receiptLinkToCopy ? (
              <div className="space-y-2 rounded-2xl border border-emerald-400/30 bg-slate-950/40 p-4 text-xs text-slate-200">
                <p className="text-sm text-slate-100">
                  Save this receipt link to restore the download later. You can copy it or download a receipt file.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="flex-1 break-all rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-[0.65rem] text-slate-300">
                    {receiptLinkToCopy}
                  </code>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyReceiptLink}
                      className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:bg-emerald-400/20"
                    >
                      {receiptCopyState === "copied"
                        ? "Receipt copied"
                        : receiptCopyState === "error"
                        ? "Copy unavailable"
                        : "Copy link"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadReceipt}
                      className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-100"
                    >
                      Download receipt
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 space-y-4 text-sm text-slate-300">
            <p>Complete a Lightning payment to unlock the download instantly.</p>
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(true);
                setErrorMessage(null);
              }}
              className="inline-flex w-full items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
            >
              Start Lightning checkout
            </button>
            <button
              type="button"
              onClick={() => setShowReceiptLookup((current) => !current)}
              className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80 hover:text-emerald-100"
            >
              Have a receipt link?
            </button>
            {showReceiptLookup ? (
              <form
                className="flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:items-center"
                onSubmit={handleReceiptLookupSubmit}
              >
                <input
                  type="text"
                  value={manualReceiptId}
                  onChange={(event) => setManualReceiptId(event.target.value)}
                  placeholder="Enter receipt ID or URL"
                  className="w-full flex-1 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:bg-emerald-400/20"
                  >
                    Open receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReceiptLookup(false);
                      setManualReceiptId("");
                    }}
                    className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 hover:border-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        containerClassName="items-center justify-center px-4 py-6"
        contentClassName="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl"
        backdropClassName="bg-slate-950/80"
        backdropAriaLabel="Close checkout"
        ariaLabel="Lightning checkout"
      >
        <button
          type="button"
          onClick={() => setIsModalOpen(false)}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/60 text-slate-300 transition hover:text-white"
          aria-label="Close checkout"
        >
          <span aria-hidden>×</span>
        </button>
        <h3 className="text-lg font-semibold text-white">Lightning checkout</h3>
        <p className="mt-2 text-sm text-slate-300">
          Scan the invoice or paste the BOLT11 string to pay {priceLabel} for {gameTitle}.
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-2xl border border-rose-400/60 bg-rose-500/10 p-3 text-sm text-rose-100">
            {errorMessage}
          </p>
        ) : null}

        {!invoice ? (
          <div className="mt-6 space-y-4 text-sm text-slate-300">
            <p>
              We&apos;ll create a one-time invoice linked to your Proof of Play account.
            </p>
            <button
              type="button"
              onClick={handleCreateInvoice}
              disabled={!user || flowState === "creating"}
              className="inline-flex w-full items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {flowState === "creating" ? "Creating invoice…" : "Generate Lightning invoice"}
            </button>
            {!user ? (
              <p className="text-xs text-amber-200">
                Sign in with your NIP-07 signer on the home page before continuing.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl border border-white/10 bg-white p-4 shadow-xl">
                {qrCodeUrl ? (
                  <Image
                    src={qrCodeUrl}
                    alt="Lightning invoice QR code"
                    width={220}
                    height={220}
                    className="h-auto w-auto"
                    unoptimized
                    priority
                  />
                ) : qrGenerationFailed ? (
                  <p className="text-center text-xs text-slate-500">
                    Unable to generate a QR code. Copy the invoice text below into your wallet.
                  </p>
                ) : (
                  <p className="text-center text-xs text-slate-500">Generating QR code…</p>
                )}
              </div>
            </div>
            <p className="text-center text-sm text-slate-300">
              Pay {priceLabel} with any Lightning wallet.
            </p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                BOLT11 invoice
              </p>
              <textarea
                readOnly
                value={invoice.payment_request}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 p-3 font-mono text-xs leading-relaxed text-slate-100"
                rows={4}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={handleCopyInvoice}
                  className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:bg-emerald-400/20"
                >
                  Copy payment request
                </button>
                {copyState === "copied" ? (
                  <span className="text-emerald-200">Copied to clipboard.</span>
                ) : null}
                {copyState === "error" ? (
                  <span className="text-amber-200">
                    Copying isn&apos;t available. Manually copy the invoice text above.
                  </span>
                ) : null}
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Status
                </p>
                <p className="mt-2 text-sm text-slate-200">{statusMessage}</p>
              </div>
              <p className="text-xs text-slate-400">
                We&apos;ll keep refreshing automatically. You can also open the receipt in a new tab:&nbsp;
                <a
                  href={receiptUrl ?? invoice.check_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 underline hover:text-emerald-200"
                >
                  {receiptUrl ? "View Lightning receipt" : "View purchase status"}
                </a>
              </p>
            </div>
            {flowState === "expired" ? (
              <button
                type="button"
                onClick={handleCreateInvoice}
                className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Generate a new invoice
              </button>
            ) : null}
            {downloadUnlocked ? (
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="font-semibold text-emerald-50">Payment confirmed.</p>
                {buildAvailable ? (
                  <p className="mt-1 text-sm">
                    The download card on the game page is now unlocked. You can close this window once you grab the build.
                  </p>
                ) : (
                  <p className="mt-1 text-sm">
                    We&apos;ll unlock the download automatically once the developer uploads a build for this listing.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}
