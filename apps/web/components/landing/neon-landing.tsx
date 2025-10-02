"use client";

import { useMemo, useState } from "react";

import type { FeaturedGameSummary, GameDraft } from "../../lib/api/games";
import { formatCategory, formatDateLabel } from "../../lib/format";
import { FALLBACK_COMMENTS, FALLBACK_FEATURED } from "./landing-fallbacks";
import {
  buildChecklist,
  buildDescriptionFromMarkdown,
  buildDiscoverCards,
  buildFeaturedCards,
  buildInvoice,
  buildLiveMetrics,
  buildReviewHighlights,
  formatSatsFromMsats,
  uppercaseLabel,
} from "./landing-helpers";
import { AccountAccessWidget } from "./sections/account-access-widget";
import { CommunityChatScreen } from "./sections/community-chat-screen";
import { LoadFailureBanner } from "./sections/load-failure-banner";
import { PlayerInfoScreen } from "./sections/player-info-screen";
import { ScreenSwitcher } from "./sections/screen-switcher";
import { SellYourGameScreen } from "./sections/sell-your-game-screen";
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
  const activeGameTitle = primaryGame?.title ?? FALLBACK_FEATURED[1].title;
  const reviews = useMemo(() => buildReviewHighlights(activeGameTitle), [activeGameTitle]);
  const checklist = useMemo(() => buildChecklist(primarySummary), [primarySummary]);

  const invoice = useMemo(() => buildInvoice(primaryGame), [primaryGame]);

  const heroMetrics = useMemo(() => computeHeroMetrics(primaryGame, primarySummary), [primaryGame, primarySummary]);

  return (
    <div className="relative overflow-hidden bg-[#050505] text-[#e8f9f1]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(89,255,163,0.12),_transparent_60%)]" />
      <div className="absolute inset-0 -z-20 bg-[conic-gradient(from_140deg_at_10%_20%,_rgba(10,10,10,0.9),_rgba(57,255,20,0.04),_rgba(10,10,10,0.9))]" />
      <div className="absolute inset-y-0 right-0 -z-10 w-full max-w-3xl bg-[radial-gradient(circle_at_right,_rgba(57,255,20,0.08),_transparent_65%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:px-10">
        <header className="space-y-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <MicroLabel>Bit Indie marketplace</MicroLabel>
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Matte-black command center for indie worlds on Lightning.
                </h1>
                <p className="max-w-2xl text-sm uppercase tracking-[0.35em] text-[#7bffc8]/80">
                  Browse featured drops, fuel creators with sats, and track every signal from a matte-black control deck.
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
            <SellYourGameScreen
              checklist={checklist}
              metrics={liveMetrics}
              lightningAddress={invoice.lightningAddress}
              priceLabel={heroMetrics.priceLabel}
              tipLabel={heroMetrics.tipLabel}
              gameTitle={activeGameTitle}
            />
          )}
          {activeScreen === 3 && (
            <PlayerInfoScreen
              title={activeGameTitle}
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
              verifiedReviewsCount={primarySummary?.verified_review_count ?? 0}
            />
          )}
          {activeScreen === 4 && (
            <CommunityChatScreen comments={comments} reviews={reviews} gameTitle={activeGameTitle} />
          )}
        </main>
      </div>
    </div>
  );
}
