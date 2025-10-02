import {
  type GameCategory,
  type GameDraft,
  type CreateGameDraftRequest,
  type UpdateGameDraftRequest,
} from "../../lib/api";
import {
  normalizeToLowercaseOrNull,
  parseOptionalInteger,
  trimToNull,
} from "../../lib/forms/normalizers";

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

export function buildCreatePayload(values: GameDraftFormValues, userId: string): CreateGameDraftRequest {
  return {
    user_id: userId,
    title: values.title.trim(),
    slug: values.slug.trim(),
    summary: trimToNull(values.summary),
    description_md: trimToNull(values.description_md),
    price_msats: parseOptionalInteger(values.price_msats, "Price", { min: 0 }),
    cover_url: trimToNull(values.cover_url),
    trailer_url: trimToNull(values.trailer_url),
    category: values.category,
  };
}

export function buildUpdatePayload(values: GameDraftFormValues, userId: string): UpdateGameDraftRequest {
  return {
    ...buildCreatePayload(values, userId),
    build_object_key: trimToNull(values.build_object_key),
    build_size_bytes: parseOptionalInteger(values.build_size_bytes, "Build size", { min: 0 }),
    checksum_sha256: normalizeToLowercaseOrNull(values.checksum_sha256),
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
