import { requestJson } from "./core";
import type { UserProfile } from "./users";
import { optionalSessionToken, resolveSessionToken } from "./session";

export interface AccountSessionResponse {
  user: UserProfile;
  session_token: string;
}

export interface AccountSignupRequest {
  email: string;
  password: string;
  display_name?: string | null;
}

export interface AccountLoginRequest {
  email: string;
  password: string;
}

export async function signUpAccount(request: AccountSignupRequest): Promise<AccountSessionResponse> {
  return requestJson<AccountSessionResponse>("/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(request),
    errorMessage: "Unable to create your account.",
  });
}

export async function loginAccount(request: AccountLoginRequest): Promise<AccountSessionResponse> {
  return requestJson<AccountSessionResponse>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(request),
    errorMessage: "Unable to sign you in.",
  });
}

export async function refreshAccountSession(
  sessionToken?: string | null,
): Promise<AccountSessionResponse> {
  const token = resolveSessionToken(
    sessionToken,
    "Sign in to refresh your session.",
  );

  return requestJson<AccountSessionResponse>("/v1/auth/refresh", {
    method: "POST",
    body: "{}",
    errorMessage: "Unable to refresh your session.",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function logoutAccount(sessionToken?: string | null): Promise<void> {
  const token = optionalSessionToken(sessionToken);
  if (!token) {
    return;
  }

  await requestJson("/v1/auth/logout", {
    method: "POST",
    body: "{}",
    errorMessage: "Unable to log you out.",
    headers: { Authorization: `Bearer ${token}` },
  });
}
