"use client";

import { useState } from "react";
import type { ReactNode } from "react";

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const featuredGames = [
  {
    title: "Starforge Signal",
    category: "EARLY ACCESS",
    priceSats: 14500,
    updatedAt: "2024-03-14",
    summary: "Mining roguelike with co-op beacon hacking and lightning-fast updates.",
  },
  {
    title: "Neon Drift Syndicate",
    category: "FINISHED",
    priceSats: 22000,
    updatedAt: "2024-02-27",
    summary: "Synthwave street racing where your crew funds upgrades with zaps.",
  },
  {
    title: "Afterlight Archives",
    category: "PROTOTYPE",
    priceSats: null,
    updatedAt: "2024-03-04",
    summary: "Lore-driven exploration puzzler discovering lost Nostr relays.",
  },
];

const discoverGames = [
  {
    title: "Circuitbreak Courier",
    developer: "Relay Rockets",
    status: "DISCOVER",
    category: "ACTION",
    priceSats: 12500,
    reviewCount: 142,
    zapTotal: 92000,
  },
  {
    title: "Glacia Overdrive",
    developer: "Icefield Guild",
    status: "FEATURED",
    category: "STRATEGY",
    priceSats: 18900,
    reviewCount: 214,
    zapTotal: 134500,
  },
  {
    title: "Echoes of Meridian",
    developer: "Solar Weave",
    status: "DISCOVER",
    category: "RPG",
    priceSats: 9900,
    reviewCount: 98,
    zapTotal: 78500,
  },
  {
    title: "Farside Bloom",
    developer: "Studio Perigee",
    status: "FEATURED",
    category: "ADVENTURE",
    priceSats: 15800,
    reviewCount: 63,
    zapTotal: 56000,
  },
  {
    title: "Boltwork Siege",
    developer: "Signal Foundry",
    status: "DISCOVER",
    category: "TACTICS",
    priceSats: 20500,
    reviewCount: 171,
    zapTotal: 99000,
  },
  {
    title: "Satellite Lullaby",
    developer: "Liminal Tea",
    status: "FEATURED",
    category: "SIM",
    priceSats: 7500,
    reviewCount: 47,
    zapTotal: 42000,
  },
];

const liveMetrics = {
  apiLatency: "142 ms",
  uptime: "99.98%",
  invoicesToday: 483,
  zapsLastHour: 178000,
  nostrRelays: [
    { name: "relay.damus.io", status: "healthy" },
    { name: "relay.snort.social", status: "syncing" },
    { name: "nostr.wine", status: "healthy" },
  ],
};

const detailGame = {
  title: "Neon Drift Syndicate",
  status: "FEATURED",
  category: "FINISHED",
  version: "1.2.5",
  lastUpdated: "2024-02-27",
  description: [
    "Lead a crew of underground street racers financing upgrades with Lightning zaps.",
    "Sync loadouts to your Nostr identity so garages and achievements follow your pubkey.",
    "Weekly events rotate tracks, enforce anti-sybil checkpoints, and surface top zap-backed highlights.",
  ],
  coverArt: "/images/concepts/neon-drift-cover.png",
  developer: "Chroma Flux",
  lightningAddress: "pay@chromaflux.games",
  priceSats: 22000,
  tipRecommended: 5000,
};

const communityComments = [
  {
    author: "npub1k6...h2v9",
    timeAgo: "2h ago",
    body: "Garage sync works flawlessly with my Nostr profile. Crew invites in seconds!",
    verified: true,
  },
  {
    author: "npub1qr...8l7x",
    timeAgo: "6h ago",
    body: "Would love to see more neon night variants of the Harbor Circuit.",
    verified: false,
  },
  {
    author: "npub1lc...m5dw",
    timeAgo: "1d ago",
    body: "Paid with Zeus in under five seconds. Handling model is dialed in now.",
    verified: true,
  },
];

