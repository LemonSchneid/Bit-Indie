import assert from "node:assert/strict";
import test from "node:test";

import { type GameComment, getGameComments } from "./comments";

async function withMockedFetch<T>(implementation: typeof fetch, action: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("getGameComments", async (t) => {
  await t.test("requires a game ID", async () => {
    await assert.rejects(() => getGameComments("  \t\n  "), {
      message: "Game ID is required to load comments.",
    });
  });

  await t.test("fetches comments with standardized request settings", async () => {
    const responseComments: GameComment[] = [
      {
        id: "comment-1",
        game_id: "game-123",
        body_md: "Great game!",
        created_at: "2024-05-01T12:00:00Z",
        source: "FIRST_PARTY",
      author: {
        user_id: "user-1",
        pubkey_hex: "abc123",
        npub: "npub123",
        display_name: "Alice",
        lightning_address: "alice@example.com",
      },
      is_verified_purchase: true,
    },
  ];

    const comments = await withMockedFetch(async (input, init) => {
      assert.equal(input, "http://localhost:8080/v1/games/game-123/comments");
      assert.equal(init?.cache, "no-store");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Accept"), "application/json");

      return new Response(JSON.stringify(responseComments), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }, () => getGameComments("  game-123  "));

    assert.deepEqual(comments, responseComments);
  });

  await t.test("reports when comments are not available", async () => {
    await assert.rejects(
      withMockedFetch(async () => new Response(null, { status: 404 }), () => getGameComments("game-404")),
      {
        message: "Comments are not available for this game.",
      },
    );
  });

  await t.test("includes API error detail when available", async () => {
    await assert.rejects(
      withMockedFetch(
        async () =>
          new Response(JSON.stringify({ detail: "Upstream failure" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
        () => getGameComments("game-500"),
      ),
      {
        message: "Upstream failure",
      },
    );
  });
});
