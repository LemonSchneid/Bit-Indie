import type { CopyState } from "./hooks";
import { ReceiptActions } from "./receipt-actions";

type DownloadUnlockedCardProps = {
  buildAvailable: boolean;
  downloadUrl: string;
  receiptLink: string;
  receiptCopyState: CopyState;
  onCopyReceiptLink: () => void;
  onDownloadReceipt: () => void;
};

export function DownloadUnlockedCard({
  buildAvailable,
  downloadUrl,
  receiptLink,
  receiptCopyState,
  onCopyReceiptLink,
  onDownloadReceipt,
}: DownloadUnlockedCardProps) {
  return (
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
      {receiptLink ? (
        <ReceiptActions
          value={receiptLink}
          copyState={receiptCopyState}
          onCopy={onCopyReceiptLink}
          onDownload={onDownloadReceipt}
          description="Save this receipt link to restore the download later. You can copy it or download a receipt file."
          descriptionClassName="text-sm text-slate-100"
          className="space-y-2 rounded-2xl border border-emerald-400/30 bg-slate-950/40 p-4 text-xs text-slate-200"
          labels={{
            copyIdle: "Copy link",
            copyCopied: "Receipt copied",
            copyError: "Copy unavailable",
            download: "Download receipt",
          }}
        />
      ) : null}
    </div>
  );
}
