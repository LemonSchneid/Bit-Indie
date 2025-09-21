"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LightningDestinationConfig,
  LnurlPayParams,
  clampZapAmount,
  fetchLnurlPayParams,
  isWeblnAvailable,
  openLightningInvoice,
  payWithWebln,
  requestLnurlInvoice,
  resolveLightningPayEndpoint,
} from "../lib/lightning";
import { Modal } from "./ui/modal";

const PRESET_SAT_AMOUNTS = [1, 10, 21, 50];

type ZapButtonProps = {
  lightningAddress?: string | null;
  lnurl?: string | null;
  recipientLabel: string;
  comment?: string;
  className?: string;
};

type ZapStatus = "idle" | "loading" | "paying" | "error";

export function ZapButton({
  lightningAddress,
  lnurl,
  recipientLabel,
  comment,
  className,
}: ZapButtonProps): JSX.Element {
  const hasDestination = Boolean(lightningAddress?.trim()) || Boolean(lnurl?.trim());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [status, setStatus] = useState<ZapStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payParams, setPayParams] = useState<LnurlPayParams | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastZapAmount, setLastZapAmount] = useState<number | null>(null);
  const [amountWasClamped, setAmountWasClamped] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");

  const payEndpointConfig = useMemo<LightningDestinationConfig>(
    () => ({ lightningAddress, lnurl }),
    [lightningAddress, lnurl],
  );

  useEffect(() => {
    setPayParams(null);
  }, [payEndpointConfig]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!showSuccess) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowSuccess(false);
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [showSuccess]);

  const resetMessages = useCallback(() => {
    setErrorMessage(null);
    setShowSuccess(false);
  }, []);

  const loadPayParams = useCallback(async (): Promise<LnurlPayParams | null> => {
    try {
      setStatus("loading");
      resetMessages();
      const endpoint = resolveLightningPayEndpoint(payEndpointConfig);
      const params = await fetchLnurlPayParams(endpoint);
      setPayParams(params);
      setStatus("idle");
      return params;
    } catch (error) {
      setStatus("error");
      const message =
        error instanceof Error ? error.message : "Unable to load zap configuration.";
      setErrorMessage(message);
      return null;
    }
  }, [payEndpointConfig, resetMessages]);

  useEffect(() => {
    if (!isMenuOpen || payParams || !hasDestination) {
      return;
    }

    void loadPayParams();
  }, [isMenuOpen, payParams, hasDestination, loadPayParams]);

  const isAmountAllowed = useCallback(
    (amount: number) => {
      if (!payParams) {
        return true;
      }
      const minSats = payParams.minSendable / 1000;
      const maxSats = payParams.maxSendable / 1000;
      return amount >= minSats && amount <= maxSats;
    },
    [payParams],
  );

  const handleToggle = useCallback(() => {
    if (!hasDestination) {
      return;
    }

    resetMessages();
    setIsMenuOpen((current) => !current);
  }, [hasDestination, resetMessages]);

  const sendZap = useCallback(
    async (requestedAmount: number) => {
      if (!hasDestination) {
        return;
      }

      const params = payParams ?? (await loadPayParams());

      if (!params) {
        return;
      }

      try {
        setStatus("paying");
        resetMessages();
        const normalizedAmount = clampZapAmount(requestedAmount, params);
        const invoice = await requestLnurlInvoice(params, normalizedAmount, comment);
        let wasPaidThroughWebln = false;
        if (isWeblnAvailable()) {
          try {
            await payWithWebln(invoice.pr);
            wasPaidThroughWebln = true;
          } catch (error) {
            console.warn("WebLN payment failed, falling back to lightning link.", error);
          }
        }

        if (!wasPaidThroughWebln) {
          openLightningInvoice(invoice.pr);
        }

        setLastZapAmount(normalizedAmount);
        setAmountWasClamped(normalizedAmount !== requestedAmount);
        setShowSuccess(true);
        setCustomAmount("");
        setIsMenuOpen(false);
        setStatus("idle");
      } catch (error) {
        setStatus("error");
        const message = error instanceof Error ? error.message : "Unable to send zap.";
        setErrorMessage(message);
        return;
      }
    },
    [comment, hasDestination, loadPayParams, payParams, resetMessages],
  );

  const handleCustomSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = Number.parseInt(customAmount, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setErrorMessage("Enter a positive number of sats.");
        return;
      }
      await sendZap(parsed);
    },
    [customAmount, sendZap],
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

  const minSats = payParams ? Math.ceil(payParams.minSendable / 1000) : null;
  const maxSats = payParams ? Math.floor(payParams.maxSendable / 1000) : null;
  const isLoading = status === "loading" || status === "paying";

  return (
    <div className={className ?? ""}>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={isMenuOpen}
        disabled={isLoading}
      >
        <span aria-hidden className="text-base leading-none">⚡</span>
        <span>Zap</span>
      </button>

      <Modal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
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
            onClick={() => setIsMenuOpen(false)}
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
              onClick={() => sendZap(amount)}
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
