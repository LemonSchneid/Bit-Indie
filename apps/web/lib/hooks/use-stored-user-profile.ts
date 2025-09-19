"use client";

import { useEffect, useState } from "react";

import type { UserProfile } from "../api";
import {
  USER_PROFILE_STORAGE_EVENT,
  USER_PROFILE_STORAGE_KEY,
  loadStoredUserProfile,
} from "../user-storage";

/**
 * Synchronizes the persisted Nostr user profile across browser tabs and windows.
 */
export function useStoredUserProfile(): UserProfile | null {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadStoredUserProfile());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refreshProfile = () => {
      setProfile(loadStoredUserProfile());
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

    return () => {
      window.removeEventListener(
        USER_PROFILE_STORAGE_EVENT,
        refreshProfile as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return profile;
}
