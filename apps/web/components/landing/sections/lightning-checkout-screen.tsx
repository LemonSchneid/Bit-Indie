"use client";

import { useEffect, useState } from "react";

import type { InvoiceSnapshot, InvoiceStep } from "../landing-types";

import { cn, MicroLabel, NeonCard, Pill } from "./shared";

async function copyInvoiceToClipboard(invoiceText: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    const didCopy = await navigator.clipboard
      .writeText(invoiceText)
      .then(() => true)
      .catch((error) => {
        console.error("Failed to copy invoice via Clipboard API", error);
        return false;
      });
    if (didCopy) {
      return true;
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = invoiceText;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);

  let didCopy = false;
  const selection = document.getSelection();
  const originalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.select();
  try {
    didCopy = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
    if (originalRange && selection) {
      selection.removeAllRanges();
      selection.addRange(originalRange);
    }
  }

  if (!didCopy) {
    console.error("Fallback invoice copy failed using execCommand.");
  }

  return didCopy;
}

export function LightningCheckoutScreen({ invoice, steps }: { invoice: InvoiceSnapshot; steps: InvoiceStep[] }): JSX.Element {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timer = window.setTimeout(() => setCopyState("idle"), 3200);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopyInvoice = async () => {
    if (isCopying) {
      return;
    }

    setIsCopying(true);
    const didCopy = await copyInvoiceToClipboard(invoice.invoiceBolt11);
    setCopyState(didCopy ? "success" : "error");
    setIsCopying(false);
  };

  const copyFeedbackLabel =
    copyState === "success"
      ? "Invoice copied to clipboard"
      : copyState === "error"
      ? "Unable to copy invoice. Copy it manually."
      : null;

  return (
    <div className="flex justify-center">
      <NeonCard className="w-full max-w-3xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <MicroLabel>Lightning checkout</MicroLabel>
          <Pill>Invoice active</Pill>
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-64 w-64 items-center justify-center rounded-3xl border border-[#2dff85]/35 bg-[radial-gradient(circle_at_top,_rgba(57,255,20,0.22),_transparent_65%)] shadow-[0_0_45px_rgba(57,255,20,0.28)]">
              <span className="text-sm uppercase tracking-[0.3em] text-[#7bffc8]/80">QR Code</span>
            </div>
            <p className="text-[0.7rem] uppercase tracking-[0.4em] text-[#7bffc8]/70">Scan with a Lightning wallet</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <MicroLabel>BOLT11 invoice</MicroLabel>
              <textarea
                readOnly
                className="h-32 w-full rounded-2xl border border-[#2dff85]/35 bg-[rgba(9,9,9,0.92)] p-4 text-xs text-[#abffd9] shadow-[0_0_24px_rgba(57,255,20,0.3)]"
                value={invoice.invoiceBolt11}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyInvoice}
                  disabled={isCopying}
                  className="rounded-full border border-[#2dff85]/70 bg-[rgba(18,34,24,0.95)] px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#d9ffe9] shadow-[0_0_24px_rgba(57,255,20,0.3)] transition hover:border-[#7affc8] hover:text-white disabled:opacity-60"
                >
                  {isCopying ? "Copying…" : "Copy invoice"}
                </button>
                <span className="text-xs uppercase tracking-[0.35em] text-[#7bffc8]/70">Expires in {invoice.expiresInLabel}</span>
                <span aria-live="polite" className="text-[0.65rem] uppercase tracking-[0.3em] text-[#7bffc8]/80">
                  {copyFeedbackLabel}
                </span>
              </div>
            </div>
            <div>
              <MicroLabel>Status timeline</MicroLabel>
              <div className="mt-4 space-y-4">
                {steps.map((step) => (
                  <div key={step.label} className="flex items-center gap-4">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border text-[0.6rem] uppercase tracking-[0.35em]",
                        step.status === "done"
                          ? "border-[#2dff85]/80 bg-[rgba(18,34,24,0.95)] text-[#caffea]"
                          : step.status === "active"
                          ? "border-[#2dff85]/60 text-[#b9ffd9]"
                          : "border-[#262626] text-[#5f5f5f]",
                      )}
                    >
                      {step.status === "done" ? "✓" : step.status === "active" ? "•" : ""}
                    </span>
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="uppercase tracking-[0.35em] text-[#7bffc8]/70">{step.label}</span>
                      <span className="text-xs uppercase tracking-[0.25em] text-[#636363]">{step.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 text-sm text-[#9fb5aa] sm:grid-cols-2">
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/70">Game</span>
                <p className="mt-2 text-lg font-semibold text-white">{invoice.gameTitle}</p>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/70">Lightning address</span>
                <p className="mt-2 text-sm font-semibold text-[#abffd9]">{invoice.lightningAddress}</p>
              </div>
            </div>
          </div>
        </div>
      </NeonCard>
    </div>
  );
}
