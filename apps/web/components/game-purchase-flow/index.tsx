"use client";

import { useEffect, useState } from "react";

import { Modal } from "../ui/modal";
import { CheckoutPrompt } from "./checkout-prompt";
import { DownloadUnlockedCard } from "./download-unlocked-card";
import { useGamePurchaseFlow } from "./hooks";
import { InvoicePanel } from "./invoice-panel";
import { PurchaseHeader } from "./purchase-header";

export type GamePurchaseFlowProps = {
  gameId: string;
  gameTitle: string;
  priceMsats: number;
  priceLabel: string;
  buildAvailable: boolean;
  developerLightningAddress: string | null;
};

export function GamePurchaseFlow(props: GamePurchaseFlowProps): JSX.Element | null {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    isPurchasable,
    isGuestCheckout,
    flowState,
    invoice,
    errorMessage,
    copyState,
    qrCodeUrl,
    qrGenerationFailed,
    showReceiptLookup,
    manualReceiptId,
    receiptCopyState,
    downloadUnlocked,
    downloadUrl,
    receiptUrl,
    receiptLinkToCopy,
    statusMessage,
    handleCreateInvoice,
    handleCopyInvoice,
    handleCopyReceiptLink,
    handleDownloadReceipt,
    handleReceiptLookupSubmit,
    prepareCheckout,
    toggleReceiptLookup,
    closeReceiptLookup,
    setManualReceiptId,
  } = useGamePurchaseFlow(props);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

  if (!isPurchasable) {
    return null;
  }

  const handleStartCheckout = () => {
    prepareCheckout();
    setIsModalOpen(true);
  };

  const handleManualReceiptIdChange = (value: string) => {
    setManualReceiptId(value);
  };

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
        <PurchaseHeader gameTitle={props.gameTitle} priceLabel={props.priceLabel} />
        {downloadUnlocked ? (
          <DownloadUnlockedCard
            buildAvailable={props.buildAvailable}
            downloadUrl={downloadUrl}
            receiptLink={receiptLinkToCopy}
            receiptCopyState={receiptCopyState}
            onCopyReceiptLink={handleCopyReceiptLink}
            onDownloadReceipt={handleDownloadReceipt}
          />
        ) : (
          <CheckoutPrompt
            showReceiptLookup={showReceiptLookup}
            manualReceiptId={manualReceiptId}
            onStartCheckout={handleStartCheckout}
            onToggleReceiptLookup={toggleReceiptLookup}
            onCancelReceiptLookup={closeReceiptLookup}
            onManualReceiptIdChange={handleManualReceiptIdChange}
            onReceiptLookupSubmit={handleReceiptLookupSubmit}
          />
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        containerClassName="items-center justify-center px-4 py-6"
        contentClassName="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl"
        backdropClassName="bg-slate-950/80"
        backdropAriaLabel="Close checkout"
        ariaLabel="Lightning checkout"
      >
        <button
          type="button"
          onClick={() => setIsModalOpen(false)}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/60 text-slate-300 transition hover:text-white"
          aria-label="Close checkout"
        >
          <span aria-hidden>×</span>
        </button>
        <InvoicePanel
          gameTitle={props.gameTitle}
          priceLabel={props.priceLabel}
          hasAccount={!isGuestCheckout}
          flowState={flowState}
          errorMessage={errorMessage}
          invoice={invoice}
          isGuestCheckout={isGuestCheckout}
          statusMessage={statusMessage}
          copyState={copyState}
          receiptCopyState={receiptCopyState}
          receiptLinkToCopy={receiptLinkToCopy}
          receiptUrl={receiptUrl}
          qrCodeUrl={qrCodeUrl}
          qrGenerationFailed={qrGenerationFailed}
          downloadUnlocked={downloadUnlocked}
          buildAvailable={props.buildAvailable}
          onCreateInvoice={handleCreateInvoice}
          onCopyInvoice={handleCopyInvoice}
          onCopyReceiptLink={handleCopyReceiptLink}
          onDownloadReceipt={handleDownloadReceipt}
        />
      </Modal>
    </>
  );
}

export { describeInvoiceStatus, type InvoiceFlowState } from "./hooks";
