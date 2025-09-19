"use client";

import { useEffect } from "react";

import type { PurchaseRecord } from "../api";
import { getPurchase } from "../api";

interface UseInvoicePollingOptions {
  invoiceId: string | null;
  enabled: boolean;
  pollIntervalMs?: number;
  onPurchase: (purchase: PurchaseRecord) => void;
  onExpired?: (purchase: PurchaseRecord) => void;
  onError?: (message: string) => void;
}

/**
 * Polls the backend for purchase updates until the invoice reaches a terminal state.
 */
export function useInvoicePolling({
  invoiceId,
  enabled,
  pollIntervalMs = 4000,
  onPurchase,
  onExpired,
  onError,
}: UseInvoicePollingOptions): void {
  useEffect(() => {
    if (!enabled || !invoiceId) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (delay: number) => {
      if (cancelled) {
        return;
      }

      timeoutId = setTimeout(() => {
        void poll();
      }, delay);
    };

    async function poll() {
      try {
        const purchase = await getPurchase(invoiceId);
        if (cancelled) {
          return;
        }

        onPurchase(purchase);

        if (purchase.download_granted) {
          return;
        }

        if (purchase.invoice_status === "EXPIRED" || purchase.invoice_status === "REFUNDED") {
          onExpired?.(purchase);
          return;
        }

        scheduleNext(pollIntervalMs);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to refresh the purchase status. Retrying…";
        onError?.(message);
        scheduleNext(pollIntervalMs * 2);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [invoiceId, enabled, pollIntervalMs, onPurchase, onExpired, onError]);
}
