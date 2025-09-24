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
  "inline-flex items-center justify-center rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-500/20 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-100 shadow shadow-emerald-500/20 transition hover:from-emerald-400/30 hover:to-cyan-500/30";

const downloadButtonClass =
  "inline-flex items-center justify-center rounded-full border border-white/20 bg-slate-950/60 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-300/40 hover:text-emerald-100";

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
    "relative overflow-hidden space-y-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-200 shadow-lg shadow-emerald-500/10 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_65%)] before:content-['']",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={combinedClassName}>
      <p className={descriptionClassName ?? "text-sm leading-relaxed text-slate-200"}>{description}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 break-all rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-[0.65rem] text-slate-300 shadow-inner shadow-emerald-500/10">
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
