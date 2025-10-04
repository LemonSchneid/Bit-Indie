import { type GameComment } from "../../lib/api";

export function formatAccountIdentifier(value: string | null): string {
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

export function getCommentParagraphs(body: string): string[] {
  return splitIntoParagraphs(body);
}

export function getCommentAuthorLabel(comment: GameComment): string {
  const displayName = comment.author.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  return formatAccountIdentifier(comment.author.account_identifier);
}

function splitIntoParagraphs(body: string): string[] {
  return body
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}
