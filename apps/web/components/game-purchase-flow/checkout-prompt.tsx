import type { FormEvent } from "react";

type CheckoutPromptProps = {
  showReceiptLookup: boolean;
  manualReceiptId: string;
  onStartCheckout: () => void;
  onToggleReceiptLookup: () => void;
  onCancelReceiptLookup: () => void;
  onManualReceiptIdChange: (value: string) => void;
  onReceiptLookupSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CheckoutPrompt({
  showReceiptLookup,
  manualReceiptId,
  onStartCheckout,
  onToggleReceiptLookup,
  onCancelReceiptLookup,
  onManualReceiptIdChange,
  onReceiptLookupSubmit,
}: CheckoutPromptProps) {
  return (
    <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-200">
      <p>Complete a Lightning payment to unlock the download instantly.</p>
      <button
        type="button"
        onClick={onStartCheckout}
        className="inline-flex w-full items-center justify-center rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 shadow shadow-emerald-500/20 transition hover:from-emerald-400/30 hover:to-cyan-500/30"
      >
        Start Lightning checkout
      </button>
      <button
        type="button"
        onClick={onToggleReceiptLookup}
        className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80 transition hover:text-emerald-100"
      >
        Have a receipt link?
      </button>
      {showReceiptLookup ? (
        <form
          className="flex flex-col gap-3 text-xs text-slate-300 sm:flex-row sm:items-end"
          onSubmit={onReceiptLookupSubmit}
        >
          <input
            type="text"
            value={manualReceiptId}
            onChange={(event) => onManualReceiptIdChange(event.target.value)}
            placeholder="Enter receipt ID or URL"
            className="w-full flex-1 rounded-full border border-white/15 bg-slate-950/70 px-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 shadow shadow-emerald-500/20 transition hover:from-emerald-400/30 hover:to-cyan-500/30"
            >
              Open receipt
            </button>
            <button
              type="button"
              onClick={onCancelReceiptLookup}
              className="rounded-full border border-white/15 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-300/40 hover:text-emerald-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
