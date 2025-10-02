import type { QueryClient } from "./react-query";
import type { UserProfile } from "./api";
import {
  clearStoredUserProfile,
  loadStoredUserProfile,
  saveUserSession,
} from "./user-storage";

export const USER_PROFILE_QUERY_KEY = ["user-profile"] as const;

export function primeUserProfileCache(queryClient: QueryClient): void {
  const profile = loadStoredUserProfile();
  if (profile === null) {
    queryClient.setQueryData(USER_PROFILE_QUERY_KEY, null);
    return;
  }
  queryClient.setQueryData(USER_PROFILE_QUERY_KEY, profile);
}

export function storeUserSession(
  queryClient: QueryClient,
  profile: UserProfile,
  sessionToken: string,
): void {
  saveUserSession(profile, sessionToken);
  queryClient.setQueryData(USER_PROFILE_QUERY_KEY, profile);
}

export function clearUserSession(queryClient: QueryClient): void {
  clearStoredUserProfile();
  queryClient.setQueryData(USER_PROFILE_QUERY_KEY, null);
}
