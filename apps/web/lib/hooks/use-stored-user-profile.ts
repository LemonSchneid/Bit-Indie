"use client";

import { useCallback, useEffect } from "react";

import type { UserProfile } from "../api";
import { useQuery, useQueryClient } from "../react-query";
import {
  USER_PROFILE_STORAGE_EVENT,
  USER_PROFILE_STORAGE_KEY,
  loadStoredUserProfile,
} from "../user-storage";
import { USER_PROFILE_QUERY_KEY } from "../user-session";

/**
 * Synchronizes the persisted user profile across browser tabs and windows.
 */
export function useStoredUserProfile(): UserProfile | null {
  const queryClient = useQueryClient();
  const isClient = typeof window !== "undefined";
  const readProfileFromStorage = useCallback(() => loadStoredUserProfile(), []);
  const { data } = useQuery<UserProfile | null>({
    queryKey: USER_PROFILE_QUERY_KEY,
    queryFn: isClient ? readProfileFromStorage : undefined,
    initialData: () => null,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refreshProfile = () => {
      const profile = loadStoredUserProfile();
      queryClient.setQueryData(USER_PROFILE_QUERY_KEY, profile);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === USER_PROFILE_STORAGE_KEY) {
        refreshProfile();
      }
    };

    window.addEventListener(
      USER_PROFILE_STORAGE_EVENT,
      refreshProfile as EventListener,
    );
    window.addEventListener("storage", handleStorage);

    refreshProfile();

    return () => {
      window.removeEventListener(
        USER_PROFILE_STORAGE_EVENT,
        refreshProfile as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [queryClient]);

  return data ?? null;
}
