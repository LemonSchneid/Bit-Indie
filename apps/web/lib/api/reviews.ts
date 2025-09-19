import { buildApiUrl, parseErrorMessage } from "./core";

export interface GameReviewAuthor {
  id: string;
  pubkey_hex: string;
  display_name: string | null;
  lightning_address: string | null;
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
