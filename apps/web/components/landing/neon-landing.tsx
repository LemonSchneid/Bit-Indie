"use client";

import { useMemo, useState } from "react";

import type { FeaturedGameSummary, GameDraft } from "../../lib/api/games";
import { formatCategory, formatDateLabel } from "../../lib/format";
import {
  FALLBACK_COMMENTS,
  FALLBACK_FEATURED,
  FALLBACK_INVOICE_STEPS,
} from "./landing-fallbacks";
import {
  buildChecklist,
  buildDescriptionFromMarkdown,
  buildDiscoverCards,
  buildFeaturedCards,
  buildInvoice,
  buildLiveMetrics,
  buildReceipt,
  buildReviewHighlights,
  formatSatsFromMsats,
  uppercaseLabel,
} from "./landing-helpers";
import { AccountAccessWidget } from "./sections/account-access-widget";
import { GameDetailScreen } from "./sections/game-detail-screen";
import { LightningCheckoutScreen } from "./sections/lightning-checkout-screen";
import { LoadFailureBanner } from "./sections/load-failure-banner";
import { ReceiptScreen } from "./sections/receipt-screen";
import { ScreenSwitcher } from "./sections/screen-switcher";
import { StorefrontScreen } from "./sections/storefront-screen";
import { MicroLabel } from "./sections/shared";

type NeonLandingProps = {
  catalogGames: GameDraft[];
  featuredSummaries: FeaturedGameSummary[];
  hadLoadFailure: boolean;
};

function selectPrimaryGame(
  featuredSummaries: FeaturedGameSummary[],
  catalogGames: GameDraft[],
): GameDraft | undefined {
  if (featuredSummaries.length > 0) {
    return featuredSummaries[0].game;
  }

  if (catalogGames.length > 0) {
    return catalogGames[0];
  }

  return undefined;
}

function buildSummaryMap(summaries: FeaturedGameSummary[]): Map<string, FeaturedGameSummary> {
  const map = new Map<string, FeaturedGameSummary>();
  for (const summary of summaries) {
    map.set(summary.game.id, summary);
  }
  return map;
}

function computeHeroMetrics(
  primaryGame: GameDraft | undefined,
  primarySummary: FeaturedGameSummary | undefined,
) {
  const developerLabel = primaryGame?.developer_lightning_address
    ? primaryGame.developer_lightning_address
    : "Lightning-ready developer";

  const categoryLabel = uppercaseLabel(formatCategory(primaryGame?.category ?? ""));
  const statusLabel = uppercaseLabel(primaryGame?.status ?? "DISCOVER");
  const versionLabel = `Updated ${formatDateLabel(primaryGame?.updated_at, { fallback: "Recently updated" })}`;
  const priceLabel = formatSatsFromMsats(primaryGame?.price_msats ?? null);
  const tipLabel = primarySummary
    ? `${Math.max(Math.round((primaryGame?.price_msats ?? 0) / 1000 / 4), 1).toLocaleString("en-US")} SATS`
    : "5,000 SATS";

  return {
    developerLabel,
    categoryLabel,
    statusLabel,
    versionLabel,
    priceLabel,
    tipLabel,
  };
}

export default function NeonLanding({ catalogGames, featuredSummaries, hadLoadFailure }: NeonLandingProps): JSX.Element {
  const [activeScreen, setActiveScreen] = useState<number>(1);

  const summaryMap = useMemo(() => buildSummaryMap(featuredSummaries), [featuredSummaries]);

  const featuredCards = useMemo(
    () => buildFeaturedCards(featuredSummaries, catalogGames),
    [catalogGames, featuredSummaries],
  );

  const discoverCards = useMemo(
    () => buildDiscoverCards(catalogGames, summaryMap),
    [catalogGames, summaryMap],
  );

  const primaryGame = useMemo(() => selectPrimaryGame(featuredSummaries, catalogGames), [catalogGames, featuredSummaries]);
  const primarySummary = primaryGame ? summaryMap.get(primaryGame.id) : undefined;
  const liveMetrics = useMemo(() => buildLiveMetrics(primarySummary), [primarySummary]);

  const detailDescription = useMemo(
    () => buildDescriptionFromMarkdown(primaryGame?.description_md),
    [primaryGame?.description_md],
  );

  const comments = FALLBACK_COMMENTS;
  const reviews = useMemo(
    () => buildReviewHighlights(primaryGame?.title ?? FALLBACK_FEATURED[1].title),
    [primaryGame?.title],
  );
  const checklist = useMemo(() => buildChecklist(primarySummary), [primarySummary]);

  const invoice = useMemo(() => buildInvoice(primaryGame), [primaryGame]);
  const receipt = useMemo(() => buildReceipt(primaryGame, invoice), [primaryGame, invoice]);

  const heroMetrics = useMemo(() => computeHeroMetrics(primaryGame, primarySummary), [primaryGame, primarySummary]);

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 w-full max-w-3xl bg-[radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_60%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="space-y-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <MicroLabel>Bit Indie marketplace</MicroLabel>
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Neon storefront for indie worlds powered by Lightning.
                </h1>
                <p className="max-w-2xl text-sm uppercase tracking-[0.3em] text-emerald-200/80">
                  Browse featured drops, support creators directly with Lightning, and watch live metrics pulse in real time.
                </p>
              </div>
              {hadLoadFailure ? <LoadFailureBanner /> : null}
            </div>
            <AccountAccessWidget />
          </div>
          <ScreenSwitcher activeScreen={activeScreen} onSelect={setActiveScreen} />
        </header>
        <main className="space-y-10 pb-16">
          {activeScreen === 1 && (
            <StorefrontScreen featured={featuredCards} discover={discoverCards} metrics={liveMetrics} />
          )}
          {activeScreen === 2 && (
            <GameDetailScreen
              title={primaryGame?.title ?? FALLBACK_FEATURED[1].title}
              statusLabel={heroMetrics.statusLabel}
              categoryLabel={heroMetrics.categoryLabel}
              versionLabel={heroMetrics.versionLabel}
              developerLabel={heroMetrics.developerLabel}
              lightningAddress={invoice.lightningAddress}
              priceLabel={heroMetrics.priceLabel}
              tipLabel={heroMetrics.tipLabel}
              description={detailDescription}
              comments={comments}
              reviews={reviews}
              checklist={checklist}
              verifiedReviewsCount={primarySummary?.verified_review_count ?? 0}
            />
          )}
          {activeScreen === 3 && <LightningCheckoutScreen invoice={invoice} steps={FALLBACK_INVOICE_STEPS} />}
          {activeScreen === 4 && <ReceiptScreen receipt={receipt} />}
        </main>
      </div>
    </div>
  );
}
