import assert from "node:assert/strict";
import test from "node:test";

import { optionalSessionToken, resolveSessionToken } from "./session";
import * as userStorage from "../user-storage";

function withMockedToken<T>(token: string | null, action: () => T): T {
  const originalLoader = userStorage.loadStoredSessionToken;
  (userStorage as unknown as { loadStoredSessionToken: () => string | null }).loadStoredSessionToken = () => token;
  try {
    return action();
  } finally {
    (userStorage as unknown as { loadStoredSessionToken: () => string | null }).loadStoredSessionToken = originalLoader;
  }
}

test("session token helpers", async (t) => {
  await t.test("resolveSessionToken returns the provided token when available", () => {
    const token = withMockedToken("stored-token", () =>
      resolveSessionToken("explicit-token", "Sign in first."),
    );
    assert.equal(token, "explicit-token");
  });

  await t.test("resolveSessionToken falls back to the stored token", () => {
    const token = withMockedToken("stored-token", () =>
      resolveSessionToken(null, "Sign in first."),
    );
    assert.equal(token, "stored-token");
  });

  await t.test("resolveSessionToken throws when no token exists", () => {
    assert.throws(
      () =>
        withMockedToken(null, () => {
          resolveSessionToken(undefined, "Sign in first.");
        }),
      /Sign in first\./,
    );
  });

  await t.test("optionalSessionToken returns the provided token", () => {
    const token = withMockedToken("stored-token", () =>
      optionalSessionToken("explicit-token"),
    );
    assert.equal(token, "explicit-token");
  });

  await t.test("optionalSessionToken returns the stored token when missing", () => {
    const token = withMockedToken("stored-token", () => optionalSessionToken(null));
    assert.equal(token, "stored-token");
  });

  await t.test("optionalSessionToken yields null when no token is present", () => {
    const token = withMockedToken(null, () => optionalSessionToken(undefined));
    assert.equal(token, null);
  });
});
