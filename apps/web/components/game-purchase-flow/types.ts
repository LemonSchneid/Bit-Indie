export type InvoiceFlowState =
  | "idle"
  | "creating"
  | "polling"
  | "paid"
  | "expired"
  | "error";

export type CopyState = "idle" | "copied" | "error";
