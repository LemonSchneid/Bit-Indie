const GUEST_USER_STORAGE_PREFIX = "bit-indie:guest-user:";

function buildKey(anonId: string): string {
  return `${GUEST_USER_STORAGE_PREFIX}${anonId}`;
}

export function loadGuestUserId(anonId: string | null | undefined): string | null {
  if (typeof window === "undefined" || !anonId) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(buildKey(anonId));
    return stored && stored.trim() ? stored : null;
  } catch (error) {
    return null;
  }
}

export function saveGuestUserId(anonId: string, userId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(buildKey(anonId), userId);
  } catch (error) {
    // Ignore persistence issues; the caller still receives the user id in memory.
  }
}

export function clearGuestUserId(anonId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(buildKey(anonId));
  } catch (error) {
    // Ignore persistence issues.
  }
}
