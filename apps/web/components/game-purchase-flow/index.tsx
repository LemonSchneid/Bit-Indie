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
    downloadError,
    receiptUrl,
    receiptLinkToCopy,
    statusMessage,
    handleCreateInvoice,
    handleCopyInvoice,
    handleCopyReceiptLink,
    handleDownloadReceipt,
    handleDownloadBuild,
    handleReceiptLookupSubmit,
    prepareCheckout,
    toggleReceiptLookup,
    closeReceiptLookup,
    setManualReceiptId,
    isDownloadRequestPending,
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
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-emerald-500/10 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_60%)] before:content-[''] after:pointer-events-none after:absolute after:-right-24 after:top-1/2 after:-z-10 after:h-48 after:w-48 after:-translate-y-1/2 after:rounded-full after:bg-[radial-gradient(circle,_rgba(59,130,246,0.18),_transparent_65%)] after:content-['']"
      >
        <div className="relative z-10 space-y-5">
          <PurchaseHeader gameTitle={props.gameTitle} priceLabel={props.priceLabel} />
          {downloadUnlocked ? (
            <DownloadUnlockedCard
              buildAvailable={props.buildAvailable}
              downloadUrl={downloadUrl}
              receiptLink={receiptLinkToCopy}
              receiptCopyState={receiptCopyState}
              onCopyReceiptLink={handleCopyReceiptLink}
              onDownloadReceipt={handleDownloadReceipt}
              onRequestDownload={handleDownloadBuild ?? undefined}
              isDownloadRequestPending={isDownloadRequestPending}
              downloadError={downloadError}
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
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        containerClassName="items-center justify-center px-4 py-6"
        contentClassName="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-emerald-500/10 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_60%)] before:content-[''] after:pointer-events-none after:absolute after:-right-28 after:top-1/3 after:-z-10 after:h-64 after:w-64 after:rounded-full after:bg-[radial-gradient(circle,_rgba(59,130,246,0.2),_transparent_70%)] after:content-['']"
        backdropClassName="bg-slate-950/80 backdrop-blur-sm"
        backdropAriaLabel="Close checkout"
        ariaLabel="Lightning checkout"
      >
        <div className="relative flex-1 overflow-y-auto px-6 pb-8 pt-3 min-h-0">
          <div className="sticky top-0 z-10 -mx-6 flex justify-end bg-slate-950/95 px-6 pt-2 pb-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/60 text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              aria-label="Close checkout"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
          <div className="space-y-6 pt-4">
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
          </div>
        </div>
      </Modal>
    </>
  );
}

export { describeInvoiceStatus, type InvoiceFlowState } from "./hooks";
