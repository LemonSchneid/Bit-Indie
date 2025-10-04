import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { GameCommentsSection } from "./comments-section";
import { type GameComment } from "../../lib/api";

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
        account_identifier: null,
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
