import type { UserProfile } from "./api";

export const USER_PROFILE_STORAGE_KEY = "proof-of-play:user-profile";
export const USER_PROFILE_STORAGE_EVENT = "proof-of-play:user-profile-changed";

function isUserProfile(value: unknown): value is UserProfile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UserProfile;
  const hasValidStrings =
    typeof candidate.id === "string" &&
    typeof candidate.pubkey_hex === "string" &&
    typeof candidate.created_at === "string" &&
    typeof candidate.updated_at === "string";
  const hasValidFlags =
    typeof candidate.is_admin === "boolean" &&
    typeof candidate.is_developer === "boolean" &&
    typeof candidate.reputation_score === "number";
  const hasOptionalFields =
    (candidate.display_name === null || typeof candidate.display_name === "string") &&
    (candidate.nip05 === null || typeof candidate.nip05 === "string");

  return hasValidStrings && hasValidFlags && hasOptionalFields;
}

function parseStoredProfile(raw: string): UserProfile | null {
  try {
    const value = JSON.parse(raw);
    if (isUserProfile(value)) {
      return value;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export function loadStoredUserProfile(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  return parseStoredProfile(raw);
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    return;
  }

  window.dispatchEvent(new CustomEvent(USER_PROFILE_STORAGE_EVENT));
}

export function clearStoredUserProfile(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(USER_PROFILE_STORAGE_EVENT));
}
