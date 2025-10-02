export async function computeSha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();

  if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
    throw new Error("Secure hashing is not available in this environment.");
  }

  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
