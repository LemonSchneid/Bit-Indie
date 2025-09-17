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
  is_developer: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginSuccessResponse {
  user: UserProfile;
}

export interface DeveloperProfile {
  id: string;
  user_id: string;
  verified_dev: boolean;
  profile_url: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface BecomeDeveloperRequest {
  user_id: string;
  profile_url?: string | null;
  contact_email?: string | null;
}

export type GameCategory = "PROTOTYPE" | "EARLY_ACCESS" | "FINISHED";

export interface GameDraft {
  id: string;
  developer_id: string;
  status: "UNLISTED" | "DISCOVER" | "FEATURED";
  title: string;
  slug: string;
  summary: string | null;
  description_md: string | null;
  price_msats: number | null;
  cover_url: string | null;
  trailer_url: string | null;
  category: GameCategory;
  build_object_key: string | null;
  build_size_bytes: number | null;
  checksum_sha256: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGameDraftRequest {
  user_id: string;
  title: string;
  slug: string;
  summary?: string | null;
  description_md?: string | null;
  price_msats?: number | null;
  cover_url?: string | null;
  trailer_url?: string | null;
  category?: GameCategory;
}

export interface UpdateGameDraftRequest {
  user_id: string;
  title?: string | null;
  slug?: string | null;
  summary?: string | null;
  description_md?: string | null;
  price_msats?: number | null;
  cover_url?: string | null;
  trailer_url?: string | null;
  category?: GameCategory;
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

export async function becomeDeveloper(payload: BecomeDeveloperRequest): Promise<DeveloperProfile> {
  const response = await fetch(buildApiUrl("/v1/devs"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => (body?.detail as string | undefined) ?? "Unable to create developer profile.")
      .catch(() => "Unable to create developer profile.");
    throw new Error(message);
  }

  return (await response.json()) as DeveloperProfile;
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (typeof item?.msg === "string") {
            return item.msg;
          }
          return null;
        })
        .filter((value): value is string => Boolean(value));
      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
    return fallback;
  } catch (error) {
    return fallback;
  }
}

export async function createGameDraft(payload: CreateGameDraftRequest): Promise<GameDraft> {
  const response = await fetch(buildApiUrl("/v1/games"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to create game draft.");
    throw new Error(message);
  }

  return (await response.json()) as GameDraft;
}

export async function updateGameDraft(gameId: string, payload: UpdateGameDraftRequest): Promise<GameDraft> {
  const response = await fetch(buildApiUrl(`/v1/games/${gameId}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to update game draft.");
    throw new Error(message);
  }

  return (await response.json()) as GameDraft;
}
