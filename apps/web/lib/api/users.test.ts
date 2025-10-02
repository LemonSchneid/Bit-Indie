import assert from "node:assert/strict";
import test from "node:test";

import { updateUserLightningAddress, type UserProfile } from "./users";
import * as userStorage from "../user-storage";

async function withMockedFetch<T>(
  implementation: typeof fetch,
  action: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withMockedToken<T>(token: string | null, action: () => Promise<T>): Promise<T> {
  const originalLoader = userStorage.loadStoredSessionToken;
  (userStorage as unknown as { loadStoredSessionToken: () => string | null }).loadStoredSessionToken = () => token;
  try {
    return await action();
  } finally {
    (userStorage as unknown as { loadStoredSessionToken: () => string | null }).loadStoredSessionToken = originalLoader;
  }
}

test("updateUserLightningAddress patches the Lightning address", async (t) => {
  const profile: UserProfile = {
    id: "user-42",
    account_identifier: "dev-42",
    email: null,
    display_name: null,
    lightning_address: "dev@wallet.example.com",
    reputation_score: 0,
    is_admin: true,
    is_developer: true,
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  };

  await t.test("it sends a PATCH request with credentials", async () => {
    await withMockedToken("session-token", async () => {
      await withMockedFetch(async (input, init) => {
        assert.equal(input, "http://localhost:8080/v1/users/user-42/lightning-address");
        assert.equal(init?.method, "PATCH");
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("Authorization"), "Bearer session-token");
        assert.equal(headers.get("Content-Type"), "application/json");
        assert.equal(
          init?.body,
          JSON.stringify({ lightning_address: "dev@wallet.example.com" }),
        );
        return new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }, async () => {
        const result = await updateUserLightningAddress("user-42", "dev@wallet.example.com");
        assert.equal(result.id, profile.id);
        assert.equal(result.lightning_address, profile.lightning_address);
      });
    });
  });

  await t.test("it requires a stored session token", async () => {
    await assert.rejects(
      () =>
        withMockedToken(null, async () => {
          await updateUserLightningAddress("user-42", "dev@wallet.example.com");
        }),
      /Sign in before updating your Lightning address\./,
    );
  });
});

