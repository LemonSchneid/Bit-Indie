"use client";

const ANON_ID_STORAGE_KEY = "proof-of-play:anon-id";

function generateAnonId(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // RFC4122 v4-like UUID formatting
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
      .slice(8, 10)
      .join("")}-${hex.slice(10, 16).join("")}`;
  } catch {
    // Fallback if crypto unavailable
    return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getOrCreateAnonId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const existing = window.localStorage.getItem(ANON_ID_STORAGE_KEY);
  if (existing) return existing;
  const created = generateAnonId();
  try {
    window.localStorage.setItem(ANON_ID_STORAGE_KEY, created);
  } catch {}
  return created;
}

