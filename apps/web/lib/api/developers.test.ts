import assert from "node:assert/strict";
import test from "node:test";

import {
  becomeDeveloper,
  getDeveloperProfile,
  updateDeveloperProfile,
  type DeveloperProfile,
} from "./developers";
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

test("developer API client", async (t) => {
  const profile: DeveloperProfile = {
    id: "dev-1",
    user_id: "user-1",
    verified_dev: false,
    profile_url: "https://studio.example.com",
    contact_email: "studio@example.com",
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  };

  await t.test("getDeveloperProfile fetches the profile with credentials", async () => {
    await withMockedToken("session-token", async () => {
      await withMockedFetch(async (input, init) => {
        assert.equal(input, "http://localhost:8080/v1/devs/user-1");
        assert.equal(init?.method, "GET");
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("Authorization"), "Bearer session-token");
        assert.equal(headers.get("Accept"), "application/json");
        return new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }, async () => {
        const result = await getDeveloperProfile("user-1");
        assert.equal(result.id, profile.id);
        assert.equal(result.contact_email, profile.contact_email);
      });
    });
  });

  await t.test("updateDeveloperProfile posts payload to the API", async () => {
    await withMockedToken("session-token", async () => {
      await withMockedFetch(async (input, init) => {
        assert.equal(input, "http://localhost:8080/v1/devs");
        assert.equal(init?.method, "POST");
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("Authorization"), "Bearer session-token");
        assert.equal(headers.get("Content-Type"), "application/json");
        assert.equal(
          init?.body,
          JSON.stringify({
            user_id: "user-1",
            profile_url: "https://studio.example.com",
            contact_email: "studio@example.com",
          }),
        );
        return new Response(JSON.stringify(profile), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }, async () => {
        const result = await updateDeveloperProfile("user-1", {
          profile_url: "https://studio.example.com",
          contact_email: "studio@example.com",
        });
        assert.equal(result.user_id, profile.user_id);
      });
    });
  });

  await t.test("becomeDeveloper delegates to updateDeveloperProfile", async () => {
    await withMockedToken("session-token", async () => {
      let called = false;
      await withMockedFetch(async (input, init) => {
        called = true;
        return new Response(JSON.stringify(profile), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }, async () => {
        const result = await becomeDeveloper({ user_id: "user-1" });
        assert.equal(result.id, profile.id);
      });
      assert.equal(called, true);
    });
  });

  await t.test("developer profile helpers require a session token", async () => {
    await assert.rejects(
      () =>
        withMockedToken(null, async () => {
          await getDeveloperProfile("user-1");
        }),
      /Sign in before managing your developer profile\./,
    );
  });
});
