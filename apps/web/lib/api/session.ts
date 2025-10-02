import { loadStoredSessionToken } from "../user-storage";

/**
 * Resolve a session token by preferring an explicitly provided value and
 * falling back to the token saved in local storage.
 */
export function resolveSessionToken(
  providedToken: string | null | undefined,
  errorMessage: string,
): string {
  const token = providedToken ?? loadStoredSessionToken();

  if (!token) {
    throw new Error(errorMessage);
  }

  return token;
}

/**
 * Return the best available session token without throwing when none exists.
 */
export function optionalSessionToken(
  providedToken: string | null | undefined,
): string | null {
  return providedToken ?? loadStoredSessionToken();
}
