/**
 * Build a QR code data URL for the provided value. The generator currently
 * proxies through the same API the image tag relied upon before but wraps the
 * response in a data URL so we can control caching behaviour inside the app.
 */
export async function generateQrCodeDataUrl(value: string, size = 220): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("A value is required to generate a QR code.");
  }

  const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
  qrUrl.searchParams.set("size", `${size}x${size}`);
  qrUrl.searchParams.set("data", trimmed);

  const response = await fetch(qrUrl.toString(), {
    headers: {
      Accept: "image/png",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to generate QR code (status ${response.status}).`);
  }

  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("Failed to read QR code response."));
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Unexpected QR code payload format."));
      }
    };
    reader.readAsDataURL(blob);
  });
}
