import type { CopyState } from "./hooks";
import { ReceiptActions } from "./receipt-actions";

type DownloadUnlockedCardProps = {
  buildAvailable: boolean;
  downloadUrl: string | null;
  receiptLink: string;
  receiptCopyState: CopyState;
  onCopyReceiptLink: () => void;
  onDownloadReceipt: () => void;
  onRequestDownload?: () => void;
  isDownloadRequestPending?: boolean;
  downloadError?: string | null;
};

export function DownloadUnlockedCard({
  buildAvailable,
  downloadUrl,
  receiptLink,
  receiptCopyState,
  onCopyReceiptLink,
  onDownloadReceipt,
  onRequestDownload,
  isDownloadRequestPending = false,
  downloadError,
}: DownloadUnlockedCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100 shadow shadow-emerald-500/20 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_65%)] before:content-['']">
      <div className="relative z-10 space-y-4">
        <p className="text-base font-semibold text-emerald-50">Download unlocked</p>
        {buildAvailable ? (
          downloadUrl ? (
            <a
              href={downloadUrl}
              className="inline-flex w-full items-center justify-center rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-400/30 via-teal-400/20 to-cyan-500/30 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:from-emerald-400/40 hover:to-cyan-500/40"
            >
              Download build
            </a>
          ) : onRequestDownload ? (
            <button
              type="button"
              onClick={onRequestDownload}
              disabled={isDownloadRequestPending}
              className="inline-flex w-full items-center justify-center rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-400/30 via-teal-400/20 to-cyan-500/30 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:from-emerald-400/40 hover:to-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isDownloadRequestPending ? "Preparing download…" : "Open download"}
            </button>
          ) : (
            <p className="text-xs text-emerald-100/80">
              Sign in to download the build instantly or use your receipt to restore it later.
            </p>
          )
        ) : (
          <p className="text-xs text-emerald-100/80">
            The developer hasn&apos;t uploaded a downloadable build yet. You&apos;ll be notified once it&apos;s ready.
          </p>
        )}
        {downloadError ? (
          <p className="text-xs text-rose-100/80">{downloadError}</p>
        ) : null}
        {receiptLink ? (
          <ReceiptActions
            value={receiptLink}
            copyState={receiptCopyState}
            onCopy={onCopyReceiptLink}
            onDownload={onDownloadReceipt}
            description="Save this receipt link to restore the download later. You can copy it or download a receipt file."
            descriptionClassName="text-sm text-slate-100"
            className="space-y-2 border border-emerald-400/30 bg-slate-950/50"
            labels={{
              copyIdle: "Copy link",
              copyCopied: "Receipt copied",
              copyError: "Copy unavailable",
              download: "Download receipt",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
