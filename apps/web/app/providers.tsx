"use client";

import { useEffect, useState, type PropsWithChildren } from "react";

import { QueryClient, QueryClientProvider } from "../lib/react-query";
import {
  USER_PROFILE_STORAGE_EVENT,
  USER_PROFILE_STORAGE_KEY,
} from "../lib/user-storage";
import { primeUserProfileCache } from "../lib/user-session";

export function ClientProviders({ children }: PropsWithChildren): JSX.Element {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const synchronizeProfile = () => {
      primeUserProfileCache(queryClient);
    };

    synchronizeProfile();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === USER_PROFILE_STORAGE_KEY) {
        synchronizeProfile();
      }
    };

    window.addEventListener(
      USER_PROFILE_STORAGE_EVENT,
      synchronizeProfile as EventListener,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        USER_PROFILE_STORAGE_EVENT,
        synchronizeProfile as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
