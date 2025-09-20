"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { ZapButton } from "../components/zap-button";

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

type GameDetail = {
  title: string;
  status: string;
  category: string;
  version: string;
  lastUpdated: string;
  description: string[];
  coverArt: string;
  developer: string;
  lightningAddress: string;
  priceSats: number | null;
  tipRecommended: number;
};

const gameDetails: Record<string, GameDetail> = {
  "Starforge Signal": {
    title: "Starforge Signal",
    status: "FEATURED",
    category: "EARLY ACCESS",
    version: "0.9.4",
    lastUpdated: "2024-03-14",
    description: [
      "Automate deep-space mining rigs and coordinate with allied crews over Lightning-secured channels.",
      "Deploy programmable drills that react to Nostr-powered distress signals in co-op mode.",
      "Upgrade beacon arrays using zap-backed supply drops from fellow prospectors.",
    ],
    coverArt: "/images/concepts/starforge-cover.png",
    developer: "Helios Assembly",
    lightningAddress: "pay@starforge.games",
    priceSats: 14500,
    tipRecommended: 3500,
  },
  "Neon Drift Syndicate": {
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
  },
  "Afterlight Archives": {
    title: "Afterlight Archives",
    status: "DISCOVER",
    category: "PROTOTYPE",
    version: "0.5.1",
    lastUpdated: "2024-03-04",
    description: [
      "Piece together lost relay transmissions to unravel a cosmic mystery across forgotten worlds.",
      "Translate alien glyphs using zap-funded community research notes.",
      "Curate your archive by minting findings as portable Nostr artifacts.",
    ],
    coverArt: "/images/concepts/afterlight-cover.png",
    developer: "Lumen Archives",
    lightningAddress: "support@afterlight.world",
    priceSats: null,
    tipRecommended: 2500,
  },
  "Circuitbreak Courier": {
    title: "Circuitbreak Courier",
    status: "DISCOVER",
    category: "ACTION",
    version: "0.8.2",
    lastUpdated: "2024-02-18",
    description: [
      "Race prototype drones through relay mazes to deliver lightning-fast payloads.",
      "Earn route optimizations by completing zap-backed community contracts.",
      "Compete in asynchronous leagues with replay ghosts signed by rival npubs.",
    ],
    coverArt: "/images/concepts/circuitbreak-cover.png",
    developer: "Relay Rockets",
    lightningAddress: "crew@relayrockets.games",
    priceSats: 12500,
    tipRecommended: 2800,
  },
  "Glacia Overdrive": {
    title: "Glacia Overdrive",
    status: "FEATURED",
    category: "STRATEGY",
    version: "2.1.0",
    lastUpdated: "2024-02-27",
    description: [
      "Command an arctic outpost where every upgrade is crowdfunded via zaps.",
      "Balance geothermal grids while defending against rival syndicates.",
      "Unlock faction tech trees by coordinating with allied pubkeys.",
    ],
    coverArt: "/images/concepts/glacia-cover.png",
    developer: "Icefield Guild",
    lightningAddress: "tips@icefieldguild.games",
    priceSats: 18900,
    tipRecommended: 4200,
  },
  "Echoes of Meridian": {
    title: "Echoes of Meridian",
    status: "DISCOVER",
    category: "RPG",
    version: "0.7.6",
    lastUpdated: "2024-02-12",
    description: [
      "Restore harmonic balance to a fractured planet using music-infused Lightning artifacts.",
      "Recruit party members by honoring their relay histories via zap-backed quests.",
      "Blend turn-based combat with real-time circuit weaving puzzles.",
    ],
    coverArt: "/images/concepts/meridian-cover.png",
    developer: "Solar Weave",
    lightningAddress: "guild@solarweave.games",
    priceSats: 9900,
    tipRecommended: 2600,
  },
  "Farside Bloom": {
    title: "Farside Bloom",
    status: "FEATURED",
    category: "ADVENTURE",
    version: "1.0.3",
    lastUpdated: "2024-01-29",
    description: [
      "Terraform abandoned moon gardens using zap-fueled botanical drones.",
      "Collect alien seeds via Nostr trading posts and cultivate them in shared greenhouses.",
      "Document discoveries in a living atlas that syncs across your npubs.",
    ],
    coverArt: "/images/concepts/farside-cover.png",
    developer: "Studio Perigee",
    lightningAddress: "garden@perigee.studio",
    priceSats: 15800,
    tipRecommended: 3400,
  },
  "Boltwork Siege": {
    title: "Boltwork Siege",
    status: "DISCOVER",
    category: "TACTICS",
    version: "0.6.9",
    lastUpdated: "2024-02-05",
    description: [
      "Assemble modular fortresses and electrify them with zap-powered defense grids.",
      "Draft commanders by staking sats on their relay reputations.",
      "Replay community sieges with deterministic RNG seeds published on-chain.",
    ],
    coverArt: "/images/concepts/boltwork-cover.png",
    developer: "Signal Foundry",
    lightningAddress: "command@signalfoundry.games",
    priceSats: 20500,
    tipRecommended: 3900,
  },
  "Satellite Lullaby": {
    title: "Satellite Lullaby",
    status: "FEATURED",
    category: "SIM",
    version: "1.4.0",
    lastUpdated: "2024-01-21",
    description: [
      "Compose orbiting soundscapes that stream to distant colonies over Nostr relays.",
      "Collaborate on ambient tracks with fellow creators using zap-gated studio slots.",
      "Stabilize satellite constellations through rhythmic mini-games synced to Lightning events.",
    ],
    coverArt: "/images/concepts/satellite-cover.png",
    developer: "Liminal Tea",
    lightningAddress: "studio@liminaltea.audio",
    priceSats: 7500,
    tipRecommended: 2100,
  },
};

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

