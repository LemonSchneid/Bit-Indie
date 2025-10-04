import { requestJson, requireTrimmedValue } from "./core";
import { resolveSessionToken } from "./session";

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
  hero_url: string | null;
  receipt_thumbnail_url: string | null;
  trailer_url: string | null;
  category: GameCategory;
  build_object_key: string | null;
  build_size_bytes: number | null;
  checksum_sha256: string | null;
  build_scan_status: "NOT_SCANNED" | "PENDING" | "CLEAN" | "INFECTED" | "FAILED";
  build_scan_message: string | null;
  build_scanned_at: string | null;
  active: boolean;
  developer_lightning_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeaturedGameSummary {
  game: GameDraft;
  verified_comment_count: number;
  paid_purchase_count: number;
  refunded_purchase_count: number;
  refund_rate: number;
  updated_within_window: boolean;
}

export type PublishRequirementCode =
  | "SUMMARY"
  | "DESCRIPTION"
  | "COVER_IMAGE"
  | "HERO_IMAGE"
  | "RECEIPT_THUMBNAIL"
  | "BUILD_UPLOAD";

export interface GamePublishRequirement {
  code: PublishRequirementCode;
  message: string;
}

export interface GamePublishChecklist {
  is_publish_ready: boolean;
  missing_requirements: GamePublishRequirement[];
}

export type GameAssetKind = "cover" | "hero" | "receipt" | "build";

export interface GameAssetUploadRequest {
  user_id: string;
  filename: string;
  content_type?: string | null;
  max_bytes?: number | null;
}

export interface GameAssetUploadResponse {
  upload_url: string;
  fields: Record<string, string>;
  object_key: string;
  public_url: string;
}

export interface CreateGameDraftRequest {
  user_id: string;
  title: string;
  slug: string;
  summary?: string | null;
  description_md?: string | null;
  price_msats?: number | null;
  cover_url?: string | null;
  hero_url?: string | null;
  receipt_thumbnail_url?: string | null;
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
  hero_url?: string | null;
  receipt_thumbnail_url?: string | null;
  trailer_url?: string | null;
  category?: GameCategory;
  build_object_key?: string | null;
  build_size_bytes?: number | null;
  checksum_sha256?: string | null;
}

export interface PublishGameRequest {
  user_id: string;
}

export async function createGameDraft(
  payload: CreateGameDraftRequest,
  sessionToken?: string | null,
): Promise<GameDraft> {
  const token = resolveSessionToken(
    sessionToken,
    "Sign in to continue with developer actions.",
  );

  return requestJson<GameDraft>("/v1/games", {
    method: "POST",
    body: JSON.stringify(payload),
    errorMessage: "Unable to create game draft.",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateGameDraft(
  gameId: string,
  payload: UpdateGameDraftRequest,
  sessionToken?: string | null,
): Promise<GameDraft> {
  const token = resolveSessionToken(
    sessionToken,
    "Sign in to continue with developer actions.",
  );

  return requestJson<GameDraft>(`/v1/games/${encodeURIComponent(gameId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    errorMessage: "Unable to update game draft.",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getGamePublishChecklist(
  gameId: string,
  userId: string,
  sessionToken?: string | null,
): Promise<GamePublishChecklist> {
  const token = resolveSessionToken(
    sessionToken,
    "Sign in to continue with developer actions.",
  );
  const query = new URLSearchParams({ user_id: userId });
  return requestJson<GamePublishChecklist>(
    `/v1/games/${encodeURIComponent(gameId)}/publish-checklist?${query.toString()}`,
    {
      cache: "no-store",
      notFoundMessage: "Game not found.",
      forbiddenMessage: "You do not have permission to view this checklist.",
      errorMessage: "Unable to load publish checklist.",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function publishGame(
  gameId: string,
  payload: PublishGameRequest,
  sessionToken?: string | null,
): Promise<GameDraft> {
  const token = resolveSessionToken(
    sessionToken,
    "Sign in to continue with developer actions.",
  );
  return requestJson<GameDraft>(`/v1/games/${encodeURIComponent(gameId)}/publish`, {
    method: "POST",
    body: JSON.stringify(payload),
    notFoundMessage: "Game not found.",
    forbiddenMessage: "You do not have permission to publish this game.",
    errorMessage: "Unable to publish game.",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createGameAssetUpload(
  gameId: string,
  asset: GameAssetKind,
  payload: GameAssetUploadRequest,
  sessionToken?: string | null,
): Promise<GameAssetUploadResponse> {
  const token = resolveSessionToken(
    sessionToken,
    "Sign in to continue with developer actions.",
  );
  return requestJson<GameAssetUploadResponse>(
    `/v1/games/${encodeURIComponent(gameId)}/uploads/${asset}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      errorMessage: "Unable to generate upload credentials.",
      forbiddenMessage: "You do not have permission to upload assets for this game.",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function getGameBySlug(slug: string): Promise<GameDraft> {
  const normalized = requireTrimmedValue(slug, "Slug is required.");

  return requestJson<GameDraft>(`/v1/games/slug/${encodeURIComponent(normalized)}`, {
    cache: "no-store",
    notFoundMessage: "Game not found.",
    errorMessage: "Unable to load game.",
  });
}

export async function listCatalogGames(): Promise<GameDraft[]> {
  return requestJson<GameDraft[]>("/v1/games", {
    cache: "no-store",
    errorMessage: "Unable to load the game catalog right now.",
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
