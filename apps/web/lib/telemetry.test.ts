import assert from "node:assert/strict";
import test from "node:test";

import * as Sentry from "@sentry/nextjs";

import { captureWebException, recordLandingDataLoadFailure } from "./telemetry";

type FakeScopeRecord = {
  extras: Record<string, unknown>;
  tags: Record<string, string>;
  level?: string;
};

class FakeScope {
  public record: FakeScopeRecord = { extras: {}, tags: {} };

  setExtra(key: string, value: unknown): void {
    this.record.extras[key] = value;
  }

  setTag(key: string, value: string): void {
    this.record.tags[key] = value;
  }

  setLevel(level: string): void {
    this.record.level = level;
  }
}

type MutableSentry = {
  withScope: (callback: (scope: Sentry.Scope) => void) => void;
  captureException: (error: unknown) => unknown;
};

test("captureWebException annotates Sentry scope", () => {
  const mutableSentry = Sentry as unknown as MutableSentry;
  const originalWithScope = mutableSentry.withScope;
  const originalCaptureException = mutableSentry.captureException;

  const fakeScope = new FakeScope();
  let capturedError: Error | undefined;

  mutableSentry.withScope = (callback) => {
    callback(fakeScope as unknown as Sentry.Scope);
  };

  mutableSentry.captureException = (error) => {
    capturedError = error as Error;
    return "capture-id";
  };

  try {
    captureWebException("failure", { feature: "test", attempt: 2 });
  } finally {
    mutableSentry.withScope = originalWithScope;
    mutableSentry.captureException = originalCaptureException;
  }

  assert.ok(capturedError);
  assert.equal(capturedError?.message, "failure");
  assert.equal(fakeScope.record.tags.surface, "web");
  assert.equal(fakeScope.record.level, "error");
  assert.equal(fakeScope.record.extras.feature, "test");
  assert.equal(fakeScope.record.extras.attempt, 2);
});

test("recordLandingDataLoadFailure enriches telemetry", () => {
  const mutableSentry = Sentry as unknown as MutableSentry;
  const originalWithScope = mutableSentry.withScope;
  const originalCaptureException = mutableSentry.captureException;

  const fakeScope = new FakeScope();
  let capturedError: Error | undefined;

  mutableSentry.withScope = (callback) => {
    callback(fakeScope as unknown as Sentry.Scope);
  };

  mutableSentry.captureException = (error) => {
    capturedError = error as Error;
    return "capture-id";
  };

  try {
    recordLandingDataLoadFailure("catalog", new Error("catalog failed"), { requestId: "req-123" });
  } finally {
    mutableSentry.withScope = originalWithScope;
    mutableSentry.captureException = originalCaptureException;
  }

  assert.ok(capturedError);
  assert.equal(capturedError?.message, "catalog failed");
  assert.equal(fakeScope.record.tags.surface, "web");
  assert.equal(fakeScope.record.extras.feature, "landing");
  assert.equal(fakeScope.record.extras.dataset, "catalog");
  assert.equal(fakeScope.record.extras.origin, "home-page-loader");
  assert.equal(fakeScope.record.extras.requestId, "req-123");
});
