/**
 * Formatting helpers shared across the storefront.
 */
export type FormatPriceOptions = {
  /**
   * Label to use when the price is null (free download).
   * @default "Free download"
   */
  freeLabel?: string;
};

/**
 * Format a milli-satoshi price into a localized Lightning label.
 */
export function formatPriceMsats(value: number | null, options: FormatPriceOptions = {}): string {
  const { freeLabel = "Free download" } = options;

  if (value === null) {
    return freeLabel;
  }

  const sats = value / 1000;
  const formatted = Number(sats).toLocaleString("en-US", { maximumFractionDigits: 3 });
  return `${formatted} sats`;
}

/**
 * Format a game category into human-readable casing.
 */
export function formatCategory(category: string): string {
  switch (category) {
    case "PROTOTYPE":
      return "Prototype";
    case "EARLY_ACCESS":
      return "Early Access";
    case "FINISHED":
      return "Finished";
    default: {
      return category
        .split("_")
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
        .join(" ");
    }
  }
}

/**
 * Format a listing status label.
 */
export function formatStatus(status: string): string {
  switch (status) {
    case "UNLISTED":
      return "Unlisted preview";
    case "DISCOVER":
      return "Discover";
    case "FEATURED":
      return "Featured";
    default:
      return status;
  }
}

export type FormatDateOptions = {
  /**
   * Value returned when the timestamp is missing or invalid.
   * @default "Recently updated"
   */
  fallback?: string;
  /** Optional override for `Intl.DateTimeFormat`. */
  formatOptions?: Intl.DateTimeFormatOptions;
  /** Optional locale forwarded to `toLocaleDateString`. */
  locale?: string | string[];
};

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

/**
 * Format an ISO timestamp into a localized date label.
 */
export function formatDateLabel(timestamp: string | null | undefined, options: FormatDateOptions = {}): string {
  const { fallback = "Recently updated", formatOptions = DEFAULT_DATE_OPTIONS, locale } = options;

  if (!timestamp) {
    return fallback;
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  const resolvedOptions: Intl.DateTimeFormatOptions = {
    timeZone: "UTC",
    ...formatOptions,
  };

  return new Intl.DateTimeFormat(locale, resolvedOptions).format(parsed);
}

export type FormatZapOptions = {
  /**
   * Label to use when no zaps have been recorded.
   * @default "0 sats"
   */
  zeroLabel?: string;
};

/**
 * Format a milli-satoshi zap total for display.
 */
export function formatZapAmount(msats: number, options: FormatZapOptions = {}): string {
  const { zeroLabel = "0 sats" } = options;

  if (!Number.isFinite(msats) || msats <= 0) {
    return zeroLabel;
  }

  const sats = msats / 1000;
  const formatted = Number(sats).toLocaleString("en-US", { maximumFractionDigits: 3 });
  return `${formatted} sats`;
}
