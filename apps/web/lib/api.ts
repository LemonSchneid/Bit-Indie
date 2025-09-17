const DEFAULT_API_BASE_URL = "http://localhost:8080";

const configuredBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.API_URL?.trim() ||
  DEFAULT_API_BASE_URL;

const apiBaseUrl = configuredBaseUrl.replace(/\/$/, "");

export interface HealthResponse {
  status: string;
}

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
  reputation_score: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginSuccessResponse {
  user: UserProfile;
}

function buildApiUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`API paths must start with a forward slash. Received: ${path}`);
  }

  return `${apiBaseUrl}${path}`;
}

export async function getApiHealth(): Promise<HealthResponse> {
  const response = await fetch(buildApiUrl("/health"), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as HealthResponse;

  return payload;
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
