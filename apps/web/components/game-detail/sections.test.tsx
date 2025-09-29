import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { GameCommentsSection } from "./comments-section";
import { GameReviewsSection } from "./reviews-section";
import { type GameComment, type GameReview } from "../../lib/api";

test("comments section renders verified purchase badges", () => {
  const comments: GameComment[] = [
    {
      id: "comment-1",
      game_id: "game-1",
      body_md: "Loved the latest build!",
      created_at: "2024-02-20T00:00:00.000Z",
      source: "FIRST_PARTY",
      author: {
        user_id: "user-1",
        pubkey_hex: null,
        npub: null,
        display_name: "Player One",
        lightning_address: null,
      },
      is_verified_purchase: true,
    },
  ];

  const html = renderToStaticMarkup(
    <GameCommentsSection gameTitle="Example Game" comments={comments} commentsError={null} />,
  );

  assert.match(html, /Player One/);
  assert.match(html, /Verified Purchase/);
  assert.match(html, /Bit Indie/);
});

test("comments section fallback highlights empty threads", () => {
  const html = renderToStaticMarkup(
    <GameCommentsSection gameTitle="Example Game" comments={[]} commentsError={null} />,
  );

  assert.match(html, /No comments yet/);
});

test("reviews section renders rating and verified badge", () => {
  const reviews: GameReview[] = [
    {
      id: "review-1",
      game_id: "game-1",
      user_id: "user-1",
      title: "Incredible mechanics",
      body_md: "Had a blast exploring the first dungeon.",
      rating: 5,
      helpful_score: 0,
      is_verified_purchase: true,
      created_at: "2024-02-19T00:00:00.000Z",
      author: {
        id: "user-1",
        pubkey_hex: "abc123",
        display_name: "Reviewer One",
        lightning_address: null,
      },
    },
  ];

  const html = renderToStaticMarkup(
    <GameReviewsSection gameTitle="Example Game" reviews={reviews} reviewsError={null} />,
  );

  assert.match(html, /Incredible mechanics/);
  assert.match(html, /5\/5/);
  assert.match(html, /Verified Purchase/);
  assert.match(html, /Player feedback/);
});
