"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type AdminIntegrityStats,
  type UserProfile,
  getAdminIntegrityStats,
} from "../api";
import {
  USER_PROFILE_STORAGE_EVENT,
  loadStoredUserProfile,
} from "../user-storage";

export type AdminIntegrityLoadState = "idle" | "loading" | "success" | "error";

export type AdminIntegrityMetricsState = {
  profile: UserProfile | null;
  stats: AdminIntegrityStats | null;
  loadState: AdminIntegrityLoadState;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Hook that manages profile changes and fetches admin integrity metrics on demand.
 */
export function useAdminIntegrityMetrics(): AdminIntegrityMetricsState {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadStoredUserProfile());
  const [stats, setStats] = useState<AdminIntegrityStats | null>(null);
  const [loadState, setLoadState] = useState<AdminIntegrityLoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleProfileChange(): void {
      setProfile(loadStoredUserProfile());
    }

    window.addEventListener(USER_PROFILE_STORAGE_EVENT, handleProfileChange);
    return () => window.removeEventListener(USER_PROFILE_STORAGE_EVENT, handleProfileChange);
  }, []);

  useEffect(() => {
    if (!profile || !profile.is_admin) {
      setStats(null);
      setLoadState("idle");
      setError(null);
    }
  }, [profile]);

  const refresh = useCallback(async () => {
    if (!profile || !profile.is_admin) {
      return;
    }

    setLoadState("loading");
    setError(null);
    try {
      const payload = await getAdminIntegrityStats(profile.id);
      setStats(payload);
      setLoadState("success");
    } catch (cause) {
      setLoadState("error");
      if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unable to load integrity metrics.");
      }
    }
  }, [profile]);

  useEffect(() => {
    if (profile && profile.is_admin) {
      void refresh();
    }
  }, [profile, refresh]);

  return {
    profile,
    stats,
    loadState,
    error,
    refresh,
  };
}
