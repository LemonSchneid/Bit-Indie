import {
  lookupLatestPurchase,
  type PurchaseLookupRequest,
  type PurchaseRecord,
} from "../../lib/api";
import { getOrCreateAnonId } from "../../lib/anon-id";

type PurchaseLookupOptions = {
  gameId: string;
  userId?: string | null;
  signal?: AbortSignal;
};

type PurchaseLookupResult = {
  purchase: PurchaseRecord;
  downloadUnlocked: boolean;
};

type PurchaseLookupDependencies = {
  lookupPurchase: typeof lookupLatestPurchase;
  resolveAnonId: typeof getOrCreateAnonId;
  now: () => number;
  missingTtlMs: number;
};

const MISSING_LOOKUP_TTL_MS = 5000;
const missingLookupCache = new Map<string, number>();

const defaultDependencies: PurchaseLookupDependencies = {
  lookupPurchase: lookupLatestPurchase,
  resolveAnonId: getOrCreateAnonId,
  now: () => Date.now(),
  missingTtlMs: MISSING_LOOKUP_TTL_MS,
};

function buildCacheKey(gameId: string, identifier: string, kind: "user" | "anon"): string {
  return `${gameId.trim()}:${kind}:${identifier}`;
}

function shouldSkipLookup(cacheKey: string, now: number): boolean {
  const expiry = missingLookupCache.get(cacheKey);
  return Boolean(expiry && expiry > now);
}

function rememberMissing(cacheKey: string, expiresAt: number): void {
  missingLookupCache.set(cacheKey, expiresAt);
}

function clearMissing(cacheKey: string): void {
  missingLookupCache.delete(cacheKey);
}

export function resetPurchaseLookupCache(): void {
  missingLookupCache.clear();
}

export async function lookupLatestPurchaseForUser(
  {
    gameId,
    userId,
    signal,
  }: PurchaseLookupOptions,
  dependencies: Partial<PurchaseLookupDependencies> = {},
): Promise<PurchaseLookupResult | null> {
  const deps: PurchaseLookupDependencies = { ...defaultDependencies, ...dependencies };

  const normalizedUserId = userId?.trim() ?? "";
  const identifierKind: "user" | "anon" = normalizedUserId ? "user" : "anon";
  const identifier = normalizedUserId || deps.resolveAnonId();

  if (!identifier) {
    return null;
  }

  const cacheKey = buildCacheKey(gameId, identifier, identifierKind);
  const now = deps.now();
  if (shouldSkipLookup(cacheKey, now)) {
    return null;
  }

  const request: PurchaseLookupRequest = {
    gameId,
    signal,
    userId: identifierKind === "user" ? identifier : undefined,
    anonId: identifierKind === "anon" ? identifier : undefined,
  };

  try {
    const latest = await deps.lookupPurchase(request);
    if (signal?.aborted || !latest) {
      rememberMissing(cacheKey, now + deps.missingTtlMs);
      return null;
    }

    clearMissing(cacheKey);
    const downloadUnlocked = latest.download_granted === true || latest.invoice_status === "PAID";
    return { purchase: latest, downloadUnlocked };
  } catch (_error) {
    if (signal?.aborted) {
      return null;
    }
    rememberMissing(cacheKey, now + deps.missingTtlMs);
    return null;
  }
}
