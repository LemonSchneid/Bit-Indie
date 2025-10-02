/** Format a ratio (0-1) into a percentage string. */
export function formatIntegrityPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }
  const clamped = Math.max(0, Math.min(value, 1));
  return `${(clamped * 100).toFixed(1)}%`;
}

/** Format a number of hours with a single decimal place. */
export function formatIntegrityHours(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Format milli-satoshis alongside their satoshi equivalent.
 */
export function formatIntegrityMsats(value: number): string {
  const msats = Math.max(0, value);
  const sats = msats / 1000;
  const formattedMsats = msats.toLocaleString("en-US");
  const formattedSats = sats.toLocaleString("en-US", {
    minimumFractionDigits: sats > 0 && sats < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${formattedMsats} msats (${formattedSats} sats)`;
}

/** Format counts with standard thousands separators. */
export function formatIntegrityCount(value: number): string {
  return Math.max(0, value).toLocaleString("en-US");
}
