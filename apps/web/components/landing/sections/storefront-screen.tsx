"use client";

import type { DiscoverCard, FeaturedCard, LiveMetrics } from "../landing-types";

import { MicroLabel, NeonCard, NeonLinkButton, Pill } from "./shared";

export function FeaturedCarousel({ featured }: { featured: FeaturedCard[] }): JSX.Element {
  return (
    <div className="space-y-4">
      <MicroLabel>Featured rotation</MicroLabel>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#050505] via-[#050505]/85 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#050505] via-[#050505]/85 to-transparent" />
        <div className="flex gap-4 overflow-x-auto pb-4 pr-2">
          {featured.map((game) => (
            <NeonCard key={game.id} className="min-w-[18rem] max-w-[18rem]">
              <div className="mb-4 h-36 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(57,255,20,0.32),_transparent_65%)] shadow-[0_0_40px_rgba(57,255,20,0.28)]" />
              <div className="flex flex-wrap gap-2">
                <Pill>{game.categoryLabel}</Pill>
                <Pill intent="magenta">{game.priceLabel}</Pill>
                <Pill intent="slate">{game.updatedLabel}</Pill>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">{game.title}</h3>
              <p className="mt-2 text-sm text-[#8fa39a]">{game.summary}</p>
              <div className="mt-4">
                <NeonLinkButton href={game.href}>View details & checkout</NeonLinkButton>
              </div>
            </NeonCard>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DiscoverGrid({ discover }: { discover: DiscoverCard[] }): JSX.Element {
  return (
    <div className="space-y-4">
      <MicroLabel>Discover new worlds</MicroLabel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {discover.map((game) => (
          <NeonCard key={game.id} className="p-5">
            <div className="flex items-center justify-between">
              <Pill intent={game.statusIntent}>{game.statusLabel}</Pill>
              <span className="text-[0.7rem] uppercase tracking-[0.35em] text-[#7bffc8]/70">{game.categoryLabel}</span>
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-white">{game.title}</h3>
            <p className="text-xs uppercase tracking-[0.4em] text-[#6f7f77]">{game.developerLabel}</p>
            <div className="mt-6 grid gap-4 text-xs text-[#8aa196] sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/80">REVIEWS</span>
                <span className="text-sm font-semibold text-white">{game.reviewCountLabel}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/80">PRICE</span>
                <span className="text-sm font-semibold text-white">{game.priceLabel}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/80">PURCHASES</span>
                <span className="text-sm font-semibold text-[#7bffc8]">{game.purchaseCountLabel}</span>
              </div>
            </div>
            <div className="mt-6">
              <NeonLinkButton href={game.href}>View details & checkout</NeonLinkButton>
            </div>
          </NeonCard>
        ))}
      </div>
    </div>
  );
}

export function LiveMetricsColumn({ liveMetrics }: { liveMetrics: LiveMetrics }): JSX.Element {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
      <NeonCard className="flex-1 p-5">
        <MicroLabel>Live operations feed</MicroLabel>
        <div className="mt-4 space-y-4 text-sm text-[#9bb0a7]">
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.4em] text-[#7bffc8]/70">API LATENCY</span>
            <span className="font-semibold text-[#abffd9]">{liveMetrics.apiLatency}</span>
          </div>
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.4em] text-[#7bffc8]/70">UPTIME</span>
            <span className="font-semibold text-[#abffd9]">{liveMetrics.uptime}</span>
          </div>
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.4em] text-[#7bffc8]/70">INVOICES</span>
            <span className="font-semibold text-[#abffd9]">{liveMetrics.invoicesToday.toLocaleString("en-US")} today</span>
          </div>
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.4em] text-[#7bffc8]/70">DOWNLOADS</span>
            <span className="font-semibold text-[#abffd9]">{liveMetrics.downloadsToday.toLocaleString("en-US")} today</span>
          </div>
        </div>
      </NeonCard>
      <NeonCard className="flex-1 p-5">
        <MicroLabel>Community pulse</MicroLabel>
        <div className="mt-4 space-y-4 text-sm text-[#9bb0a7]">
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.35em] text-[#7bffc8]/70">FIRST-PARTY COMMENTS</span>
            <span className="font-semibold text-[#abffd9]">
              {liveMetrics.firstPartyComments.toLocaleString("en-US")} today
            </span>
          </div>
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.35em] text-[#7bffc8]/70">VERIFIED REVIEWS</span>
            <span className="font-semibold text-[#abffd9]">
              {liveMetrics.verifiedReviews.toLocaleString("en-US")}
            </span>
          </div>
        </div>
      </NeonCard>
    </div>
  );
}

export function StorefrontScreen({
  featured,
  discover,
  metrics,
}: {
  featured: FeaturedCard[];
  discover: DiscoverCard[];
  metrics: LiveMetrics;
}): JSX.Element {
  return (
    <div className="space-y-12">
      <div className="space-y-10">
        <section>
          <FeaturedCarousel featured={featured} />
        </section>
        <section>
          <DiscoverGrid discover={discover} />
        </section>
      </div>
      <section className="border-t border-emerald-500/20 pt-10">
        <LiveMetricsColumn liveMetrics={metrics} />
      </section>
    </div>
  );
}
