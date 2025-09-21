export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatSats(value: number | null): string {
  if (value === null) {
    return "FREE";
  }

  return `${value.toLocaleString()} SATS`;
}

export function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}

export function formatZapAmount(msats: number): string {
  if (!Number.isFinite(msats) || msats <= 0) {
    return "0 sats";
  }

  const sats = msats / 1000;
  if (Number.isInteger(sats)) {
    return `${Number(sats).toLocaleString()} sats`;
  }

  return `${Number(sats).toLocaleString(undefined, { maximumFractionDigits: 3 })} sats`;
}
