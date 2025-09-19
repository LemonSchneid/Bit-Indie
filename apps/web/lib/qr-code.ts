/**
 * Build a QR code URL for the provided value. We rely on the third-party
 * generator directly so the browser can request the image without hitting the
 * service's CORS restrictions.
 */
export function buildQrCodeUrl(value: string, size = 220): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("A value is required to generate a QR code.");
  }

  const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
  qrUrl.searchParams.set("size", `${size}x${size}`);
  qrUrl.searchParams.set("data", trimmed);

  return qrUrl.toString();
}
