"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { FeaturedGameSummary, GameDraft } from "../../lib/api/games";
import { formatCategory, formatDateLabel, formatPriceMsats } from "../../lib/format";

type ClassValue = string | false | null | undefined;

function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

type MetricStatus = "healthy" | "syncing" | "degraded";

type RelayMetric = {
  name: string;
  status: MetricStatus;
};

type LiveMetrics = {
  apiLatency: string;
  uptime: string;
  invoicesToday: number;
  zapsLastHour: number;
  nostrRelays: RelayMetric[];
};

type FeaturedCard = {
  id: string;
  title: string;
  categoryLabel: string;
  priceLabel: string;
  updatedLabel: string;
  summary: string;
  href: string;
};

type DiscoverCard = {
  id: string;
  title: string;
  developerLabel: string;
  statusLabel: string;
  categoryLabel: string;
  priceLabel: string;
  reviewCountLabel: string;
  purchaseCountLabel: string;
  statusIntent: "emerald" | "magenta";
  href: string;
};

type CommunityComment = {
  author: string;
  timeAgo: string;
  body: string;
  verified: boolean;
};

type ZapReview = {
  author: string;
  rating: number;
  zapTotalLabel: string;
  summary: string;
  body: string;
};

type InvoiceStep = {
  label: string;
  status: "done" | "active" | "pending";
  timestamp: string;
};

type InvoiceSnapshot = {
  gameTitle: string;
  amountLabel: string;
  lightningAddress: string;
  invoiceBolt11: string;
  expiresInLabel: string;
};

type ReceiptSnapshot = {
  status: string;
  amountLabel: string;
  orderId: string;
  buyerPubkey: string;
  nextStepLabel: string;
};

type DeveloperChecklistItem = {
  title: string;
  complete: boolean;
};

type NeonLandingProps = {
  catalogGames: GameDraft[];
  featuredSummaries: FeaturedGameSummary[];
};

const FALLBACK_FEATURED: FeaturedCard[] = [
  {
    id: "fallback-starforge",
    title: "Starforge Signal",
    categoryLabel: "EARLY ACCESS",
    priceLabel: "14,500 SATS",
    updatedLabel: "Updated Mar 14, 2024",
    summary: "Mining roguelike with co-op beacon hacking and lightning-fast updates.",
    href: "/games/starforge-signal",
  },
  {
    id: "fallback-neon-drift",
    title: "Neon Drift Syndicate",
    categoryLabel: "FINISHED",
    priceLabel: "22,000 SATS",
    updatedLabel: "Updated Feb 27, 2024",
    summary: "Synthwave street racing where your crew funds upgrades with zaps.",
    href: "/games/neon-drift-syndicate",
  },
  {
    id: "fallback-afterlight",
    title: "Afterlight Archives",
    categoryLabel: "PROTOTYPE",
    priceLabel: "FREE",
    updatedLabel: "Updated Mar 4, 2024",
    summary: "Lore-driven exploration puzzler discovering lost Nostr relays.",
    href: "/games/afterlight-archives",
  },
];

const FALLBACK_DISCOVER: DiscoverCard[] = [
  {
    id: "fallback-circuitbreak",
    title: "Circuitbreak Courier",
    developerLabel: "Relay Rockets",
    statusLabel: "DISCOVER",
    categoryLabel: "ACTION",
    priceLabel: "12,500 SATS",
    reviewCountLabel: "142 reviews",
    purchaseCountLabel: "920 paid",
    statusIntent: "emerald",
    href: "/games/circuitbreak-courier",
  },
  {
    id: "fallback-glacia",
    title: "Glacia Overdrive",
    developerLabel: "Icefield Guild",
    statusLabel: "FEATURED",
    categoryLabel: "STRATEGY",
    priceLabel: "18,900 SATS",
    reviewCountLabel: "214 reviews",
    purchaseCountLabel: "134 paid",
    statusIntent: "magenta",
    href: "/games/glacia-overdrive",
  },
  {
    id: "fallback-echoes",
    title: "Echoes of Meridian",
    developerLabel: "Solar Weave",
    statusLabel: "DISCOVER",
    categoryLabel: "RPG",
    priceLabel: "9,900 SATS",
    reviewCountLabel: "98 reviews",
    purchaseCountLabel: "78 paid",
    statusIntent: "emerald",
    href: "/games/echoes-of-meridian",
  },
  {
    id: "fallback-farside",
    title: "Farside Bloom",
    developerLabel: "Studio Perigee",
    statusLabel: "FEATURED",
    categoryLabel: "ADVENTURE",
    priceLabel: "15,800 SATS",
    reviewCountLabel: "63 reviews",
    purchaseCountLabel: "56 paid",
    statusIntent: "magenta",
    href: "/games/farside-bloom",
  },
  {
    id: "fallback-boltwork",
    title: "Boltwork Siege",
    developerLabel: "Signal Foundry",
    statusLabel: "DISCOVER",
    categoryLabel: "TACTICS",
    priceLabel: "20,500 SATS",
    reviewCountLabel: "171 reviews",
    purchaseCountLabel: "99 paid",
    statusIntent: "emerald",
    href: "/games/boltwork-siege",
  },
  {
    id: "fallback-satellite",
    title: "Satellite Lullaby",
    developerLabel: "Liminal Tea",
    statusLabel: "FEATURED",
    categoryLabel: "SIM",
    priceLabel: "7,500 SATS",
    reviewCountLabel: "47 reviews",
    purchaseCountLabel: "42 paid",
    statusIntent: "magenta",
    href: "/games/satellite-lullaby",
  },
];

