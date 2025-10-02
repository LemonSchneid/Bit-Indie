import { buildApiUrl, parseErrorMessage, requireTrimmedValue } from "./core";

export type ModerationTargetType = "GAME" | "COMMENT" | "REVIEW";
export type ModerationFlagReason = "SPAM" | "TOS" | "DMCA" | "MALWARE";
export type ModerationFlagStatus = "OPEN" | "DISMISSED" | "ACTIONED";

export interface ModerationReporter {
  id: string;
  account_identifier: string;
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

export interface HiddenModerationItem {
  target_type: ModerationTargetType;
  target_id: string;
  created_at: string;
  game: ModerationFlaggedGame;
  comment: ModerationFlaggedComment | null;
  review: ModerationFlaggedReview | null;
}

export interface ModerationRestoreRequestPayload {
  user_id: string;
  target_type: Extract<ModerationTargetType, "COMMENT" | "REVIEW">;
  target_id: string;
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

export async function getModerationQueue(userId: string): Promise<ModerationQueueItem[]> {
  const normalizedId = requireTrimmedValue(
    userId,
    "Admin user ID is required to load the moderation queue.",
  );

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

export async function getHiddenModerationItems(userId: string): Promise<HiddenModerationItem[]> {
  const normalizedId = requireTrimmedValue(
    userId,
    "Admin user ID is required to load hidden content.",
  );

  const query = new URLSearchParams({ user_id: normalizedId });
  const response = await fetch(buildApiUrl(`/v1/admin/mod/hidden?${query.toString()}`), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 403) {
    throw new Error("Administrator privileges are required to view hidden content.");
  }

  if (response.status === 404) {
    throw new Error("Admin user not found.");
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load hidden content.");
    throw new Error(message);
  }

  return (await response.json()) as HiddenModerationItem[];
}

export async function restoreModerationTarget(
  payload: ModerationRestoreRequestPayload,
): Promise<ModerationActionResponse> {
  const response = await fetch(buildApiUrl("/v1/admin/mod/restore"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 403) {
    throw new Error("Administrator privileges are required to restore content.");
  }

  if (response.status === 404) {
    const message = await parseErrorMessage(response, "Hidden content was not found.");
    throw new Error(message);
  }

  if (response.status === 400) {
    const message = await parseErrorMessage(response, "Unsupported restoration target.");
    throw new Error(message);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to restore moderated content.");
    throw new Error(message);
  }

  return (await response.json()) as ModerationActionResponse;
}

export async function getAdminIntegrityStats(userId: string): Promise<AdminIntegrityStats> {
  const normalizedId = requireTrimmedValue(
    userId,
    "Admin user ID is required to load integrity metrics.",
  );

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
