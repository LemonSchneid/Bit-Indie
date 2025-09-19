import { requestJson } from "./core";

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
  return requestJson<GameDraft>("/v1/games", {
    method: "POST",
    body: JSON.stringify(payload),
    errorMessage: "Unable to create game draft.",
  });
}

export async function updateGameDraft(
  gameId: string,
  payload: UpdateGameDraftRequest,
): Promise<GameDraft> {
  return requestJson<GameDraft>(`/v1/games/${encodeURIComponent(gameId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    errorMessage: "Unable to update game draft.",
  });
}

export async function getGamePublishChecklist(
  gameId: string,
  userId: string,
): Promise<GamePublishChecklist> {
  const query = new URLSearchParams({ user_id: userId });
  return requestJson<GamePublishChecklist>(
    `/v1/games/${encodeURIComponent(gameId)}/publish-checklist?${query.toString()}`,
    {
      cache: "no-store",
      notFoundMessage: "Game not found.",
      forbiddenMessage: "You do not have permission to view this checklist.",
      errorMessage: "Unable to load publish checklist.",
    },
  );
}

export async function publishGame(
  gameId: string,
  payload: PublishGameRequest,
): Promise<GameDraft> {
  return requestJson<GameDraft>(`/v1/games/${encodeURIComponent(gameId)}/publish`, {
    method: "POST",
    body: JSON.stringify(payload),
    notFoundMessage: "Game not found.",
    forbiddenMessage: "You do not have permission to publish this game.",
    errorMessage: "Unable to publish game.",
  });
}

export async function getGameBySlug(slug: string): Promise<GameDraft> {
  const normalized = slug.trim();
  if (!normalized) {
    throw new Error("Slug is required.");
  }

  return requestJson<GameDraft>(`/v1/games/slug/${encodeURIComponent(normalized)}`, {
    cache: "no-store",
    notFoundMessage: "Game not found.",
    errorMessage: "Unable to load game.",
  });
}

export async function getFeaturedGames(limit?: number): Promise<FeaturedGameSummary[]> {
  const params = new URLSearchParams();
  if (typeof limit === "number" && Number.isFinite(limit)) {
    const bounded = Math.max(1, Math.min(12, Math.trunc(limit)));
    params.set("limit", String(bounded));
  }

  const path = params.size > 0 ? `/v1/games/featured?${params.toString()}` : "/v1/games/featured";

  return requestJson<FeaturedGameSummary[]>(path, {
    cache: "no-store",
    errorMessage: "Unable to load featured games right now.",
  });
}
