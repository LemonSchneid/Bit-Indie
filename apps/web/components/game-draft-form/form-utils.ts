import { type GameCategory, type GameDraft, type CreateGameDraftRequest, type UpdateGameDraftRequest } from "../../lib/api";

export type GameDraftFormValues = {
  title: string;
  slug: string;
  summary: string;
  description_md: string;
  price_msats: string;
  cover_url: string;
  trailer_url: string;
  category: GameCategory;
  build_object_key: string;
  build_size_bytes: string;
  checksum_sha256: string;
};

export function createInitialValues(): GameDraftFormValues {
  return {
    title: "",
    slug: "",
    summary: "",
    description_md: "",
    price_msats: "",
    cover_url: "",
    trailer_url: "",
    category: "PROTOTYPE",
    build_object_key: "",
    build_size_bytes: "",
    checksum_sha256: "",
  };
}

export function normalizeOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function parseOptionalNonNegativeInteger(value: string, fieldName: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return Math.trunc(numeric);
}

export function normalizeChecksum(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.toLowerCase();
}

export function buildCreatePayload(values: GameDraftFormValues, userId: string): CreateGameDraftRequest {
  return {
    user_id: userId,
    title: values.title.trim(),
    slug: values.slug.trim(),
    summary: normalizeOrNull(values.summary),
    description_md: normalizeOrNull(values.description_md),
    price_msats: parseOptionalNonNegativeInteger(values.price_msats, "Price"),
    cover_url: normalizeOrNull(values.cover_url),
    trailer_url: normalizeOrNull(values.trailer_url),
    category: values.category,
  };
}

export function buildUpdatePayload(values: GameDraftFormValues, userId: string): UpdateGameDraftRequest {
  return {
    ...buildCreatePayload(values, userId),
    build_object_key: normalizeOrNull(values.build_object_key),
    build_size_bytes: parseOptionalNonNegativeInteger(values.build_size_bytes, "Build size"),
    checksum_sha256: normalizeChecksum(values.checksum_sha256),
  };
}

export function mapDraftToValues(draft: GameDraft): GameDraftFormValues {
  return {
    title: draft.title,
    slug: draft.slug,
    summary: draft.summary ?? "",
    description_md: draft.description_md ?? "",
    price_msats: draft.price_msats != null ? String(draft.price_msats) : "",
    cover_url: draft.cover_url ?? "",
    trailer_url: draft.trailer_url ?? "",
    category: draft.category,
    build_object_key: draft.build_object_key ?? "",
    build_size_bytes: draft.build_size_bytes != null ? String(draft.build_size_bytes) : "",
    checksum_sha256: draft.checksum_sha256 ?? "",
  };
}