function formatZapAmount(msats: number): string {
  if (!Number.isFinite(msats) || msats <= 0) {
    return "0 sats";
  }

  const sats = msats / 1000;
  if (Number.isInteger(sats)) {
    return `${Number(sats).toLocaleString()} sats`;
  }

  return `${Number(sats).toLocaleString(undefined, { maximumFractionDigits: 3 })} sats`;
}

function formatMockZapAmount(msats: number): string {
  return formatZapAmount(msats);
}
type MockComment = {
  author: string;
  lightningAddress: string | null;
  timeAgo: string;
  body: string;
  verified: boolean;
  zapMsats: number;
};

const communityComments: MockComment[] = [
  {
    author: "npub1k6...h2v9",
    lightningAddress: "support@chromaflux.games",
    timeAgo: "2h ago",
    body: "Garage sync works flawlessly with my Nostr profile. Crew invites in seconds!",
    verified: true,
    zapMsats: 32_000,
  },
  {
    author: "npub1qr...8l7x",
    lightningAddress: null,
    timeAgo: "6h ago",
    body: "Would love to see more neon night variants of the Harbor Circuit.",
    verified: false,
    zapMsats: 0,
  },
  {
    author: "npub1lc...m5dw",
    lightningAddress: "tips@neoncrew.games",
    timeAgo: "1d ago",
    body: "Paid with Zeus in under five seconds. Handling model is dialed in now.",
    verified: true,
    zapMsats: 12_500,
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

const npubBenefits = [
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

function ScreenSwitcher({
  activeScreen,
  onSelect,
}: {
  activeScreen: number;
  onSelect: (screen: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {["STOREFRONT", "SELL YOUR GAME", "INFO FOR PLAYERS"].map((label, index) => {
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

function FeaturedCarousel({ onSelect }: { onSelect: (title: string) => void }) {
  return (
    <div className="space-y-4">
      <MicroLabel>Featured rotation</MicroLabel>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#020617] via-[#020617]/80 to-transparent" />
        <div className="flex gap-4 overflow-x-auto pb-4 pr-2">
          {featuredGames.map((game) => (
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

function DiscoverGrid({ onSelect }: { onSelect: (title: string) => void }) {
  return (
    <div className="space-y-4">
      <MicroLabel>Discover new worlds</MicroLabel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {discoverGames.map((game) => (
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

function LiveMetricsColumn() {
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
          {liveMetrics.nostrRelays.map((relay: RelayMetric) => (
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

function NpubIdentityWidget() {
  return (
    <NeonCard className="w-full p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 space-y-4">
          <MicroLabel>Bring your npub</MicroLabel>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold tracking-tight text-white">Sign in or create one</h3>
            <p className="text-sm text-emerald-200/80">
              Use your Nostr public key as a universal login for Lightning-charged adventures.
            </p>
          </div>
          <ul className="grid gap-4 pt-2 text-sm text-slate-200 sm:grid-cols-2 md:grid-cols-3">
            {npubBenefits.map((benefit) => (
              <li key={benefit.title} className="flex gap-3">
                <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/10 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-emerald-100">
                  ✶
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-100">{benefit.title}</p>
                  <p className="text-xs leading-relaxed text-slate-400">{benefit.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex w-full max-w-md flex-col gap-3">
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
      </div>
    </NeonCard>
  );
}

function StorefrontScreen({ onGameSelect }: { onGameSelect: (title: string) => void }) {
  return (
    <div className="space-y-12">
      <div className="space-y-10">
        <section>
          <FeaturedCarousel onSelect={onGameSelect} />
        </section>
        <section>
          <DiscoverGrid onSelect={onGameSelect} />
        </section>
      </div>
      <section className="border-t border-emerald-500/20 pt-10">
        <LiveMetricsColumn />
      </section>
    </div>
  );
}

function SellGameScreen() {
  return (
    <NeonCard className="p-8">
      <div className="space-y-6 text-center text-slate-200">
        <MicroLabel>Sell your game</MicroLabel>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Launch your build to Lightning-powered players
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-300">
          Upload a build, set a price in sats, and plug in your Lightning address. Once approved,
          you&apos;ll take the spotlight in Discovery and Featured rotations with verified-purchase
          reviews and zap analytics out of the box.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            type="button"
            className="rounded-full border border-emerald-400/70 bg-emerald-500/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:border-emerald-300 hover:text-emerald-50"
          >
            Start developer signup
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-700 bg-slate-900/70 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
          >
            View publishing checklist
          </button>
        </div>
      </div>
    </NeonCard>
  );
}

function InfoForPlayersScreen() {
  return (
    <NeonCard className="p-8">
      <div className="space-y-6 text-center text-slate-200">
        <MicroLabel>Info for players</MicroLabel>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Get the most out of your Lightning-powered library
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-300">
          Pair your favorite Lightning wallet, link your Nostr identity, and you&apos;ll unlock
          instant purchases, zap-backed reviews, and portable saves across every Proof of Play
          world.
        </p>
        <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
          <NeonCard className="p-5">
            <MicroLabel>Setup checklist</MicroLabel>
            <ul className="mt-4 space-y-3 text-left text-xs text-slate-300">
              <li>Install a Lightning wallet that supports BOLT11 invoices.</li>
              <li>Enable NIP-07 in your browser for seamless npub sign-ins.</li>
              <li>Whitelist <code>localhost:3000</code> (or your deployed domain) in the wallet.</li>
            </ul>
          </NeonCard>
          <NeonCard className="p-5">
            <MicroLabel>Quick tips</MicroLabel>
            <ul className="mt-4 space-y-3 text-left text-xs text-slate-300">
              <li>Use the download audit trail to keep track of builds per device.</li>
              <li>Drop a zap-backed review to boost your favorite updates.</li>
              <li>Follow devs via Nostr relays for early access patches.</li>
            </ul>
          </NeonCard>
        </div>
      </div>
    </NeonCard>
  );
}

function GameDetailScreen({
  game,
  onBack,
  onLaunchCheckout,
}: {
  game: GameDetail;
  onBack: () => void;
  onLaunchCheckout: () => void;
}) {
  const priceDisplay = game.priceSats !== null ? `${game.priceSats.toLocaleString()} sats` : "Free";
  const [firstParagraph, ...additionalParagraphs] = game.description;
  const coverArtLabel = game.coverArt ? `Cover art: ${game.coverArt}` : "Cover art placeholder";

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
      >
        ← Back to storefront
      </button>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <NeonCard className="p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Pill>{game.status}</Pill>
            <Pill intent="magenta">{game.category}</Pill>
            <Pill intent="slate">Version {game.version}</Pill>
          </div>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white">{game.title}</h2>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">{game.developer}</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
            <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-400/10 p-4 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
              <div className="h-56 rounded-xl bg-slate-900/80" />
              <p className="mt-3 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-200/80">{coverArtLabel}</p>
            </div>
            <div className="space-y-6 text-sm text-slate-200">
              <p className="text-base text-slate-100">
                {firstParagraph ?? "Dive into a Lightning-enabled adventure crafted for Proof of Play explorers."}
              </p>
              {additionalParagraphs.length > 0 ? (
                <div className="space-y-3">
                  {additionalParagraphs.map((line) => (
                    <p key={line} className="leading-relaxed text-slate-300">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onLaunchCheckout}
                  className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:border-emerald-300 hover:text-emerald-100"
                >
                  Launch Lightning purchase modal
                </button>
              </div>
            </div>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <NeonCard className="p-6">
              <MicroLabel>Tip the developer</MicroLabel>
              <p className="mt-3 text-sm text-slate-300">
                Send instant support via Lightning Address
                <span className="ml-2 font-semibold text-emerald-200">{game.lightningAddress}</span>
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">Suggested</span>
                <span className="text-lg font-semibold text-emerald-200">{game.tipRecommended.toLocaleString()} sats</span>
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
                  <span className="font-semibold text-emerald-200">{new Date(game.lastUpdated).toLocaleDateString()}</span>
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
          <div className="mt-10">
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
                      {comment.zapMsats > 0 ? (
                        <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-amber-100">
                          ⚡ {formatMockZapAmount(comment.zapMsats)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-slate-200">{comment.body}</p>
                    <div className="mt-4">
                      <ZapButton
                        lightningAddress={comment.lightningAddress ?? undefined}
                        recipientLabel={comment.author}
                        comment={`Zap mock comment by ${comment.author}`}
                      />
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
                <span className="font-semibold text-emerald-200">{priceDisplay}</span>
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
    </div>
  );
}

function LightningCheckoutContent() {
  return (
    <NeonCard className="flex h-full w-full max-h-[calc(100vh-4rem)] max-w-3xl flex-col overflow-hidden p-8">
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
  );
}

function LightningCheckoutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-slate-950/90">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close Lightning checkout" />
      <div className="relative z-10 flex h-full w-full max-w-4xl items-center justify-center px-6 py-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
        >
          Close
        </button>
        <div className="flex h-full w-full items-center justify-center">
          <LightningCheckoutContent />
        </div>
      </div>
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

export default function HomePage() {
  const [activeScreen, setActiveScreen] = useState(1);
  const [selectedGame, setSelectedGame] = useState<GameDetail | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const handleGameSelect = (title: string) => {
    const detail = gameDetails[title];
    if (detail) {
      setSelectedGame(detail);
    } else {
      setSelectedGame({
        title,
        status: "DISCOVER",
        category: "ADVENTURE",
        version: "1.0.0",
        lastUpdated: new Date().toISOString().slice(0, 10),
        description: [
          `${title} is coming soon to the Proof of Play marketplace.`,
          "Check back soon for gameplay footage, zap stats, and developer updates.",
        ],
        coverArt: "",
        developer: "Indie Studio",
        lightningAddress: "tips@proof-of-play.games",
        priceSats: null,
        tipRecommended: 2000,
      });
    }
    setShowCheckout(false);
    setActiveScreen(1);
  };

  const handleCloseDetail = () => {
    setSelectedGame(null);
    setShowCheckout(false);
  };

  const handleScreenSelect = (screen: number) => {
    setSelectedGame(null);
    setShowCheckout(false);
    setActiveScreen(screen);
  };

  const handleLaunchCheckout = () => {
    setShowCheckout(true);
  };

  const handleCloseCheckout = () => {
    setShowCheckout(false);
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 w-1/2 bg-[radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_60%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="space-y-8">
        <div className="space-y-6">
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <MicroLabel>Proof of Play marketplace</MicroLabel>
              </div>
              <div className="mx-auto max-w-3xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl text-center">
                  Neon storefront for indie worlds powered by Lightning.
                </h1>
                <p className="mx-auto max-w-2xl text-sm uppercase tracking-[0.3em] text-emerald-200/80">
                  Browse featured drops, fund creators with instant zaps, and watch live metrics pulse in real time.
                </p>
              </div>
            </div>
            <NpubIdentityWidget />
          </div>
          <ScreenSwitcher activeScreen={activeScreen} onSelect={handleScreenSelect} />
        </header>
        <main className="space-y-10 pb-16">
          {selectedGame ? (
            <>
              <GameDetailScreen
                game={selectedGame}
                onBack={handleCloseDetail}
                onLaunchCheckout={handleLaunchCheckout}
              />
              {showCheckout ? <LightningCheckoutModal onClose={handleCloseCheckout} /> : null}
            </>
          ) : (
            <>
              {activeScreen === 1 && <StorefrontScreen onGameSelect={handleGameSelect} />}
              {activeScreen === 2 && <SellGameScreen />}
              {activeScreen === 3 && <InfoForPlayersScreen />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
