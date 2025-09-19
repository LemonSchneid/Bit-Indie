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
  developer_lightning_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameReview {
  id: string;
  game_id: string;
  user_id: string;
  title: string | null;
  body_md: string;
  rating: number | null;
  helpful_score: number;
  total_zap_msats: number;
  is_verified_purchase: boolean;
  created_at: string;
  author: GameReviewAuthor;
}

export interface GameReviewAuthor {
  id: string;
  pubkey_hex: string;
  display_name: string | null;
  lightning_address: string | null;
}

export type CommentSource = "FIRST_PARTY" | "NOSTR";

export interface GameCommentAuthor {
  user_id: string | null;
  pubkey_hex: string | null;
  npub: string | null;
  display_name: string | null;
}

export interface GameComment {
  id: string;
  game_id: string;
  body_md: string;
  created_at: string;
  source: CommentSource;
  author: GameCommentAuthor;
  is_verified_purchase: boolean;
}

export interface FeaturedGameSummary {
  game: GameDraft;
  verified_review_count: number;
  paid_purchase_count: number;
  refunded_purchase_count: number;
  refund_rate: number;
  updated_within_window: boolean;
}

export type InvoiceStatus = "PENDING" | "PAID" | "EXPIRED" | "REFUNDED";
export type RefundStatus = "NONE" | "REQUESTED" | "APPROVED" | "DENIED" | "PAID";

export interface InvoiceCreateRequest {
  user_id: string;
}

export interface InvoiceCreateResponse {
  purchase_id: string;
  invoice_id: string;
  payment_request: string;
  amount_msats: number;
  invoice_status: InvoiceStatus;
  check_url: string;
}

export interface PurchaseRecord {
  id: string;
  user_id: string;
  game_id: string;
  invoice_id: string;
  invoice_status: InvoiceStatus;
  amount_msats: number | null;
  paid_at: string | null;
  download_granted: boolean;
  refund_requested: boolean;
  refund_status: RefundStatus;
  created_at: string;
  updated_at: string;
}

export interface PurchaseReceiptGame {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  price_msats: number | null;
  build_available: boolean;
}

export interface PurchaseReceiptBuyer {
  id: string;
  pubkey_hex: string;
  display_name: string | null;
}

export interface PurchaseReceipt {
  purchase: PurchaseRecord;
  game: PurchaseReceiptGame;
  buyer: PurchaseReceiptBuyer;
}

export type ModerationTargetType = "GAME" | "COMMENT" | "REVIEW";
export type ModerationFlagReason = "SPAM" | "TOS" | "DMCA" | "MALWARE";
export type ModerationFlagStatus = "OPEN" | "DISMISSED" | "ACTIONED";

export interface ModerationReporter {
  id: string;
  pubkey_hex: string;
  display_name: string | null;
}

export interface ModerationFlaggedGame {
  id: string;
  title: string;
  slug: string;
  status: "UNLISTED" | "DISCOVER" | "FEATURED";
  active: boolean;
}

export interface ModerationFlaggedComment {
  id: string;
  game_id: string;
  user_id: string;
  body_md: string;
  created_at: string;
  is_hidden: boolean;
}

export interface ModerationFlaggedReview {
  id: string;
  game_id: string;
  user_id: string;
  title: string | null;
  body_md: string;
  rating: number | null;
  helpful_score: number;
  total_zap_msats: number;
  created_at: string;
  is_hidden: boolean;
}

export interface ModerationQueueItem {
  id: string;
  target_type: ModerationTargetType;
  target_id: string;
  reason: ModerationFlagReason;
  status: ModerationFlagStatus;
  created_at: string;
  reporter: ModerationReporter;
  game: ModerationFlaggedGame | null;
  comment: ModerationFlaggedComment | null;
  review: ModerationFlaggedReview | null;
}

export interface ModerationTakedownRequestPayload {
  user_id: string;
  target_type: ModerationTargetType;
  target_id: string;
}

export interface ModerationActionResponse {
  target_type: ModerationTargetType;
  target_id: string;
  applied_status: ModerationFlagStatus;
  affected_flag_ids: string[];
}

