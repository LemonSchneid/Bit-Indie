"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createGameInvoice,
  getLatestPurchaseForGame,
  type InvoiceCreateRequest,
  type InvoiceCreateResponse,
  type InvoiceStatus,
  type PurchaseRecord,
} from "../../lib/api";
import { getOrCreateAnonId } from "../../lib/anon-id";
import { useInvoicePolling } from "../../lib/hooks/use-invoice-polling";
import { useStoredUserProfile } from "../../lib/hooks/use-stored-user-profile";
import { buildQrCodeUrl } from "../../lib/qr-code";
import { describeInvoiceStatus, type InvoiceFlowState } from "../game-purchase-flow";
import { Modal } from "../ui/modal";
import type { GameDetail, InvoiceStep } from "./types";
import { MicroLabel, Pill } from "./ui";
import { cn } from "./utils";

type LightningCheckoutModalProps = {
  onClose: () => void;
  game: GameDetail;
};

type CopyState = "idle" | "copied" | "error";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTimestamp(date: Date | null): string {
  if (!date) {
    return "--";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch (error) {
    console.error("Failed to format timestamp", error);
    return date.toLocaleTimeString();
  }
}

export function LightningCheckoutModal({ onClose, game }: LightningCheckoutModalProps) {
  const user = useStoredUserProfile();
  const isGuestCheckout = !user;

  const [flowState, setFlowState] = useState<InvoiceFlowState>("idle");
  const [invoice, setInvoice] = useState<InvoiceCreateResponse | null>(null);
  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrGenerationFailed, setQrGenerationFailed] = useState(false);
  const [invoiceCreatedAt, setInvoiceCreatedAt] = useState<Date | null>(null);
  const [paymentConfirmedAt, setPaymentConfirmedAt] = useState<Date | null>(null);
  const [downloadUnlockedAt, setDownloadUnlockedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const downloadUnlocked = purchase?.download_granted === true;
  const invoiceStatus: InvoiceStatus | null = purchase?.invoice_status ?? invoice?.invoice_status ?? null;
  const invoiceActive = Boolean(invoice);

  const amountLabel = useMemo(() => {
    const purchaseAmount = purchase?.amount_msats;
    if (typeof purchaseAmount === "number" && purchaseAmount > 0) {
      const sats = Math.max(1, Math.round(purchaseAmount / 1000));
      return `${sats.toLocaleString()} sats`;
    }

    const invoiceAmount = invoice?.amount_msats;
    if (typeof invoiceAmount === "number" && invoiceAmount > 0) {
      const sats = Math.max(1, Math.round(invoiceAmount / 1000));
      return `${sats.toLocaleString()} sats`;
    }

    if (typeof game.priceSats === "number") {
      return `${game.priceSats.toLocaleString()} sats`;
    }

    return "—";
  }, [purchase?.amount_msats, invoice?.amount_msats, game.priceSats]);

  const statusMessage = describeInvoiceStatus(
    invoiceStatus,
    flowState,
    downloadUnlocked,
    isGuestCheckout,
  );

  const statusPill = useMemo(() => {
    if (invoiceStatus === "PAID") {
      return { label: "Paid", intent: "emerald" as const };
    }
    if (invoiceStatus === "EXPIRED" || flowState === "expired") {
      return { label: "Expired", intent: "magenta" as const };
    }
    if (flowState === "error") {
      return { label: "Error", intent: "magenta" as const };
    }
    if (invoiceActive) {
      return { label: "Invoice active", intent: "emerald" as const };
    }
    if (flowState === "creating") {
      return { label: "Preparing", intent: "slate" as const };
    }
    return { label: "Lightning ready", intent: "emerald" as const };
  }, [invoiceActive, invoiceStatus, flowState]);

  useEffect(() => {
    setInvoice(null);
    setPurchase(null);
    setCopyState("idle");
    setQrCodeUrl(null);
    setQrGenerationFailed(false);
    setInvoiceCreatedAt(null);
    setPaymentConfirmedAt(null);
    setDownloadUnlockedAt(null);

    const gameId = game.id;
    if (!gameId) {
      setFlowState("error");
      setErrorMessage(
        "Lightning checkout is only available for seeded games right now. Pick one of the live catalog titles to generate an invoice.",
      );
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const createInvoice = async () => {
      setErrorMessage(null);

      if (user) {
        try {
          const existing = await getLatestPurchaseForGame(gameId, user.id);
          if (cancelled) {
            return;
          }

          if (existing && (existing.download_granted || existing.invoice_status === "PAID")) {
            const createdAt = parseDate(existing.created_at) ?? new Date();
            setPurchase(existing);
            setInvoiceCreatedAt(createdAt);
            setFlowState(existing.download_granted ? "paid" : "polling");
            return;
          }
        } catch (_error) {
          if (cancelled) {
            return;
          }
          // Ignore lookup errors so a fresh invoice can still be generated.
        }
      }

      setFlowState("creating");

      try {
        let payload: InvoiceCreateRequest;
        if (user) {
          payload = { user_id: user.id };
        } else {
          const anonId = getOrCreateAnonId();
          if (!anonId) {
            throw new Error("Guest checkout requires a device identifier. Refresh the page and try again.");
          }
          payload = { anon_id: anonId };
        }

        const created = await createGameInvoice(gameId, payload);
        if (cancelled) {
          return;
        }

        setInvoice(created);
        setInvoiceCreatedAt(new Date());
        setFlowState("polling");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFlowState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to create a Lightning invoice. Please try again.",
        );
      }
    };

    void createInvoice();

    return () => {
      cancelled = true;
    };
  }, [game.id, user, refreshKey]);

  useEffect(() => {
    if (!purchase) {
      return;
    }

    if (purchase.invoice_status === "PAID" && !paymentConfirmedAt) {
      const paidTimestamp = purchase.paid_at ? new Date(purchase.paid_at) : new Date();
      setPaymentConfirmedAt(paidTimestamp);
    }

    if (purchase.download_granted && !downloadUnlockedAt) {
      const unlockedTimestamp = purchase.updated_at ? new Date(purchase.updated_at) : new Date();
      setDownloadUnlockedAt(unlockedTimestamp);
    }
  }, [purchase, paymentConfirmedAt, downloadUnlockedAt]);

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }
    if (typeof window === "undefined") {
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

  const handlePurchaseUpdate = useCallback((latest: PurchaseRecord) => {
    setPurchase(latest);
    setErrorMessage(null);
    if (latest.download_granted) {
      setFlowState("paid");
    }
  }, []);

  const handleInvoiceExpired = useCallback((latest: PurchaseRecord) => {
    setPurchase(latest);
    setFlowState("expired");
    setErrorMessage(
      "The Lightning invoice expired before payment was detected. Generate a new invoice to try again.",
    );
  }, []);

  const handlePollingError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  const invoiceIdToPoll = invoice?.purchase_id ?? purchase?.id ?? null;

  useInvoicePolling({
    invoiceId: invoiceIdToPoll,
    enabled: flowState === "polling" && Boolean(invoiceIdToPoll),
    onPurchase: handlePurchaseUpdate,
    onExpired: handleInvoiceExpired,
    onError: handlePollingError,
  });

  const timelineSteps = useMemo<InvoiceStep[]>(() => {
    const expired = invoiceStatus === "EXPIRED" || flowState === "expired";
    const invoiceCreated = Boolean(invoiceCreatedAt);
    const createdTimestamp = invoiceCreated ? formatTimestamp(invoiceCreatedAt) : "--";
    const paymentTimestamp = invoiceStatus === "PAID" ? formatTimestamp(paymentConfirmedAt) : "--";
    const downloadTimestamp = downloadUnlocked ? formatTimestamp(downloadUnlockedAt) : "--";

    const waitingLabel = expired ? "Invoice expired" : "Waiting for payment";
    const waitingStatus: InvoiceStep["status"] = invoiceStatus === "PAID"
      ? "done"
      : expired
      ? "pending"
      : invoiceCreated
      ? "active"
      : "pending";

    const paymentStatus: InvoiceStep["status"] = invoiceStatus === "PAID" ? "done" : expired ? "pending" : "pending";

    const downloadStatus: InvoiceStep["status"] = downloadUnlocked
      ? "done"
      : invoiceStatus === "PAID"
      ? "active"
      : expired
      ? "pending"
      : "pending";

    return [
      {
        label: "Invoice created",
        status: invoiceCreated ? "done" : flowState === "creating" ? "active" : "pending",
        timestamp: createdTimestamp,
      },
      {
        label: waitingLabel,
        status: waitingStatus,
        timestamp: paymentTimestamp,
      },
      {
        label: "Payment confirmed",
        status: paymentStatus,
        timestamp: paymentTimestamp,
      },
      {
        label: "Download unlocked",
        status: downloadStatus,
        timestamp: downloadTimestamp,
      },
    ];
  }, [
    downloadUnlocked,
    downloadUnlockedAt,
    flowState,
    invoiceCreatedAt,
    invoiceStatus,
    paymentConfirmedAt,
  ]);

  const handleCopyInvoice = useCallback(async () => {
    if (!invoice?.payment_request) {
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
      console.error("Failed to copy Lightning invoice", error);
      setCopyState("error");
    }
  }, [invoice]);

  const handleGenerateNewInvoice = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const receiptLink = invoice?.check_url ?? null;
  const invoiceReady = Boolean(invoice?.payment_request);
  const showRegenerateButton = flowState === "expired" || flowState === "error";

  return (
    <Modal
      isOpen
      onClose={onClose}
      containerClassName="items-center justify-center px-4 py-0"
      contentClassName="flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-y-auto rounded-[32px] border border-emerald-400/25 bg-slate-950 shadow-[0_40px_120px_rgba(16,185,129,0.28)]"
      backdropClassName="bg-slate-950/85"
      backdrop={
        <>
          <div
            className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/50"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,theme(colors.slate.950/55),theme(colors.slate.950/95))]"
            aria-hidden="true"
          />
        </>
      }
      backdropAriaLabel="Close Lightning checkout"
      ariaLabel="Lightning checkout dialog"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-6 top-6 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
      >
        Close
      </button>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="relative bg-gradient-to-br from-slate-900/40 via-slate-950 to-slate-950 px-8 py-12 text-slate-100">
          <div className="absolute -top-36 -right-36 h-96 w-96 rounded-full bg-slate-500/15 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-slate-600/10 blur-3xl" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <MicroLabel>Lightning checkout</MicroLabel>
              <Pill intent={statusPill.intent}>{statusPill.label}</Pill>
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold tracking-tight text-white">
                Scan or copy to complete your purchase of {game.title}
              </h3>
              <p className="text-sm text-emerald-200/80">
                Use any Lightning wallet to pay the invoice. Sats are routed directly to{' '}
                <span className="font-semibold text-emerald-200">
                  {game.lightningAddress || "the developer"}
                </span>
                . The download unlocks as soon as payment settles.
              </p>
            </div>

            {errorMessage ? (
              <p className="rounded-2xl border border-rose-400/60 bg-rose-500/10 p-4 text-sm text-rose-100">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex flex-col items-center gap-3 rounded-3xl border border-emerald-400/30 bg-slate-950/60 p-6 shadow-[0_0_60px_rgba(16,185,129,0.35)]">
              <div className="flex h-72 w-72 items-center justify-center rounded-[28px] border border-emerald-400/40 bg-gradient-to-br from-emerald-400/15 via-transparent to-emerald-400/10">
                {qrCodeUrl ? (
                  <Image
                    src={qrCodeUrl}
                    alt="Lightning invoice QR code"
                    width={256}
                    height={256}
                    className="h-auto w-auto"
                    unoptimized
                    priority
                  />
                ) : qrGenerationFailed ? (
                  <span className="px-6 text-center text-xs leading-relaxed text-emerald-100/70">
                    Unable to generate a QR code. Copy the invoice text below into your wallet.
                  </span>
                ) : invoiceReady ? (
                  <span className="text-sm uppercase tracking-[0.35em] text-emerald-100">Preparing QR…</span>
                ) : (
                  <span className="text-sm uppercase tracking-[0.35em] text-emerald-100">Generating invoice…</span>
                )}
              </div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/80">Scan with a Lightning wallet</p>
            </div>

            <div className="space-y-3">
              <MicroLabel>BOLT11 invoice</MicroLabel>
              <textarea
                readOnly
                value={invoice?.payment_request ?? ""}
                placeholder="Invoice will appear here once generated"
                className="h-36 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/80 p-4 text-[11px] text-emerald-100 shadow-[0_0_35px_rgba(16,185,129,0.25)]"
              />
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={handleCopyInvoice}
                  disabled={!invoiceReady}
                  className={cn(
                    "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-emerald-50 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:border-emerald-300 hover:text-emerald-50",
                    !invoiceReady && "cursor-not-allowed opacity-50",
                  )}
                >
                  {copyState === "copied" ? "Copied" : "Copy invoice"}
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
                <MicroLabel>Status</MicroLabel>
                <p className="mt-2 text-sm text-slate-200">{statusMessage}</p>
              </div>
              {receiptLink ? (
                <p className="text-xs text-slate-400">
                  Monitor the purchase from another device:&nbsp;
                  <a
                    href={receiptLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 underline hover:text-emerald-200"
                  >
                    View purchase status
                  </a>
                </p>
              ) : null}
              {showRegenerateButton ? (
                <button
                  type="button"
                  onClick={handleGenerateNewInvoice}
                  className="mt-2 inline-flex items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.3)] transition hover:border-emerald-300"
                >
                  Generate new invoice
                </button>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-emerald-100">
              <p className="font-semibold uppercase tracking-[0.3em]">Need a wallet?</p>
              <p className="mt-2 leading-relaxed text-emerald-50/90">
                Breez, Phoenix, Muun, and Zeus are great Lightning wallets that support scanning QR codes or pasting invoices.
              </p>
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-6 bg-slate-950 px-8 py-12 text-slate-200">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <MicroLabel>Purchase summary</MicroLabel>
            <div className="mt-4 grid gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-slate-400">Amount due</span>
                <span className="text-lg font-semibold text-emerald-200">{amountLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-slate-400">Game</span>
                <span className="font-semibold text-slate-100">{game.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-slate-400">Developer wallet</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {game.lightningAddress || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-slate-400">Invoice ID</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {invoice?.invoice_id ?? purchase?.invoice_id ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-slate-400">Purchase ID</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {invoice?.purchase_id ?? purchase?.id ?? "—"}
                </span>
              </div>
            </div>
          </div>
          <div>
            <MicroLabel>Status timeline</MicroLabel>
            <div className="mt-4 space-y-4">
              {timelineSteps.map((step) => (
                <div key={step.label} className="flex items-center gap-4">
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full border text-[0.6rem] uppercase tracking-[0.35em]",
                      step.status === "done"
                        ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200"
                        : step.status === "active"
                        ? "border-emerald-400/60 text-emerald-200"
                        : "border-slate-700 text-slate-500",
                    )}
                  >
                    {step.status === "pending" ? "" : step.timestamp}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{step.label}</p>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
                      {step.status === "done"
                        ? "Captured"
                        : step.status === "active"
                        ? "Awaiting payment"
                        : "Pending"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm leading-relaxed text-slate-300">
            <p className="font-semibold text-slate-200">What happens next?</p>
            <ul className="mt-3 space-y-2">
              <li>• Your wallet confirms payment instantly.</li>
              <li>• The download unlocks within a few seconds.</li>
              <li>• Keep the receipt handy so you can restore the purchase on another device.</li>
            </ul>
            <p className="mt-4 text-[12px] text-slate-500">
              Need help? Ping <span className="font-semibold text-emerald-200">support@proof-of-play.gg</span> with the invoice ID above.
            </p>
          </div>
        </section>
      </div>
    </Modal>
  );
}
