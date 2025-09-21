"use client";

import { PropsWithChildren, useEffect } from "react";

export function ClientProviders({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_API_MOCKS !== "true") {
      return;
    }

    void import("../mocks/browser").then(({ startMockWorker }) => {
      void startMockWorker();
    });
  }, []);

  return <>{children}</>;
}