const zapReviews = [
  {
    author: "npub1xf...av3e",
    rating: 5,
    zapTotal: 18500,
    summary: "Nightfall league finally feels balanced",
    body: "The new drift assist patch fixed rubber banding. Crew tournaments with zap pools are peak adrenaline.",
  },
  {
    author: "npub1ra...s4kj",
    rating: 4,
    zapTotal: 9200,
    summary: "Soundtrack unlocked",
    body: "Unlocked the hidden synth pack by tipping the devs. Worth every sat for the extra tracks.",
  },
];

const invoiceSteps = [
  { label: "Invoice created", status: "done", timestamp: "18:41:07" },
  { label: "Waiting for payment", status: "active", timestamp: "18:41:08" },
  { label: "Payment confirmed", status: "pending", timestamp: "--" },
  { label: "Download unlocked", status: "pending", timestamp: "--" },
];

const receipt = {
  status: "Settled",
  amountSats: 22000,
  buyerPubkey: "npub1k6q8n6c9r7w5f7h2v9x3k0z4l8p2d4s6m8a7u9c3f1",
  orderId: "POP-20240314-8842",
  nextStepLabel: "Download build + leave a zap",
};

type MetricStatus = "healthy" | "syncing" | "degraded";

type RelayMetric = {
  name: string;
  status: MetricStatus;
};

function formatSats(value: number | null): string {
  if (value === null) {
    return "FREE";
  }

  return `${value.toLocaleString()} SATS`;
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.55em] text-emerald-300/70">
      {children}
    </p>
  );
}

function Pill({
  children,
  intent = "emerald",
}: {
  children: ReactNode;
  intent?: "emerald" | "magenta" | "slate";
}) {
  const intentClasses = {
    emerald: "text-emerald-200 border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.25)]",
    magenta: "text-fuchsia-200 border-fuchsia-400/40 bg-fuchsia-500/10 shadow-[0_0_20px_rgba(232,121,249,0.25)]",
    slate: "text-slate-200 border-slate-500/40 bg-slate-500/10 shadow-[0_0_20px_rgba(148,163,184,0.12)]",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em]",
        intentClasses[intent],
      )}
    >
      {children}
    </span>
  );
}

function NeonCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-emerald-500/10 bg-slate-950/60 p-6 shadow-[0_0_45px_rgba(16,185,129,0.18)] backdrop-blur-xl",
        "before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-emerald-500/20 before:opacity-60",
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function ScreenSwitcher({
  activeScreen,
  onSelect,
}: {
  activeScreen: number;
  onSelect: (screen: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {["STOREFRONT", "SELL YOUR GAME", "INFO FOR PLAYERS", "RECEIPT"].map((label, index) => {
        const screenIndex = index + 1;
        const isActive = activeScreen === screenIndex;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(screenIndex)}
            className={cn(
              "rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition",
              isActive
                ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-emerald-400/60 hover:text-emerald-200",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function FeaturedCarousel() {
  return (
    <div className="space-y-4">
      <MicroLabel>Featured rotation</MicroLabel>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#020617] via-[#020617]/80 to-transparent" />
        <div className="flex gap-4 overflow-x-auto pb-4 pr-2">
          {featuredGames.map((game) => (
          <NeonCard key={game.title} className="min-w-[18rem] max-w-[18rem]">
              <div className="mb-4 h-36 rounded-2xl bg-gradient-to-br from-emerald-400/30 via-transparent to-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.35)]" />
              <div className="flex flex-wrap gap-2">
                <Pill>{formatStatus(game.category)}</Pill>
                <Pill intent="magenta">{game.priceSats ? formatSats(game.priceSats) : "FREE"}</Pill>
                <Pill intent="slate">Updated {new Date(game.updatedAt).toLocaleDateString()}</Pill>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-50">{game.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{game.summary}</p>
            </NeonCard>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiscoverGrid() {
  return (
    <div className="space-y-4">
      <MicroLabel>Discover new worlds</MicroLabel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {discoverGames.map((game) => (
          <NeonCard key={game.title} className="p-5">
            <div className="flex items-center justify-between">
              <Pill intent={game.status === "FEATURED" ? "magenta" : "emerald"}>{game.status}</Pill>
              <span className="text-[0.7rem] uppercase tracking-[0.35em] text-emerald-200/70">
                {game.category}
              </span>
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
        ))}
      </div>
    </div>
  );
}

function LiveMetricsColumn() {
  const relayStatusClasses: Record<MetricStatus, string> = {
    healthy: "text-emerald-300",
    syncing: "text-amber-300",
    degraded: "text-rose-300",
  };

  return (
    <div className="space-y-4">
      <NeonCard className="p-5">
        <MicroLabel>Live operations feed</MicroLabel>
        <div className="mt-4 space-y-4 text-sm text-slate-200">
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.4em] text-emerald-200/70">API LATENCY</span>
            <span className="font-semibold text-emerald-200">{liveMetrics.apiLatency}</span>
          </div>
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.4em] text-emerald-200/70">UPTIME</span>
            <span className="font-semibold text-emerald-200">{liveMetrics.uptime}</span>
          </div>
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.4em] text-emerald-200/70">INVOICES</span>
            <span className="font-semibold text-emerald-200">{liveMetrics.invoicesToday.toLocaleString()} today</span>
          </div>
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.4em] text-emerald-200/70">ZAPS / HR</span>
            <span className="font-semibold text-emerald-200">{liveMetrics.zapsLastHour.toLocaleString()} sats</span>
          </div>
        </div>
      </NeonCard>
      <NeonCard className="p-5">
        <MicroLabel>Nostr relay sync</MicroLabel>
        <div className="mt-4 space-y-3 text-sm">
          {liveMetrics.nostrRelays.map((relay) => (
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

function StorefrontScreen() {
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-10">
        <section className="space-y-5">
          <MicroLabel>Proof of Play marketplace</MicroLabel>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Neon storefront for indie worlds powered by Lightning.
            </h1>
            <p className="mt-4 max-w-2xl text-sm uppercase tracking-[0.3em] text-emerald-200/80">
              Browse featured drops, fund creators with instant zaps, and watch live metrics pulse in real time.
            </p>
          </div>
        </section>
        <section>
          <FeaturedCarousel />
        </section>
        <section>
          <DiscoverGrid />
        </section>
      </div>
      <aside>
        <LiveMetricsColumn />
      </aside>
    </div>
  );
}

function GameDetailScreen() {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <NeonCard className="p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Pill>{detailGame.status}</Pill>
          <Pill intent="magenta">{detailGame.category}</Pill>
          <Pill intent="slate">Version {detailGame.version}</Pill>
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white">{detailGame.title}</h2>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">{detailGame.developer}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-400/10 p-4 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            <div className="h-56 rounded-xl bg-slate-900/80" />
            <p className="mt-3 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-200/80">
              cover art placeholder
            </p>
          </div>
          <div className="space-y-6 text-sm text-slate-200">
            <p className="text-base text-slate-100">
              Neon Drift Syndicate pairs synthwave racing with Lightning-backed crew economies.
            </p>
            <div className="space-y-3">
              {detailGame.description.map((line) => (
                <p key={line} className="leading-relaxed text-slate-300">
                  {line}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:border-emerald-300 hover:text-emerald-100"
              >
                Launch Lightning purchase modal
              </button>
              <button
                type="button"
                className="rounded-full border border-fuchsia-400/60 bg-fuchsia-500/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-fuchsia-100 shadow-[0_0_30px_rgba(232,121,249,0.3)] transition hover:border-fuchsia-300"
              >
                Share crew invite
              </button>
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <NeonCard className="p-6">
            <MicroLabel>Tip the developer</MicroLabel>
            <p className="mt-3 text-sm text-slate-300">
              Send instant support via Lightning Address
              <span className="ml-2 font-semibold text-emerald-200">{detailGame.lightningAddress}</span>
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">Suggested</span>
              <span className="text-lg font-semibold text-emerald-200">{detailGame.tipRecommended.toLocaleString()} sats</span>
            </div>
            <button
              type="button"
              className="mt-6 w-full rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
            >
              Send zap
            </button>
          </NeonCard>
          <NeonCard className="p-6">
            <MicroLabel>Release cadence</MicroLabel>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-emerald-200/70">Last update</span>
                <span className="font-semibold text-emerald-200">{new Date(detailGame.lastUpdated).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-emerald-200/70">Patch notes</span>
                <span className="font-semibold text-emerald-200">Nightfall balance + crew pass</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-emerald-200/70">Refund rate</span>
                <span className="font-semibold text-emerald-200">0.8%</span>
              </div>
            </div>
          </NeonCard>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <NeonCard className="p-6">
            <MicroLabel>Community comments</MicroLabel>
            <div className="mt-4 space-y-4">
              {communityComments.map((comment) => (
                <div key={comment.author} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
                  <div className="flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-[0.35em] text-slate-400">
                    <span>{comment.author}</span>
                    <span className="text-slate-600">•</span>
                    <span>{comment.timeAgo}</span>
                    {comment.verified ? (
                      <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[0.6rem] font-semibold tracking-[0.35em] text-emerald-200">
                        Verified purchase
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-slate-200">{comment.body}</p>
                </div>
              ))}
            </div>
          </NeonCard>
          <NeonCard className="p-6">
            <MicroLabel>Zap-powered reviews</MicroLabel>
            <div className="mt-4 space-y-4">
              {zapReviews.map((review) => (
                <div key={review.author} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{review.author}</p>
                      <p className="mt-2 text-base font-semibold text-slate-100">{review.summary}</p>
                      <p className="mt-1 text-sm text-slate-300">{review.body}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-semibold text-emerald-200">{review.zapTotal.toLocaleString()} sats</span>
                      <button
                        type="button"
                        className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                      >
                        Tip review
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </NeonCard>
        </div>
      </NeonCard>
      <div className="space-y-6">
        <NeonCard className="p-6">
          <MicroLabel>Purchase status</MicroLabel>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.35em] text-emerald-200/70">Price</span>
              <span className="font-semibold text-emerald-200">{detailGame.priceSats.toLocaleString()} sats</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.35em] text-emerald-200/70">Lightning ready</span>
              <span className="font-semibold text-emerald-200">Instant</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.35em] text-emerald-200/70">Verified zaps</span>
              <span className="font-semibold text-emerald-200">312,400 sats</span>
            </div>
          </div>
        </NeonCard>
        <NeonCard className="p-6">
          <MicroLabel>Player sentiment</MicroLabel>
          <div className="mt-4 space-y-4 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.35em] text-emerald-200/70">Rating</span>
              <span className="font-semibold text-emerald-200">4.8 / 5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.35em] text-emerald-200/70">Verified reviews</span>
              <span className="font-semibold text-emerald-200">124</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.35em] text-emerald-200/70">Latest zap</span>
              <span className="font-semibold text-emerald-200">2 min ago</span>
            </div>
          </div>
        </NeonCard>
      </div>
    </div>
  );
}

function LightningCheckoutScreen() {
  return (
    <div className="flex justify-center">
      <NeonCard className="w-full max-w-3xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <MicroLabel>Lightning checkout</MicroLabel>
          <Pill>Invoice active</Pill>
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-64 w-64 items-center justify-center rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-400/10 shadow-[0_0_45px_rgba(16,185,129,0.35)]">
              <span className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">QR Code</span>
            </div>
            <p className="text-[0.7rem] uppercase tracking-[0.4em] text-emerald-300/70">
              Scan with a Lightning wallet
            </p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <MicroLabel>BOLT11 invoice</MicroLabel>
              <textarea
                readOnly
                className="h-32 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/70 p-4 text-xs text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                value="lnbc220u1pj3zsyapp5j42rfq3p63t0m4pq6smef7u66n4vz8yq5n3y5c0q3zd4l8p2d4sdp6xysxxatzd3skxct5ypmkxmmwypmk7mf5yppk7mfqgcqzpgxqyz5vqsp5rgl5e3qg7syeu4j6q9zw7u4m5c5d6f62mdla9qurcgr7yp3ynq9qyyssq0lf7ne9cfp3nd5s4jn4zxr3c0e7jfk8p0s8e0kaxsf6k9c3w7xjnk5d76v0ydf8tlyfmlc2j7a"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                >
                  Copy invoice
                </button>
                <span className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Expires in 14:32</span>
              </div>
            </div>
            <div>
              <MicroLabel>Status timeline</MicroLabel>
              <div className="mt-4 space-y-4">
                {invoiceSteps.map((step) => (
                  <div key={step.label} className="flex items-center gap-4">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border text-[0.6rem] uppercase tracking-[0.35em]",
                        step.status === "done"
                          ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200"
                          : step.status === "active"
                          ? "border-emerald-400/60 text-emerald-200"
                          : "border-slate-700 text-slate-500",
                      )}
                    >
                      {step.status === "pending" ? "" : step.timestamp}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{step.label}</p>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                        {step.status === "done"
                          ? "Captured"
                          : step.status === "active"
                          ? "Awaiting payment"
                          : "Pending"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </NeonCard>
    </div>
  );
}

function ReceiptScreen() {
  return (
    <div className="flex justify-center">
      <NeonCard className="w-full max-w-3xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <MicroLabel>Payment receipt</MicroLabel>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Thank you for supporting indie worlds.</h2>
          </div>
          <Pill>{receipt.status}</Pill>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-400/10 p-4 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            <div className="h-52 rounded-xl bg-slate-900/80" />
            <p className="mt-3 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-200/80">Game cover art</p>
          </div>
          <div className="space-y-6">
            <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">Amount paid</span>
                <p className="mt-2 text-lg font-semibold text-emerald-200">{receipt.amountSats.toLocaleString()} sats</p>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">Order</span>
                <p className="mt-2 text-lg font-semibold text-slate-100">{receipt.orderId}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">Buyer pubkey</span>
                <p className="mt-2 break-all text-lg font-semibold text-slate-100">{receipt.buyerPubkey}</p>
              </div>
            </div>
            <NeonCard className="p-6">
              <MicroLabel>Next steps</MicroLabel>
              <p className="mt-3 text-sm text-slate-300">
                Jump back into Neon Drift Syndicate, download the latest build, and drop a zap-backed review for the crew.
              </p>
              <button
                type="button"
                className="mt-6 w-full rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.35)]"
              >
                {receipt.nextStepLabel}
              </button>
            </NeonCard>
          </div>
        </div>
      </NeonCard>
    </div>
  );
}

export default function NeonMarketConceptPage() {
  const [activeScreen, setActiveScreen] = useState(1);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 w-1/2 bg-[radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_60%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="space-y-6">
          <MicroLabel>Concept drop</MicroLabel>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Dark neon marketplace exploration — Lightning-native storefront concepts.
              </h1>
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/70">
                Glassy navy cards, emerald glows, uppercase microcopy, and pill badges showcase bitcoin lightning commerce with
                Nostr identity at the core.
              </p>
            </div>
            <ScreenSwitcher activeScreen={activeScreen} onSelect={setActiveScreen} />
          </div>
        </header>
        <main className="space-y-10 pb-16">
          {activeScreen === 1 && <StorefrontScreen />}
          {activeScreen === 2 && <GameDetailScreen />}
          {activeScreen === 3 && <LightningCheckoutScreen />}
          {activeScreen === 4 && <ReceiptScreen />}
        </main>
      </div>
    </div>
  );
}
