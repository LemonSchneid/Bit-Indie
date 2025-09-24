import type { UserProfile } from "./api/auth";

export const USER_PROFILE_STORAGE_KEY = "proof-of-play:user-profile";
export const USER_PROFILE_STORAGE_EVENT = "proof-of-play:user-profile-changed";

type StoredUserState = {
  profile: UserProfile;
  session_token: string | null;
};

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
    (candidate.nip05 === null || typeof candidate.nip05 === "string") &&
    (candidate.lightning_address === null || typeof candidate.lightning_address === "string");

  return hasValidStrings && hasValidFlags && hasOptionalFields;
}

function isStoredUserState(value: unknown): value is StoredUserState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredUserState>;
  return (
    isUserProfile(candidate.profile) &&
    (candidate.session_token === null || typeof candidate.session_token === "string")
  );
}

function parseStoredState(raw: string): StoredUserState | null {
  try {
    const value = JSON.parse(raw);
    if (isStoredUserState(value)) {
      return value;
    }
    if (isUserProfile(value)) {
      return { profile: value, session_token: null };
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

  const state = parseStoredState(raw);
  return state ? state.profile : null;
}

export function loadStoredSessionToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const state = parseStoredState(raw);
  return state ? state.session_token : null;
}

export function saveUserProfile(profile: UserProfile): void {
  const token = loadStoredSessionToken();
  saveUserSession(profile, token);
}

export function saveUserSession(profile: UserProfile, sessionToken: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const state: StoredUserState = { profile, session_token: sessionToken };
    window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(state));
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
