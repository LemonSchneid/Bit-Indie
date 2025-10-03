"use client";

import { useCallback, useState } from "react";

import type { InvoiceStatus } from "../../../../lib/api";
import { restorePurchaseDownload } from "../../../../lib/api";

type ReceiptDownloadActionsProps = {
  purchaseId: string;
  invoiceStatus: InvoiceStatus;
  downloadGranted: boolean;
  buildAvailable: boolean;
};

export function ReceiptDownloadActions({
  purchaseId,
  invoiceStatus,
  downloadGranted,
  buildAvailable,
}: ReceiptDownloadActionsProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRestore = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const response = await restorePurchaseDownload(purchaseId);
      window.location.assign(response.download_url);
    } catch (error) {
      console.error("Failed to restore download from receipt", error);
      if (error instanceof Error) {
        if (error.message === "Purchase is not eligible for download.") {
          setErrorMessage("Payment confirmation is still processing. Try again soon.");
          return;
        }
        if (error.message === "Game build is not available for download.") {
          setErrorMessage("The developer hasn't uploaded a downloadable build yet.");
          return;
        }
        setErrorMessage(error.message);
        return;
      }
      setErrorMessage("Unable to open the download link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [purchaseId]);

  if (invoiceStatus !== "PAID") {
    return (
      <p className="mt-3 text-sm text-[#dcfff2]/80">
        Pay the Lightning invoice to unlock this download. We'll refresh the receipt once payment is detected.
      </p>
    );
  }

  if (!downloadGranted) {
    return (
      <p className="mt-3 text-sm text-[#dcfff2]/80">
        This purchase is still finalizing. Check back shortly or contact support if the download remains locked.
      </p>
    );
  }

  if (!buildAvailable) {
    return (
      <p className="mt-3 text-sm text-[#dcfff2]/80">
        The developer hasn't uploaded a downloadable build yet. You'll be able to restore the download here once it's ready.
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      <button
        type="button"
        onClick={handleRestore}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center rounded-full border border-[#7bffc8]/60 bg-[#7bffc8]/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-[#7bffc8] hover:bg-[#7bffc8]/90 hover:text-[#050505] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Preparing download…" : "Restore download"}
      </button>
      {errorMessage ? (
        <p className="text-xs text-rose-200/80">{errorMessage}</p>
      ) : (
        <p className="text-xs text-[#b8ffe5]/60">
          We'll open a fresh signed link to the latest build. Keep this receipt handy so you can restore downloads on new devices.
        </p>
      )}
    </div>
  );
}