const FALLBACK_LIVE_METRICS: LiveMetrics = {
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

const FALLBACK_COMMENTS: CommunityComment[] = [
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

const FALLBACK_REVIEWS: ZapReview[] = [
  {
    author: "npub1xf...av3e",
    rating: 5,
    zapTotalLabel: "18,500 SATS",
    summary: "Nightfall league finally feels balanced",
    body: "The new drift assist patch fixed rubber banding. Crew tournaments with zap pools are peak adrenaline.",
  },
  {
    author: "npub1ra...s4kj",
    rating: 4,
    zapTotalLabel: "9,200 SATS",
    summary: "Soundtrack unlocked",
    body: "Unlocked the hidden synth pack by tipping the devs. Worth every sat for the extra tracks.",
  },
];

const FALLBACK_INVOICE_STEPS: InvoiceStep[] = [
  { label: "Invoice created", status: "done", timestamp: "18:41:07" },
  { label: "Waiting for payment", status: "active", timestamp: "18:41:08" },
  { label: "Payment confirmed", status: "pending", timestamp: "--" },
  { label: "Download unlocked", status: "pending", timestamp: "--" },
];

const FALLBACK_INVOICE: InvoiceSnapshot = {
  gameTitle: "Neon Drift Syndicate",
  amountLabel: "22,000 SATS",
  lightningAddress: "pay@chromaflux.games",
  invoiceBolt11:
    "lnbc220u1pj3zsyapp5j42rfq3p63t0m4pq6smef7u66n4vz8yq5n3y5c0q3zd4l8p2d4sdp6xysxxatzd3skxct5ypmkxmmwypmk7mf5yppk7mfqgcqzpgxqyz5vqsp5rgl5e3qg7syeu4j6q9zw7u4m5c5d6f62mdla9qurcgr7yp3ynq9qyyssq0lf7ne9cfp3nd5s4jn4zxr3c0e7jfk8p0s8e0kaxsf6k9c3w7xjnk5d76v0ydf8tlyfmlc2j7a",
  expiresInLabel: "14:32",
};

const FALLBACK_RECEIPT: ReceiptSnapshot = {
  status: "Settled",
  amountLabel: "22,000 SATS",
  orderId: "POP-20240314-8842",
  buyerPubkey: "npub1k6q8n6c9r7w5f7h2v9x3k0z4l8p2d4s6m8a7u9c3f1",
  nextStepLabel: "Download build + leave a zap",
};

const FALLBACK_CHECKLIST: DeveloperChecklistItem[] = [
  { title: "Upload build & checksum", complete: true },
  { title: "Attach Lightning address", complete: true },
  { title: "Provide game summary", complete: true },
  { title: "Enable verified purchase reviews", complete: false },
];

const NPUB_BENEFITS = [
  {
    title: "Send & receive zaps",
    description: "Back creators instantly and pull tips into your wallet without leaving the flow.",
  },
  {
    title: "Seamless checkout",
    description: "Invoices autofill from your Nostr profile so purchases clear in seconds.",
  },
  {
    title: "Portable progress",
    description: "Achievements and saves follow your npub across every Lightning-ready world.",
  },
];

function formatSatsFromMsats(msats: number | null): string {
  if (msats === null) {
    return "FREE";
  }

  const sats = Math.round(msats / 1000);
  return `${sats.toLocaleString()} SATS`;
}

function uppercaseLabel(value: string): string {
  return value.toUpperCase();
}

function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.55em] text-emerald-300/70">{children}</p>
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

function NeonLinkButton({ href, children }: { href: string; children: ReactNode }) {
  const isDisabled = href === "#";
  const baseClasses =
    "inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition";
  const enabledClasses =
    "border-emerald-400/60 bg-emerald-500/10 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:border-emerald-300 hover:text-emerald-50";
  const disabledClasses = "cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500";

  if (isDisabled) {
    return <span className={cn(baseClasses, disabledClasses)}>{children}</span>;
  }

  return (
    <Link href={href} className={cn(baseClasses, enabledClasses)}>
      {children}
    </Link>
  );
}

const SCREEN_OPTIONS = [
  { label: "Storefront", value: 1 },
  { label: "Sell your game", value: 2 },
  { label: "Lightning checkout", value: 3 },
  { label: "Receipt flow", value: 4 },
];

function ScreenSwitcher({
  activeScreen,
  onSelect,
}: {
  activeScreen: number;
  onSelect: (screen: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {SCREEN_OPTIONS.map((option) => {
        const isActive = activeScreen === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              "rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition",
              isActive
                ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-emerald-400/60 hover:text-emerald-200",
            )}
          >
            {uppercaseLabel(option.label)}
          </button>
        );
      })}
    </div>
  );
}

