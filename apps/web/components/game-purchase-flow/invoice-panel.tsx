import Image from "next/image";

import type { InvoiceCreateResponse } from "../../lib/api";
import type { CopyState, InvoiceFlowState } from "./hooks";
import { ReceiptActions } from "./receipt-actions";

type InvoicePanelProps = {
  gameTitle: string;
  priceLabel: string;
  hasAccount: boolean;
  flowState: InvoiceFlowState;
  errorMessage: string | null;
  invoice: InvoiceCreateResponse | null;
  isGuestCheckout: boolean;
  statusMessage: string;
  copyState: CopyState;
  receiptCopyState: CopyState;
  receiptLinkToCopy: string;
  receiptUrl: string | null;
  qrCodeUrl: string | null;
  qrGenerationFailed: boolean;
  downloadUnlocked: boolean;
  buildAvailable: boolean;
  onCreateInvoice: () => void;
  onCopyInvoice: () => void;
  onCopyReceiptLink: () => void;
  onDownloadReceipt: () => void;
};

export function InvoicePanel({
  gameTitle,
  priceLabel,
  hasAccount,
  flowState,
  errorMessage,
  invoice,
  isGuestCheckout,
  statusMessage,
  copyState,
  receiptCopyState,
  receiptLinkToCopy,
  receiptUrl,
  qrCodeUrl,
  qrGenerationFailed,
  downloadUnlocked,
  buildAvailable,
  onCreateInvoice,
  onCopyInvoice,
  onCopyReceiptLink,
  onDownloadReceipt,
}: InvoicePanelProps) {
  return (
    <div className="relative z-10">
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
          {hasAccount ? (
            <p>We&apos;ll create a one-time invoice linked to your Proof of Play account.</p>
          ) : (
            <p>
              Guest checkout sends sats directly to the developer. Save the receipt so you can restore the download later.
            </p>
          )}
          <button
            type="button"
            onClick={onCreateInvoice}
            disabled={flowState === "creating"}
            className="inline-flex w-full items-center justify-center rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 shadow shadow-emerald-500/20 transition hover:from-emerald-400/30 hover:to-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {flowState === "creating" ? "Creating invoice…" : "Generate Lightning invoice"}
          </button>
          {hasAccount ? null : (
            <p className="text-xs text-amber-200">
              No sign-in required. Pay with any Lightning wallet and keep the receipt afterward.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="flex justify-center">
            <div className="rounded-2xl border border-white/10 bg-white p-4 shadow-xl shadow-emerald-500/20">
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
          <p className="text-center text-sm text-slate-300">Pay {priceLabel} with any Lightning wallet.</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">BOLT11 invoice</p>
            <textarea
              readOnly
              value={invoice.payment_request}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-xs leading-relaxed text-slate-100 shadow-inner shadow-emerald-500/10"
              rows={4}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <button
                type="button"
                onClick={onCopyInvoice}
                className="inline-flex items-center rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-500/20 px-4 py-2 font-semibold uppercase tracking-[0.2em] text-emerald-100 shadow shadow-emerald-500/20 transition hover:from-emerald-400/30 hover:to-cyan-500/30"
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
          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200 shadow-lg shadow-emerald-500/10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Status</p>
              <p className="mt-2 text-sm text-slate-200">{statusMessage}</p>
            </div>
            {isGuestCheckout ? (
              <p className="text-xs text-slate-400">
                Guest invoices aren&apos;t monitored automatically. After paying, download the receipt so you can restore your
                purchase later.
              </p>
            ) : (
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
            )}
          </div>
          <ReceiptActions
            value={receiptLinkToCopy}
            copyState={receiptCopyState}
            onCopy={onCopyReceiptLink}
            onDownload={onDownloadReceipt}
            description={`Save this ${isGuestCheckout ? "payment request" : "receipt link"} to restore the download later.`}
          />
          {flowState === "expired" ? (
            <button
              type="button"
              onClick={onCreateInvoice}
              className="w-full rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 shadow shadow-emerald-500/20 transition hover:from-emerald-400/30 hover:to-cyan-500/30"
            >
              Generate a new invoice
            </button>
          ) : null}
          {downloadUnlocked ? (
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100 shadow shadow-emerald-500/20">
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
    </div>
  );
}
