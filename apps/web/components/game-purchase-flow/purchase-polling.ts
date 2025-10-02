import { type PurchaseRecord } from "../../lib/api";
import { type InvoiceFlowState } from "./types";

export type PurchasePollingHandlers = {
  handlePurchaseUpdate(latest: PurchaseRecord): void;
  handleInvoiceExpired(): void;
  handlePollingError(message: string): void;
};

export type PurchasePollingDependencies = {
  onPurchaseUpdate: (purchase: PurchaseRecord) => void;
  onFlowStateChange: (state: InvoiceFlowState) => void;
  onErrorMessage: (message: string | null) => void;
};

const EXPIRED_MESSAGE =
  "The Lightning invoice is no longer payable. Generate a new invoice to try again.";

export function createPurchasePollingHandlers(
  dependencies: PurchasePollingDependencies,
): PurchasePollingHandlers {
  const { onPurchaseUpdate, onFlowStateChange, onErrorMessage } = dependencies;

  return {
    handlePurchaseUpdate(latest: PurchaseRecord) {
      onPurchaseUpdate(latest);
      onErrorMessage(null);

      if (latest.download_granted) {
        onFlowStateChange("paid");
      }
    },
    handleInvoiceExpired() {
      onFlowStateChange("expired");
      onErrorMessage(EXPIRED_MESSAGE);
    },
    handlePollingError(message: string) {
      onErrorMessage(message);
    },
  };
}
