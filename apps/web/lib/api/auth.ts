import { buildApiUrl } from "./core";

export interface LoginChallengeResponse {
  challenge: string;
  issued_at: string;
  expires_at: string;
}

export interface SignedEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface UserProfile {
  id: string;
  pubkey_hex: string;
  display_name: string | null;
  nip05: string | null;
  lightning_address: string | null;
  reputation_score: number;
  is_admin: boolean;
  is_developer: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginSuccessResponse {
  user: UserProfile;
}

export async function requestLoginChallenge(): Promise<LoginChallengeResponse> {
  const response = await fetch(buildApiUrl("/v1/auth/challenge"), {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Login challenge request failed with status ${response.status}.`);
  }

  return (await response.json()) as LoginChallengeResponse;
}

export async function verifyLoginEvent(event: SignedEvent): Promise<LoginSuccessResponse> {
  const response = await fetch(buildApiUrl("/v1/auth/verify"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ event }),
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => (body?.detail as string | undefined) ?? "Login verification failed.")
      .catch(() => "Login verification failed.");
    throw new Error(message);
  }

  return (await response.json()) as LoginSuccessResponse;
}
