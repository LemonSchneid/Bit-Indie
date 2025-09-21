import { setupWorker } from "msw";

import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

export async function startMockWorker(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (!navigator.serviceWorker) {
    console.warn("[msw] Service workers are not supported in this environment.");
    return;
  }

  await worker.start({ onUnhandledRequest: "bypass" });
}
