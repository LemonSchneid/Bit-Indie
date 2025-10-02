"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { extractReceiptIdFromInput } from "./receipt-handling";

export function useReceiptLookupForm() {
  const router = useRouter();
  const [showReceiptLookup, setShowReceiptLookup] = useState(false);
  const [manualReceiptId, setManualReceiptId] = useState("");

  const handleReceiptLookupSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = manualReceiptId.trim();
      if (!trimmed) {
        return;
      }

      setShowReceiptLookup(false);
      setManualReceiptId("");
      const receiptId = extractReceiptIdFromInput(trimmed);
      router.push(`/purchases/${encodeURIComponent(receiptId)}/receipt`);
    },
    [manualReceiptId, router],
  );

  const toggleReceiptLookup = useCallback(() => {
    setShowReceiptLookup((current) => {
      const next = !current;
      if (!next) {
        setManualReceiptId("");
      }
      return next;
    });
  }, []);

  const closeReceiptLookup = useCallback(() => {
    setShowReceiptLookup(false);
    setManualReceiptId("");
  }, []);

  return {
    showReceiptLookup,
    manualReceiptId,
    setManualReceiptId,
    handleReceiptLookupSubmit,
    toggleReceiptLookup,
    closeReceiptLookup,
  } as const;
}
