import * as Sentry from "@sentry/nextjs";

export type TelemetryContext = Record<string, unknown>;

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown error");
}

export function captureWebException(error: unknown, context: TelemetryContext = {}): void {
  const normalizedError = normalizeError(error);

  Sentry.withScope((scope) => {
    scope.setTag("surface", "web");
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    scope.setLevel("error");
    Sentry.captureException(normalizedError);
  });
}

export function recordLandingDataLoadFailure(
  dataset: "catalog" | "featured",
  error: unknown,
  extraContext: TelemetryContext = {},
): void {
  captureWebException(error, {
    feature: "landing",
    dataset,
    origin: "home-page-loader",
    ...extraContext,
  });
}
