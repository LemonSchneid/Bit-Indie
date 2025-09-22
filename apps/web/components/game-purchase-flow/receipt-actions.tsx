import type { CopyState } from "./hooks";

type ReceiptActionsProps = {
  value: string;
  description: string;
  copyState: CopyState;
  onCopy: () => void;
  onDownload: () => void;
  className?: string;
  descriptionClassName?: string;
  labels?: {
    copyIdle?: string;
    copyCopied?: string;
    copyError?: string;
    download?: string;
  };
};

const baseButtonClass =
  "inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:bg-emerald-400/20";

const downloadButtonClass =
  "inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-100";

export function ReceiptActions({
  value,
  description,
  copyState,
  onCopy,
  onDownload,
  className,
  descriptionClassName,
  labels,
}: ReceiptActionsProps) {
  if (!value) {
    return null;
  }

  const copyIdle = labels?.copyIdle ?? "Copy";
  const copyCopied = labels?.copyCopied ?? "Copied";
  const copyError = labels?.copyError ?? "Copy unavailable";
  const download = labels?.download ?? "Download receipt";

  const combinedClassName = [
    "space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-200",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={combinedClassName}>
      <p className={descriptionClassName ?? "text-sm text-slate-200"}>{description}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 break-all rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-[0.65rem] text-slate-300">
          {value}
        </code>
        <div className="flex gap-2">
          <button type="button" onClick={onCopy} className={baseButtonClass}>
            {copyState === "copied" ? copyCopied : copyState === "error" ? copyError : copyIdle}
          </button>
          <button type="button" onClick={onDownload} className={downloadButtonClass}>
            {download}
          </button>
        </div>
      </div>
    </div>
  );
}
