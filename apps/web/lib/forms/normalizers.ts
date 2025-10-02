export type IntegerBounds = {
  min?: number;
  max?: number;
};

/**
 * Normalize user-supplied text by trimming whitespace and converting blanks to null.
 */
export function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parse an optional integer and clamp it against optional bounds.
 */
export function parseOptionalInteger(
  value: string,
  fieldName: string,
  bounds: IntegerBounds = {},
): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  const integer = Math.trunc(numeric);
  if (bounds.min != null && integer < bounds.min) {
    throw new Error(`${fieldName} must be at least ${bounds.min}.`);
  }
  if (bounds.max != null && integer > bounds.max) {
    throw new Error(`${fieldName} must be at most ${bounds.max}.`);
  }

  return integer;
}

/**
 * Normalize optional checksum/hash inputs to lowercase.
 */
export function normalizeToLowercaseOrNull(value: string): string | null {
  const trimmed = trimToNull(value);
  return trimmed ? trimmed.toLowerCase() : null;
}
