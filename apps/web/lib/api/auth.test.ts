import assert from "node:assert/strict";
import test from "node:test";

import {
  loginAccount,
  logoutAccount,
  refreshAccountSession,
  signUpAccount,
  type AccountSessionResponse,
} from "./auth";

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

test("auth API client", async (t) => {
  const sessionResponse: AccountSessionResponse = {
    user: {
      id: "user-1",
      account_identifier: "acct-sample",
      email: "player@example.com",
      display_name: "Player",
      lightning_address: null,
      reputation_score: 0,
      is_admin: false,
      is_developer: false,
      created_at: "2024-04-01T00:00:00Z",
      updated_at: "2024-04-01T00:00:00Z",
    },
    session_token: "token-123",
  };

  await t.test("signUpAccount posts credentials", async () => {
    await withMockedFetch(async (input, init) => {
      assert.equal(input, "http://localhost:8080/v1/auth/signup");
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({
        email: "player@example.com",
        password: "SecurePass1!",
        display_name: "Player",
      }));
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Accept"), "application/json");
      assert.equal(headers.get("Content-Type"), "application/json");
      return new Response(JSON.stringify(sessionResponse), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }, async () => {
      const result = await signUpAccount({
        email: "player@example.com",
        password: "SecurePass1!",
        display_name: "Player",
      });
      assert.equal(result.session_token, sessionResponse.session_token);
    });
  });

  await t.test("loginAccount posts credentials", async () => {
    await withMockedFetch(async (input, init) => {
      assert.equal(input, "http://localhost:8080/v1/auth/login");
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({
        email: "player@example.com",
        password: "SecurePass1!",
      }));
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Content-Type"), "application/json");
      return new Response(JSON.stringify(sessionResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }, async () => {
      const result = await loginAccount({
        email: "player@example.com",
        password: "SecurePass1!",
      });
      assert.equal(result.user.id, sessionResponse.user.id);
    });
  });

  await t.test("refreshAccountSession sends the session token", async () => {
    await withMockedFetch(async (input, init) => {
      assert.equal(input, "http://localhost:8080/v1/auth/refresh");
      assert.equal(init?.method, "POST");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Authorization"), "Bearer refresh-token");
      assert.equal(headers.get("Content-Type"), "application/json");
      return new Response(JSON.stringify(sessionResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }, async () => {
      const result = await refreshAccountSession("refresh-token");
      assert.equal(result.session_token, sessionResponse.session_token);
    });
  });

  await t.test("logoutAccount skips requests when token is absent", async () => {
    let called = false;
    await withMockedFetch(async () => {
      called = true;
      return new Response(null, { status: 204 });
    }, async () => {
      await logoutAccount(null);
    });
    assert.equal(called, false);
  });

  await t.test("logoutAccount posts to the logout endpoint", async () => {
    await withMockedFetch(async (input, init) => {
      assert.equal(input, "http://localhost:8080/v1/auth/logout");
      assert.equal(init?.method, "POST");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Authorization"), "Bearer logout-token");
      assert.equal(headers.get("Content-Type"), "application/json");
      return new Response(null, { status: 204 });
    }, async () => {
      await logoutAccount("logout-token");
    });
  });
});
