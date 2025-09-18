import * as Sentry from "@sentry/nextjs";

function parseSampleRate(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, parsed));
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      "development",
    tracesSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ||
        process.env.SENTRY_TRACES_SAMPLE_RATE,
      0,
    ),
    profilesSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE ||
        process.env.SENTRY_PROFILES_SAMPLE_RATE,
      0,
    ),
  });
}

