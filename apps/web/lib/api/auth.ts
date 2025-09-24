import { requestJson } from "./core";

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
  session_token: string;
}

export async function requestLoginChallenge(): Promise<LoginChallengeResponse> {
  return requestJson<LoginChallengeResponse>("/v1/auth/challenge", {
    method: "POST",
    errorMessage: "Login challenge request failed.",
  });
}

export async function verifyLoginEvent(event: SignedEvent): Promise<LoginSuccessResponse> {
  return requestJson<LoginSuccessResponse>("/v1/auth/verify", {
    method: "POST",
    body: JSON.stringify({ event }),
    errorMessage: "Login verification failed.",
  });
}
