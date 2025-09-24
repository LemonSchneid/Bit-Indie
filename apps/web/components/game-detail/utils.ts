import { type GameComment } from "../../lib/api";

export function formatNpub(value: string | null): string {
  if (!value) {
    return "npub unknown";
  }

  const trimmed = value.trim();
  if (trimmed.length <= 16) {
    return trimmed;
  }

  return `${trimmed.slice(0, 10)}…${trimmed.slice(-6)}`;
}

export function formatPubkeyHex(value: string | null): string {
  if (!value) {
    return "unknown";
  }

  const trimmed = value.trim();
  if (trimmed.length <= 12) {
    return trimmed;
  }

  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

export function getDescriptionParagraphs(description: string | null): string[] {
  if (!description) {
    return [];
  }

  return splitIntoParagraphs(description);
}

export function getReviewParagraphs(body: string): string[] {
  return splitIntoParagraphs(body);
}

export function getCommentParagraphs(body: string): string[] {
  return splitIntoParagraphs(body);
}

export function getCommentAuthorLabel(comment: GameComment): string {
  const displayName = comment.author.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const npubLabel = comment.author.npub;
  if (npubLabel) {
    return formatNpub(npubLabel);
  }

  return formatPubkeyHex(comment.author.pubkey_hex);
}

function splitIntoParagraphs(body: string): string[] {
  return body
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}