function FeaturedCarousel({ featured }: { featured: FeaturedCard[] }) {
  return (
    <div className="space-y-4">
      <MicroLabel>Featured rotation</MicroLabel>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#020617] via-[#020617]/80 to-transparent" />
        <div className="flex gap-4 overflow-x-auto pb-4 pr-2">
          {featured.map((game) => (
            <NeonCard key={game.id} className="min-w-[18rem] max-w-[18rem]">
              <div className="mb-4 h-36 rounded-2xl bg-gradient-to-br from-emerald-400/30 via-transparent to-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.35)]" />
              <div className="flex flex-wrap gap-2">
                <Pill>{game.categoryLabel}</Pill>
                <Pill intent="magenta">{game.priceLabel}</Pill>
                <Pill intent="slate">{game.updatedLabel}</Pill>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-50">{game.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{game.summary}</p>
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

function DiscoverGrid({ discover }: { discover: DiscoverCard[] }) {
  return (
    <div className="space-y-4">
      <MicroLabel>Discover new worlds</MicroLabel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {discover.map((game) => (
          <NeonCard key={game.id} className="p-5">
            <div className="flex items-center justify-between">
              <Pill intent={game.statusIntent}>{game.statusLabel}</Pill>
              <span className="text-[0.7rem] uppercase tracking-[0.35em] text-emerald-200/70">{game.categoryLabel}</span>
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-50">{game.title}</h3>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{game.developerLabel}</p>
            <div className="mt-6 grid gap-4 text-xs text-slate-300 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-300/80">REVIEWS</span>
                <span className="text-sm font-semibold text-slate-100">{game.reviewCountLabel}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-300/80">PRICE</span>
                <span className="text-sm font-semibold text-slate-100">{game.priceLabel}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-300/80">PURCHASES</span>
                <span className="text-sm font-semibold text-emerald-300">{game.purchaseCountLabel}</span>
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

function LiveMetricsColumn({ liveMetrics }: { liveMetrics: LiveMetrics }) {
  const relayStatusClasses: Record<MetricStatus, string> = {
    healthy: "text-emerald-300",
    syncing: "text-amber-300",
    degraded: "text-rose-300",
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
      <NeonCard className="flex-1 p-5">
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
      <NeonCard className="flex-1 p-5">
        <MicroLabel>Nostr relay sync</MicroLabel>
        <div className="mt-4 space-y-3 text-sm">
          {liveMetrics.nostrRelays.map((relay) => (
            <div key={relay.name} className="flex items-center justify-between">
              <span className="uppercase tracking-[0.35em] text-slate-400">{relay.name}</span>
              <span className={cn("font-semibold", relayStatusClasses[relay.status])}>{uppercaseLabel(relay.status)}</span>
            </div>
          ))}
        </div>
      </NeonCard>
    </div>
  );
}

function NpubIdentityWidget() {
  return (
    <NeonCard className="w-full max-w-sm p-6 lg:ml-10">
      <MicroLabel>Bring your npub</MicroLabel>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">Sign in or create one</h3>
      <p className="mt-2 text-sm text-emerald-200/80">
        Use your Nostr public key as a universal login for Lightning-charged adventures.
      </p>
      <ul className="mt-5 space-y-4 text-sm text-slate-200">
        {NPUB_BENEFITS.map((benefit) => (
          <li key={benefit.title} className="flex gap-3">
            <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/10 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-emerald-100">
              ✶
            </span>
            <div>
              <p className="font-semibold text-slate-100">{benefit.title}</p>
              <p className="text-xs leading-relaxed text-slate-400">{benefit.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          className="w-full rounded-full border border-emerald-400/70 bg-emerald-500/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:border-emerald-300 hover:text-emerald-50"
        >
          Sign in with npub
        </button>
        <button
          type="button"
          className="w-full rounded-full border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
        >
          Create a new npub
        </button>
      </div>
    </NeonCard>
  );
}

function StorefrontScreen({ featured, discover, metrics }: { featured: FeaturedCard[]; discover: DiscoverCard[]; metrics: LiveMetrics }) {
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

type DetailGameViewProps = {
  title: string;
  statusLabel: string;
  categoryLabel: string;
  versionLabel: string;
  developerLabel: string;
  lightningAddress: string;
  priceLabel: string;
  tipLabel: string;
  description: string[];
  comments: CommunityComment[];
  reviews: ZapReview[];
  checklist: DeveloperChecklistItem[];
  verifiedReviewsCount: number;
};

function GameDetailScreen({
  title,
  statusLabel,
  categoryLabel,
  versionLabel,
  developerLabel,
  lightningAddress,
  priceLabel,
  tipLabel,
  description,
  comments,
  reviews,
  checklist,
  verifiedReviewsCount,
}: DetailGameViewProps) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <NeonCard className="p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Pill>{statusLabel}</Pill>
          <Pill intent="magenta">{categoryLabel}</Pill>
          <Pill intent="slate">{versionLabel}</Pill>
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">{developerLabel}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-400/10 p-4 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            <div className="h-56 rounded-xl bg-slate-900/80" />
            <p className="mt-3 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-200/80">Cover art placeholder</p>
          </div>
          <div className="space-y-6 text-sm text-slate-200">
            <p className="text-base text-slate-100">
              {title} pairs lightning-fast play with a marketplace tuned for sats.
            </p>
            <div className="space-y-3">
              {description.map((line) => (
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
              Send instant support via Lightning address
              <span className="ml-2 font-semibold text-emerald-200">{lightningAddress}</span>
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">Suggested</span>
              <span className="text-lg font-semibold text-emerald-200">{tipLabel}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">Base price</span>
              <span className="text-lg font-semibold text-emerald-200">{priceLabel}</span>
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
                <span className="font-semibold text-emerald-200">{verifiedReviewsCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-emerald-200/70">Latest zap</span>
                <span className="font-semibold text-emerald-200">2 min ago</span>
              </div>
            </div>
          </NeonCard>
        </div>
      </NeonCard>
      <div className="space-y-6">
        <NeonCard className="p-6">
          <MicroLabel>Community comments</MicroLabel>
          <div className="mt-4 space-y-4">
            {comments.map((comment) => (
              <div key={`${comment.author}-${comment.timeAgo}`} className="rounded-2xl border border-emerald-400/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-slate-500">
                  <span>{comment.author}</span>
                  <span>{comment.timeAgo}</span>
                </div>
                <p className="mt-3 text-sm text-slate-200">{comment.body}</p>
                {comment.verified ? (
                  <span className="mt-4 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.35em] text-emerald-300">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/10 text-[0.55rem]">✓</span>
                    Verified purchase
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </NeonCard>
        <NeonCard className="p-6">
          <MicroLabel>Zap-backed reviews</MicroLabel>
          <div className="mt-4 space-y-4">
            {reviews.map((review) => (
              <div key={review.summary} className="rounded-2xl border border-emerald-400/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-slate-500">
                  <span>{review.author}</span>
                  <span>{review.zapTotalLabel}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-100">{review.summary}</p>
                <p className="mt-2 text-sm text-slate-300">{review.body}</p>
              </div>
            ))}
          </div>
        </NeonCard>
        <NeonCard className="p-6">
          <MicroLabel>Developer checklist</MicroLabel>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            {checklist.map((item) => (
              <li key={item.title} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[0.65rem] font-semibold",
                    item.complete
                      ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-700 text-slate-500",
                  )}
                >
                  {item.complete ? "✓" : ""}
                </span>
                <span className="uppercase tracking-[0.3em] text-slate-400">{item.title}</span>
              </li>
            ))}
          </ul>
        </NeonCard>
      </div>
    </div>
  );
}

function LightningCheckoutScreen({ invoice, steps }: { invoice: InvoiceSnapshot; steps: InvoiceStep[] }) {
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
            <p className="text-[0.7rem] uppercase tracking-[0.4em] text-emerald-300/70">Scan with a Lightning wallet</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <MicroLabel>BOLT11 invoice</MicroLabel>
              <textarea
                readOnly
                className="h-32 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/70 p-4 text-xs text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                value={invoice.invoiceBolt11}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                >
                  Copy invoice
                </button>
                <span className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Expires in {invoice.expiresInLabel}</span>
              </div>
            </div>
            <div>
              <MicroLabel>Status timeline</MicroLabel>
              <div className="mt-4 space-y-4">
                {steps.map((step) => (
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

function ReceiptScreen({ receipt }: { receipt: ReceiptSnapshot }) {
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
                <p className="mt-2 text-lg font-semibold text-emerald-200">{receipt.amountLabel}</p>
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
                Jump back into {receipt.orderId.split("-")[0]} and share a zap-backed review with the crew.
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

function buildFeaturedCards(
  summaries: FeaturedGameSummary[],
  fallbackSummary: GameDraft[],
): FeaturedCard[] {
  const cards = summaries.map((summary) => ({
    id: summary.game.id,
    title: summary.game.title,
    categoryLabel: uppercaseLabel(summary.game.category ?? ""),
    priceLabel: formatSatsFromMsats(summary.game.price_msats ?? null),
    updatedLabel: `Updated ${formatDateLabel(summary.game.updated_at, { fallback: "Recently updated" })}`,
    summary: summary.game.summary ?? "Lightning-powered indie world held together by zaps.",
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
      summary: game.summary ?? "Lightning-powered indie world held together by zaps.",
      href: game.slug ? `/games/${game.slug}` : FALLBACK_FEATURED[0].href,
    }));
  }

  return FALLBACK_FEATURED;
}

function buildDiscoverCards(
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
      reviewCountLabel: `${reviewCount.toLocaleString()} reviews`,
      purchaseCountLabel: `${purchases.toLocaleString()} paid`,
      statusIntent,
      href: game.slug ? `/games/${game.slug}` : "#",
    };
  });
}

function buildLiveMetrics(primarySummary: FeaturedGameSummary | undefined): LiveMetrics {
  if (!primarySummary) {
    return FALLBACK_LIVE_METRICS;
  }

  return {
    apiLatency: "132 ms",
    uptime: "99.99%",
    invoicesToday: Math.max(primarySummary.paid_purchase_count, 1),
    zapsLastHour: Math.max(primarySummary.verified_review_count, 1) * 420,
    nostrRelays: FALLBACK_LIVE_METRICS.nostrRelays,
  };
}

function buildDescriptionFromMarkdown(markdown?: string | null): string[] {
  if (!markdown) {
    return [
      "Sync loadouts to your identity so achievements follow your pubkey across every build.",
      "Weekly events rotate tracks, enforce anti-sybil checkpoints, and surface zap-backed highlights.",
    ];
  }

  return markdown
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function buildZapReviews(gameTitle: string): ZapReview[] {
  return FALLBACK_REVIEWS.map((review) => ({
    ...review,
    summary: review.summary.replace("Neon Drift Syndicate", gameTitle),
  }));
}

function buildChecklist(summary?: FeaturedGameSummary): DeveloperChecklistItem[] {
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

function buildInvoice(game: GameDraft | undefined): InvoiceSnapshot {
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

function buildReceipt(game: GameDraft | undefined, invoice: InvoiceSnapshot): ReceiptSnapshot {
  if (!game) {
    return FALLBACK_RECEIPT;
  }

  return {
    status: "Settled",
    amountLabel: invoice.amountLabel,
    orderId: `${game.slug?.toUpperCase() || "POP"}-20240314-8842`,
    buyerPubkey: FALLBACK_RECEIPT.buyerPubkey,
    nextStepLabel: FALLBACK_RECEIPT.nextStepLabel,
  };
}

export default function NeonLanding({ catalogGames, featuredSummaries }: NeonLandingProps) {
  const [activeScreen, setActiveScreen] = useState<number>(1);

  const summaryMap = useMemo(() => {
    const map = new Map<string, FeaturedGameSummary>();
    for (const summary of featuredSummaries) {
      map.set(summary.game.id, summary);
    }
    return map;
  }, [featuredSummaries]);

  const featuredCards = useMemo(
    () => buildFeaturedCards(featuredSummaries, catalogGames),
    [catalogGames, featuredSummaries],
  );

  const discoverCards = useMemo(
    () => buildDiscoverCards(catalogGames, summaryMap),
    [catalogGames, summaryMap],
  );

  const primaryGame = useMemo(() => {
    if (featuredSummaries.length > 0) {
      return featuredSummaries[0].game;
    }

    if (catalogGames.length > 0) {
      return catalogGames[0];
    }

    return undefined;
  }, [catalogGames, featuredSummaries]);

  const primarySummary = primaryGame ? summaryMap.get(primaryGame.id) : undefined;
  const liveMetrics = useMemo(() => buildLiveMetrics(primarySummary), [primarySummary]);

  const detailDescription = useMemo(
    () => buildDescriptionFromMarkdown(primaryGame?.description_md),
    [primaryGame?.description_md],
  );

  const comments = FALLBACK_COMMENTS;
  const reviews = useMemo(() => buildZapReviews(primaryGame?.title ?? "Neon Drift Syndicate"), [primaryGame?.title]);
  const checklist = useMemo(() => buildChecklist(primarySummary), [primarySummary]);

  const invoice = useMemo(() => buildInvoice(primaryGame), [primaryGame]);
  const receipt = useMemo(() => buildReceipt(primaryGame, invoice), [primaryGame, invoice]);

  const developerLabel = primaryGame?.developer_lightning_address
    ? primaryGame.developer_lightning_address
    : "Lightning-ready developer";

  const categoryLabel = uppercaseLabel(formatCategory(primaryGame?.category ?? ""));
  const statusLabel = uppercaseLabel(primaryGame?.status ?? "DISCOVER");
  const versionLabel = `Updated ${formatDateLabel(primaryGame?.updated_at, { fallback: "Recently updated" })}`;
  const priceLabel = formatSatsFromMsats(primaryGame?.price_msats ?? null);
  const tipLabel = primarySummary
    ? `${Math.max(Math.round((primaryGame?.price_msats ?? 0) / 1000 / 4), 1).toLocaleString()} SATS`
    : "5,000 SATS";

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 w-full max-w-3xl bg-[radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_60%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="space-y-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex justify-center lg:justify-start">
                <Image
                  src="/bit-indie-logo.svg"
                  alt="Bit Indie logo"
                  width={180}
                  height={180}
                  priority
                  className="drop-shadow-[0_18px_42px_rgba(139,92,246,0.35)]"
                />
              </div>
              <MicroLabel>Bit Indie marketplace</MicroLabel>
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Neon storefront for indie worlds powered by Lightning.
                </h1>
                <p className="max-w-2xl text-sm uppercase tracking-[0.3em] text-emerald-200/80">
                  Browse featured drops, fund creators with instant zaps, and watch live metrics pulse in real time.
                </p>
              </div>
            </div>
            <NpubIdentityWidget />
          </div>
          <ScreenSwitcher activeScreen={activeScreen} onSelect={setActiveScreen} />
        </header>
        <main className="space-y-10 pb-16">
          {activeScreen === 1 && <StorefrontScreen featured={featuredCards} discover={discoverCards} metrics={liveMetrics} />}
          {activeScreen === 2 && (
            <GameDetailScreen
              title={primaryGame?.title ?? FALLBACK_FEATURED[1].title}
              statusLabel={statusLabel}
              categoryLabel={categoryLabel}
              versionLabel={versionLabel}
              developerLabel={developerLabel}
              lightningAddress={invoice.lightningAddress}
              priceLabel={priceLabel}
              tipLabel={tipLabel}
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
