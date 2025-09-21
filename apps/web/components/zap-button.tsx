"use client";

import { useCallback, useEffect, useState } from "react";

import { useZapWorkflow } from "../lib/hooks/use-zap-workflow";
import { Modal } from "./ui/modal";

const PRESET_SAT_AMOUNTS = [1, 10, 21, 50];

type ZapButtonProps = {
  lightningAddress?: string | null;
  lnurl?: string | null;
  recipientLabel: string;
  comment?: string;
  className?: string;
};

export function ZapButton({
  lightningAddress,
  lnurl,
  recipientLabel,
  comment,
  className,
}: ZapButtonProps): JSX.Element {
  const [customAmount, setCustomAmount] = useState<string>("");
  const {
    hasDestination,
    isMenuOpen,
    isLoading,
    minSats,
    maxSats,
    toggleMenu,
    closeMenu,
    sendZap,
    isAmountAllowed,
    errorMessage,
    showSuccess,
    lastZapAmount,
    amountWasClamped,
    reportError,
  } = useZapWorkflow({ lightningAddress, lnurl, comment });

  useEffect(() => {
    if (showSuccess) {
      setCustomAmount("");
    }
  }, [showSuccess]);

  const handleCustomSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = Number.parseInt(customAmount, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        reportError("Enter a positive number of sats.");
        return;
      }
      await sendZap(parsed);
    },
    [customAmount, reportError, sendZap],
  );

  if (!hasDestination) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 ${className ?? ""}`}
        role="note"
      >
        LINK WALLET TO RECEIVE ZAPS
      </span>
    );
  }

  return (
    <div className={className ?? ""}>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        onClick={toggleMenu}
        aria-haspopup="dialog"
        aria-expanded={isMenuOpen}
        disabled={isLoading}
      >
        <span aria-hidden className="text-base leading-none">⚡</span>
        <span>Zap</span>
      </button>

      <Modal
        isOpen={isMenuOpen}
        onClose={closeMenu}
        containerClassName="items-center justify-center px-4"
        contentClassName="w-full max-w-xs rounded-2xl border border-amber-400/40 bg-slate-950/95 p-5 text-xs text-slate-200 shadow-xl shadow-amber-500/20"
        backdropClassName="bg-slate-950/80"
        backdropAriaLabel="Close zap menu"
        ariaLabel="Zap menu"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/80">Send sats</p>
            <p className="mt-1 text-sm text-slate-200">Support {recipientLabel} with a quick zap.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-300 transition hover:border-white/40 hover:bg-white/10"
            onClick={closeMenu}
          >
            Close
          </button>
        </div>

        {minSats !== null && maxSats !== null ? (
          <p className="mt-2 text-[11px] text-slate-400">
            Available range: {minSats.toLocaleString()} – {maxSats.toLocaleString()} sats
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {PRESET_SAT_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                isAmountAllowed(amount)
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-100 hover:border-amber-300 hover:bg-amber-400/25"
                  : "cursor-not-allowed border-white/10 bg-slate-900/60 text-slate-500"
              }`}
              onClick={() => {
                void sendZap(amount);
              }}
              disabled={!isAmountAllowed(amount) || isLoading}
            >
              {amount.toLocaleString()} sats
            </button>
          ))}
        </div>

        <form className="mt-3 flex items-center gap-2" onSubmit={handleCustomSubmit}>
          <input
            type="number"
            min={minSats ?? 1}
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            placeholder="Custom sats"
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)}
          />
          <button
            type="submit"
            className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            disabled={isLoading}
          >
            Zap
          </button>
        </form>

        {isLoading ? (
          <p className="mt-3 text-[11px] text-slate-400">Preparing invoice…</p>
        ) : null}

        {errorMessage ? (
          <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-[11px] text-rose-100">
            {errorMessage}
          </p>
        ) : null}
      </Modal>

      {showSuccess && lastZapAmount !== null ? (
        <p className="mt-2 text-[11px] text-emerald-300">
          Invoice for {lastZapAmount.toLocaleString()} sats sent to your wallet
          {amountWasClamped ? " (adjusted to allowed range)." : "."}
        </p>
      ) : null}
    </div>
  );
}
