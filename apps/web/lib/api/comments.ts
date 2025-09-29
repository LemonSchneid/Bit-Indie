import { requestJson } from "./core";

export type CommentSource = "FIRST_PARTY" | "NOSTR";

export interface GameCommentAuthor {
  user_id: string | null;
  pubkey_hex: string | null;
  npub: string | null;
  display_name: string | null;
  lightning_address: string | null;
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

export async function getGameComments(gameId: string): Promise<GameComment[]> {
  const normalizedId = gameId.trim();
  if (!normalizedId) {
    throw new Error("Game ID is required to load comments.");
  }

  return requestJson<GameComment[]>(`/v1/games/${encodeURIComponent(normalizedId)}/comments`, {
    cache: "no-store",
    errorMessage: "Unable to load comments right now.",
    notFoundMessage: "Comments are not available for this game.",
  });
}
