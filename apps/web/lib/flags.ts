// Runtime feature flags for the web app (browser-safe).
// Read from NEXT_PUBLIC_* env vars only.

function parseBooleanEnv(value: string | undefined | null, fallback = false): boolean {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

export const nostrEnabled = parseBooleanEnv(process.env.NEXT_PUBLIC_NOSTR_ENABLED, false);

