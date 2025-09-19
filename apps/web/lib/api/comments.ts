import { buildApiUrl, parseErrorMessage } from "./core";

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
