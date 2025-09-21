"use client";

import type { DiscoverGame, FeaturedGame, LiveMetrics } from "./types";
import { MicroLabel, NeonCard, Pill } from "./ui";
import { cn, formatSats, formatStatus } from "./utils";

export function StorefrontScreen({
  featured,
  discover,
  metrics,
  onGameSelect,
}: {
  featured: FeaturedGame[];
  discover: DiscoverGame[];
  metrics: LiveMetrics;
  onGameSelect: (title: string) => void;
}) {
  return (
    <div className="space-y-12">
      <div className="space-y-10">
        <section>
          <FeaturedCarousel featured={featured} onSelect={onGameSelect} />
        </section>
        <section>
          <DiscoverGrid games={discover} onSelect={onGameSelect} />
        </section>
      </div>
      <section className="border-t border-emerald-500/20 pt-10">
        <LiveMetricsColumn metrics={metrics} />
      </section>
    </div>
  );
}

function FeaturedCarousel({
  featured,
  onSelect,
}: {
  featured: FeaturedGame[];
  onSelect: (title: string) => void;
}) {
  return (
    <div className="space-y-4">
      <MicroLabel>Featured rotation</MicroLabel>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#020617] via-[#020617]/80 to-transparent" />
        <div className="flex gap-4 overflow-x-auto pb-4 pr-2">
          {featured.map((game) => (
            <button
              key={game.title}
              type="button"
              onClick={() => onSelect(game.title)}
              className="min-w-[18rem] max-w-[18rem] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <NeonCard className="h-full">
                <div className="mb-4 h-36 rounded-2xl bg-gradient-to-br from-emerald-400/30 via-transparent to-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.35)]" />
                <div className="flex flex-wrap gap-2">
                  <Pill>{formatStatus(game.category)}</Pill>
                  <Pill intent="magenta">{game.priceSats ? formatSats(game.priceSats) : "FREE"}</Pill>
                  <Pill intent="slate">Updated {new Date(game.updatedAt).toLocaleDateString()}</Pill>
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-50">{game.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{game.summary}</p>
              </NeonCard>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiscoverGrid({
  games,
  onSelect,
}: {
  games: DiscoverGame[];
  onSelect: (title: string) => void;
}) {
  return (
    <div className="space-y-4">
      <MicroLabel>Discover new worlds</MicroLabel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => (
          <button
            key={game.title}
            type="button"
            onClick={() => onSelect(game.title)}
            className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <NeonCard className="h-full p-5">
              <div className="flex items-center justify-between">
                <Pill intent={game.status === "FEATURED" ? "magenta" : "emerald"}>{game.status}</Pill>
                <span className="text-[0.7rem] uppercase tracking-[0.35em] text-emerald-200/70">{game.category}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-50">{game.title}</h3>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{game.developer}</p>
              <div className="mt-6 flex items-center justify-between text-xs text-slate-300">
                <div className="flex flex-col gap-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-300/80">REVIEWS</span>
                  <span className="text-sm font-semibold text-slate-100">{game.reviewCount.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-300/80">PRICE</span>
                  <span className="text-sm font-semibold text-slate-100">{formatSats(game.priceSats)}</span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-300/80">ZAPS</span>
                  <span className="text-sm font-semibold text-emerald-300">{game.zapTotal.toLocaleString()} SATS</span>
                </div>
              </div>
            </NeonCard>
          </button>
        ))}
      </div>
    </div>
  );
}

function LiveMetricsColumn({ metrics }: { metrics: LiveMetrics }) {
  const relayStatusClasses = {
    healthy: "text-emerald-300",
    syncing: "text-amber-300",
    degraded: "text-rose-300",
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
      <NeonCard className="flex-1 p-5">
        <MicroLabel>Live operations feed</MicroLabel>
        <div className="mt-4 space-y-4 text-sm text-slate-200">
          <MetricRow label="API LATENCY" value={metrics.apiLatency} />
          <MetricRow label="UPTIME" value={metrics.uptime} />
          <MetricRow label="INVOICES" value={`${metrics.invoicesToday.toLocaleString()} today`} />
          <MetricRow label="ZAPS / HR" value={`${metrics.zapsLastHour.toLocaleString()} sats`} />
        </div>
      </NeonCard>
      <NeonCard className="flex-1 p-5">
        <MicroLabel>Nostr relay sync</MicroLabel>
        <div className="mt-4 space-y-3 text-sm">
          {metrics.nostrRelays.map((relay) => (
            <div key={relay.name} className="flex items-center justify-between">
              <span className="uppercase tracking-[0.35em] text-slate-400">{relay.name}</span>
              <span className={cn("font-semibold", relayStatusClasses[relay.status])}>{relay.status}</span>
            </div>
          ))}
        </div>
      </NeonCard>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="uppercase tracking-[0.4em] text-emerald-200/70">{label}</span>
      <span className="font-semibold text-emerald-200">{value}</span>
    </div>
  );
}