export interface AdminIntegrityStats {
  refund_rate: number;
  refunded_purchase_count: number;
  paid_purchase_count: number;
  total_refund_payout_msats: number;
  takedown_rate: number;
  actioned_flag_count: number;
  dismissed_flag_count: number;
  open_flag_count: number;
  total_flag_count: number;
  handled_flag_count: number;
  estimated_moderation_hours: number;
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

export async function publishGame(gameId: string, payload: PublishGameRequest): Promise<GameDraft> {
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

export async function getGameReviews(gameId: string): Promise<GameReview[]> {
  const normalizedId = gameId.trim();
  if (!normalizedId) {
    throw new Error("Game ID is required to load reviews.");
  }

  const response = await fetch(
    buildApiUrl(`/v1/games/${encodeURIComponent(normalizedId)}/reviews`),
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    throw new Error("Reviews are not available for this game.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load reviews.");
    throw new Error(message);
  }

  return (await response.json()) as GameReview[];
}

export async function getGameComments(gameId: string): Promise<GameComment[]> {
  const normalizedId = gameId.trim();
  if (!normalizedId) {
    throw new Error("Game ID is required to load comments.");
  }

  const response = await fetch(
    buildApiUrl(`/v1/games/${encodeURIComponent(normalizedId)}/comments`),
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    throw new Error("Comments are not available for this game.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load comments right now.");
    throw new Error(message);
  }

  return (await response.json()) as GameComment[];
}

export async function createGameInvoice(
  gameId: string,
  payload: InvoiceCreateRequest,
): Promise<InvoiceCreateResponse> {
  const normalizedId = gameId.trim();
  if (!normalizedId) {
    throw new Error("Game ID is required to create an invoice.");
  }

  const response = await fetch(
    buildApiUrl(`/v1/games/${encodeURIComponent(normalizedId)}/invoice`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to create Lightning invoice.");
    throw new Error(message);
  }

  return (await response.json()) as InvoiceCreateResponse;
}

export async function getLatestPurchaseForGame(
  gameId: string,
  userId: string,
): Promise<PurchaseRecord | null> {
  const normalizedGameId = gameId.trim();
  if (!normalizedGameId) {
    throw new Error("Game ID is required to look up purchases.");
  }

  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("User ID is required to look up purchases.");
  }

  const url = new URL(buildApiUrl("/v1/purchases/lookup"));
  url.searchParams.set("game_id", normalizedGameId);
  url.searchParams.set("user_id", normalizedUserId);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load purchase status.");
    throw new Error(message);
  }

  return (await response.json()) as PurchaseRecord;
}

export async function getPurchase(purchaseId: string): Promise<PurchaseRecord> {
  const normalizedId = purchaseId.trim();
  if (!normalizedId) {
    throw new Error("Purchase ID is required.");
  }

  const response = await fetch(
    buildApiUrl(`/v1/purchases/${encodeURIComponent(normalizedId)}`),
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    throw new Error("Purchase not found.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load purchase status.");
    throw new Error(message);
  }

  return (await response.json()) as PurchaseRecord;
}

export async function getPurchaseReceipt(purchaseId: string): Promise<PurchaseReceipt> {
  const normalizedId = purchaseId.trim();
  if (!normalizedId) {
    throw new Error("Purchase ID is required.");
  }

  const response = await fetch(
    buildApiUrl(`/v1/purchases/${encodeURIComponent(normalizedId)}/receipt`),
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    throw new Error("Purchase not found.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load purchase receipt.");
    throw new Error(message);
  }

  return (await response.json()) as PurchaseReceipt;
}

export function getGameDownloadUrl(gameId: string): string {
  const normalizedId = gameId.trim();
  if (!normalizedId) {
    throw new Error("Game ID is required.");
  }

  return buildApiUrl(`/v1/games/${encodeURIComponent(normalizedId)}/download`);
}

export async function getModerationQueue(userId: string): Promise<ModerationQueueItem[]> {
  const normalizedId = userId.trim();
  if (!normalizedId) {
    throw new Error("Admin user ID is required to load the moderation queue.");
  }

  const query = new URLSearchParams({ user_id: normalizedId });
  const response = await fetch(buildApiUrl(`/v1/admin/mod/queue?${query.toString()}`), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 403) {
    throw new Error("Administrator privileges are required to view the moderation queue.");
  }

  if (response.status === 404) {
    throw new Error("Admin user not found.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load moderation queue.");
    throw new Error(message);
  }

  return (await response.json()) as ModerationQueueItem[];
}

export async function executeModerationTakedown(
  payload: ModerationTakedownRequestPayload,
): Promise<ModerationActionResponse> {
  const response = await fetch(buildApiUrl("/v1/admin/mod/takedown"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 403) {
    throw new Error("Administrator privileges are required to apply this action.");
  }

  if (response.status === 404) {
    const message = await parseErrorMessage(response, "Flagged content was not found.");
    throw new Error(message);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to apply moderation action.");
    throw new Error(message);
  }

  return (await response.json()) as ModerationActionResponse;
}

export async function getAdminIntegrityStats(userId: string): Promise<AdminIntegrityStats> {
  const normalizedId = userId.trim();
  if (!normalizedId) {
    throw new Error("Admin user ID is required to load integrity metrics.");
  }

  const query = new URLSearchParams({ user_id: normalizedId });
  const response = await fetch(buildApiUrl(`/v1/admin/stats?${query.toString()}`), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 403) {
    throw new Error("Administrator privileges are required to view integrity metrics.");
  }

  if (response.status === 404) {
    throw new Error("Admin user not found.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load integrity metrics.");
    throw new Error(message);
  }

  return (await response.json()) as AdminIntegrityStats;
}
