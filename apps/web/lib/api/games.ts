import { buildApiUrl, parseErrorMessage } from "./core";

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
  developer_lightning_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeaturedGameSummary {
  game: GameDraft;
  verified_review_count: number;
  paid_purchase_count: number;
  refunded_purchase_count: number;
  refund_rate: number;
  updated_within_window: boolean;
}

export type PublishRequirementCode =
  | "SUMMARY"
  | "DESCRIPTION"
  | "COVER_IMAGE"
  | "BUILD_UPLOAD";

export interface GamePublishRequirement {
  code: PublishRequirementCode;
  message: string;
}

export interface GamePublishChecklist {
  is_publish_ready: boolean;
  missing_requirements: GamePublishRequirement[];
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

export interface PublishGameRequest {
  user_id: string;
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

export async function updateGameDraft(
  gameId: string,
  payload: UpdateGameDraftRequest,
): Promise<GameDraft> {
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

export async function getGamePublishChecklist(
  gameId: string,
  userId: string,
): Promise<GamePublishChecklist> {
  const query = new URLSearchParams({ user_id: userId });
  const response = await fetch(buildApiUrl(`/v1/games/${gameId}/publish-checklist?${query.toString()}`), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("Game not found.");
  }

  if (response.status === 403) {
    throw new Error("You do not have permission to view this checklist.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load publish checklist.");
    throw new Error(message);
  }

  return (await response.json()) as GamePublishChecklist;
}

export async function publishGame(
  gameId: string,
  payload: PublishGameRequest,
): Promise<GameDraft> {
  const response = await fetch(buildApiUrl(`/v1/games/${gameId}/publish`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 404) {
    throw new Error("Game not found.");
  }

  if (response.status === 403) {
    throw new Error("You do not have permission to publish this game.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to publish game.");
    throw new Error(message);
  }

  return (await response.json()) as GameDraft;
}

export async function getGameBySlug(slug: string): Promise<GameDraft> {
  const normalized = slug.trim();
  if (!normalized) {
    throw new Error("Slug is required.");
  }

  const response = await fetch(buildApiUrl(`/v1/games/slug/${encodeURIComponent(normalized)}`), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("Game not found.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load game.");
    throw new Error(message);
  }

  return (await response.json()) as GameDraft;
}

export async function getFeaturedGames(limit?: number): Promise<FeaturedGameSummary[]> {
  const params = new URLSearchParams();
  if (typeof limit === "number" && Number.isFinite(limit)) {
    const bounded = Math.max(1, Math.min(12, Math.trunc(limit)));
    params.set("limit", String(bounded));
  }

  const path = params.size > 0 ? `/v1/games/featured?${params.toString()}` : "/v1/games/featured";

  const response = await fetch(buildApiUrl(path), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await parseErrorMessage(
      response,
      "Unable to load featured games right now.",
    );
    throw new Error(message);
  }

  return (await response.json()) as FeaturedGameSummary[];
}
