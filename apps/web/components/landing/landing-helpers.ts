import type { FeaturedGameSummary, GameDraft } from "../../lib/api/games";
import { formatCategory, formatDateLabel, formatPriceMsats } from "../../lib/format";

import {
  FALLBACK_CHECKLIST,
  FALLBACK_DISCOVER,
  FALLBACK_FEATURED,
  FALLBACK_INVOICE,
  FALLBACK_LIVE_METRICS,
  FALLBACK_RECEIPT,
  FALLBACK_REVIEWS,
} from "./landing-fallbacks";
import type {
  DeveloperChecklistItem,
  DiscoverCard,
  FeaturedCard,
  InvoiceSnapshot,
  LiveMetrics,
  ReceiptSnapshot,
  ReviewHighlight,
} from "./landing-types";

export function formatSatsFromMsats(msats: number | null): string {
  if (msats === null) {
    return "FREE";
  }

  const sats = Math.round(msats / 1000);
  return `${sats.toLocaleString("en-US")} SATS`;
}

export function uppercaseLabel(value: string): string {
  return value.toUpperCase();
}

export function buildFeaturedCards(
  summaries: FeaturedGameSummary[],
  fallbackSummary: GameDraft[],
): FeaturedCard[] {
  const cards = summaries.map((summary) => ({
    id: summary.game.id,
    title: summary.game.title,
    categoryLabel: uppercaseLabel(summary.game.category ?? ""),
    priceLabel: formatSatsFromMsats(summary.game.price_msats ?? null),
    updatedLabel: `Updated ${formatDateLabel(summary.game.updated_at, { fallback: "Recently updated" })}`,
    summary: summary.game.summary ?? "Lightning-powered indie world built on first-party community feedback.",
    href: summary.game.slug ? `/games/${summary.game.slug}` : FALLBACK_FEATURED[0].href,
  }));

  if (cards.length > 0) {
    return cards;
  }

  if (fallbackSummary.length > 0) {
    return fallbackSummary.slice(0, 3).map((game) => ({
      id: game.id,
      title: game.title,
      categoryLabel: uppercaseLabel(game.category ?? ""),
      priceLabel: formatSatsFromMsats(game.price_msats ?? null),
      updatedLabel: `Updated ${formatDateLabel(game.updated_at, { fallback: "Recently updated" })}`,
      summary: game.summary ?? "Lightning-powered indie world built on first-party community feedback.",
      href: game.slug ? `/games/${game.slug}` : FALLBACK_FEATURED[0].href,
    }));
  }

  return FALLBACK_FEATURED;
}

export function buildDiscoverCards(
  games: GameDraft[],
  summaryMap: Map<string, FeaturedGameSummary>,
): DiscoverCard[] {
  if (games.length === 0) {
    return FALLBACK_DISCOVER;
  }

  return games.slice(0, 6).map((game) => {
    const summary = summaryMap.get(game.id);
    const reviewCount = summary?.verified_review_count ?? 0;
    const purchases = summary?.paid_purchase_count ?? 0;
    const statusIntent = game.status === "FEATURED" ? "magenta" : "emerald";

    return {
      id: game.id,
      title: game.title,
      developerLabel:
        game.developer_lightning_address?.split("@")[1] ?? game.developer_lightning_address ?? "Lightning developer",
      statusLabel: uppercaseLabel(game.status ?? "DISCOVER"),
      categoryLabel: uppercaseLabel(formatCategory(game.category ?? "")),
      priceLabel: formatSatsFromMsats(game.price_msats ?? null),
      reviewCountLabel: `${reviewCount.toLocaleString("en-US")} reviews`,
      purchaseCountLabel: `${purchases.toLocaleString("en-US")} paid`,
      statusIntent,
      href: game.slug ? `/games/${game.slug}` : "#",
    };
  });
}

export function buildLiveMetrics(primarySummary: FeaturedGameSummary | undefined): LiveMetrics {
  if (!primarySummary) {
    return FALLBACK_LIVE_METRICS;
  }

  return {
    apiLatency: "132 ms",
    uptime: "99.99%",
    invoicesToday: Math.max(primarySummary.paid_purchase_count, 1),
    downloadsToday: Math.max(primarySummary.paid_purchase_count * 3, 3),
    firstPartyComments: Math.max(primarySummary.verified_review_count, 1) * 3,
    verifiedReviews: Math.max(primarySummary.verified_review_count, 1),
  };
}

export function buildDescriptionFromMarkdown(markdown?: string | null): string[] {
  if (!markdown) {
    return [
      "Sync loadouts to your identity so achievements follow your account across every build.",
      "Weekly events rotate tracks, enforce anti-sybil checkpoints, and surface first-party highlights.",
    ];
  }

  return markdown
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function buildReviewHighlights(gameTitle: string): ReviewHighlight[] {
  return FALLBACK_REVIEWS.map((review) => ({
    ...review,
    summary: review.summary.replace("Neon Drift Syndicate", gameTitle),
  }));
}

export function buildChecklist(summary?: FeaturedGameSummary): DeveloperChecklistItem[] {
  if (!summary) {
    return FALLBACK_CHECKLIST;
  }

  const hasPrice = summary.game.price_msats !== null;
  const hasSummary = Boolean(summary.game.summary);
  const hasBuild = Boolean(summary.game.build_object_key);
  const hasLightningAddress = Boolean(summary.game.developer_lightning_address);

  return [
    { title: "Upload build & checksum", complete: hasBuild },
    { title: "Attach Lightning address", complete: hasLightningAddress },
    { title: "Provide game summary", complete: hasSummary },
    { title: "Enable verified purchase reviews", complete: summary.verified_review_count > 0 },
    { title: "Set price or free label", complete: hasPrice },
  ];
}

export function buildInvoice(game: GameDraft | undefined): InvoiceSnapshot {
  if (!game) {
    return FALLBACK_INVOICE;
  }

  const priceLabel = formatPriceMsats(game.price_msats, { freeLabel: "Free download" }).toUpperCase();
  const lightningAddress = game.developer_lightning_address ?? FALLBACK_INVOICE.lightningAddress;

  return {
    gameTitle: game.title,
    amountLabel: priceLabel,
    lightningAddress,
    invoiceBolt11: FALLBACK_INVOICE.invoiceBolt11,
    expiresInLabel: FALLBACK_INVOICE.expiresInLabel,
  };
}

export function buildReceipt(game: GameDraft | undefined, invoice: InvoiceSnapshot): ReceiptSnapshot {
  if (!game) {
    return FALLBACK_RECEIPT;
  }

  return {
    status: "Settled",
    amountLabel: invoice.amountLabel,
    orderId: `${game.slug?.toUpperCase() || "POP"}-20240314-8842`,
    buyerAccountId: FALLBACK_RECEIPT.buyerAccountId,
    nextStepLabel: FALLBACK_RECEIPT.nextStepLabel,
  };
}
