import type {
  CommunityRoadmapNote,
  DeveloperUpdate,
  DevDashboardComment,
  DiscoverGame,
  FeaturedGame,
  GameDetail,
  InvoiceStep,
  LiveMetrics,
  MockComment,
  NpubBenefit,
  ReceiptSummary,
  RoadmapStage,
} from "./types";

export const featuredGames: FeaturedGame[] = [
  {
    title: "Starpath Siege",
    category: "EARLY ACCESS",
    priceSats: 150,
    updatedAt: "2024-04-20",
    summary: "Fast-paced roguelite combat among floating ruins with Lightning-enabled drops.",
  },
  {
    title: "Lumen Forge",
    category: "FINISHED",
    priceSats: 190,
    updatedAt: "2024-04-18",
    summary: "Cooperative factory building beneath a crystal moon with synced blueprints.",
  },
  {
    title: "Chronorift Tactics",
    category: "EARLY ACCESS",
    priceSats: 120,
    updatedAt: "2024-04-19",
    summary: "Command a squad of time-shifted pilots through cascading bullet-time skirmishes.",
  },
];

export const discoverGames: DiscoverGame[] = [
  {
    title: "Starpath Siege",
    developer: "Orbit Foundry",
    status: "FEATURED",
    category: "EARLY ACCESS",
    priceSats: 150,
    reviewCount: 128,
    zapTotal: 312000,
  },
  {
    title: "Chronorift Tactics",
    developer: "Orbit Foundry",
    status: "DISCOVER",
    category: "EARLY ACCESS",
    priceSats: 120,
    reviewCount: 94,
    zapTotal: 198500,
  },
  {
    title: "Lumen Forge",
    developer: "Orbit Foundry",
    status: "FEATURED",
    category: "FINISHED",
    priceSats: 190,
    reviewCount: 167,
    zapTotal: 264300,
  },
  {
    title: "Echoes of the Deep",
    developer: "Orbit Foundry",
    status: "DISCOVER",
    category: "EARLY ACCESS",
    priceSats: 95,
    reviewCount: 82,
    zapTotal: 149750,
  },
  {
    title: "Quantum Drift Rally",
    developer: "Orbit Foundry",
    status: "DISCOVER",
    category: "PROTOTYPE",
    priceSats: 70,
    reviewCount: 58,
    zapTotal: 121400,
  },
];

export const gameDetails: Record<string, GameDetail> = {
  "Starpath Siege": {
    title: "Starpath Siege",
    status: "FEATURED",
    category: "EARLY ACCESS",
    version: "0.3.2",
    lastUpdated: "2024-04-20",
    description: [
      "Fight across procedurally generated sky temples, craft lightning weapons, and rescue stranded crews before the storm front crashes in.",
      "Route zap-funded supply drops to reinforce your loadout mid-run.",
      "Sync leaderboard ghosts with fellow pilots for asynchronous races between updates.",
    ],
    coverArt: "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80",
    developer: "Orbit Foundry",
    lightningAddress: "piteousfrench82@walletofsatoshi.com",
    priceSats: 150,
    tipRecommended: 300,
  },
  "Chronorift Tactics": {
    title: "Chronorift Tactics",
    status: "DISCOVER",
    category: "EARLY ACCESS",
    version: "0.5.0",
    lastUpdated: "2024-04-19",
    description: [
      "Pause the battlefield to queue abilities, then resume to watch them resolve in cascading bullet-time waves.",
      "Experiment with weekly challenge seeds that remix enemy squads and terrain modifiers.",
      "Unlock advanced gear by clearing time anomalies with zap-backed recon teams.",
    ],
    coverArt: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    developer: "Orbit Foundry",
    lightningAddress: "piteousfrench82@walletofsatoshi.com",
    priceSats: 120,
    tipRecommended: 250,
  },
  "Lumen Forge": {
    title: "Lumen Forge",
    status: "FEATURED",
    category: "FINISHED",
    version: "1.2.1",
    lastUpdated: "2024-04-18",
    description: [
      "Redirect beams to power towering photon factories in a co-op automation sandbox.",
      "Share blueprints instantly with friends and iterate on production lines together.",
      "Stabilize reactor output using zap-funded research upgrades unlocked by the community.",
    ],
    coverArt: "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&w=1200&q=80",
    developer: "Orbit Foundry",
    lightningAddress: "piteousfrench82@walletofsatoshi.com",
    priceSats: 190,
    tipRecommended: 350,
  },
  "Echoes of the Deep": {
    title: "Echoes of the Deep",
    status: "DISCOVER",
    category: "EARLY ACCESS",
    version: "0.9.4",
    lastUpdated: "2024-04-17",
    description: [
      "Descend alone or with a crew to map bioluminescent caverns and recover lost technology.",
      "Dialogue choices echo through future dives, revealing hidden factions and side quests.",
      "Finance sonar upgrades with Lightning tips collected during community expeditions.",
    ],
    coverArt: "https://images.unsplash.com/photo-1526403228363-5fda5f4c1cde?auto=format&fit=crop&w=1200&q=80",
    developer: "Orbit Foundry",
    lightningAddress: "piteousfrench82@walletofsatoshi.com",
    priceSats: 95,
    tipRecommended: 220,
  },
  "Quantum Drift Rally": {
    title: "Quantum Drift Rally",
    status: "DISCOVER",
    category: "PROTOTYPE",
    version: "0.2.7",
    lastUpdated: "2024-04-16",
    description: [
      "Chain boost pads to outrun the phase collapse and challenge friends' ghost data.",
      "Weekly tournaments rotate track modifiers and leaderboard rewards pulled from the seed catalog.",
      "Bank sats between runs to unlock experimental hovercraft tuned by the Orbit Foundry crew.",
    ],
    coverArt: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    developer: "Orbit Foundry",
    lightningAddress: "piteousfrench82@walletofsatoshi.com",
    priceSats: 70,
    tipRecommended: 180,
  },
};

export const liveMetrics: LiveMetrics = {
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

export const communityComments: MockComment[] = [
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

export const roadmapStages: RoadmapStage[] = [
  {
    title: "Live right now",
    timeframe: "Shipped",
    summary: "Core marketplace loops already powering the Proof of Play MVP.",
    items: [
      {
        title: "Lightning checkout modal",
        description:
          "Full-height purchase flow anchored to game detail screens with instant invoice refresh and status pulses.",
        status: "shipped",
      },
      {
        title: "Community zap threads",
        description: "Comments aggregate Lightning support so top reviews stay visible across storefront surfaces.",
        status: "shipped",
      },
      {
        title: "Developer onboarding",
        description: "Self-serve publishing checklist with Lightning address verification and launch readiness guardrails.",
        status: "shipped",
      },
    ],
  },
  {
    title: "Building next",
    timeframe: "In development",
    summary: "Active work streams shaping the next release window.",
    items: [
      {
        title: "Platform zap ledger",
        description: "Surface total sats routed to Proof of Play so supporters see momentum at a glance.",
        status: "in-progress",
      },
      {
        title: "Roadmap broadcast feed",
        description: "Automate posting dev notes to Nostr alongside site updates for public accountability.",
        status: "in-progress",
      },
      {
        title: "Creator analytics",
        description: "Give developers retention and zap conversion snapshots inside the dashboard.",
        status: "in-progress",
      },
    ],
  },
  {
    title: "Exploring soon",
    timeframe: "Research",
    summary: "Ideas being validated with creators and the community before they enter sprints.",
    items: [
      {
        title: "Playtest access keys",
        description: "Gate experimental builds with zap-backed access lists controlled by trusted crew leads.",
        status: "exploring",
      },
      {
        title: "Community bounties",
        description: "Let players pool sats to prioritize fixes or entirely new features on the roadmap.",
        status: "exploring",
      },
      {
        title: "Relay mirroring toolkit",
        description: "Bundle CLI helpers and docs for teams hosting their own Nostr relays with Proof of Play hooks.",
        status: "exploring",
      },
    ],
  },
];

export const developerUpdates: DeveloperUpdate[] = [
  {
    id: "update-2024-04-12",
    title: "Zap accounting service hits staging",
    publishedAt: "APR 12 • 2024",
    body: "Background worker now reconciles zap receipts hourly and feeds aggregate totals into the dashboard prototypes.",
    zapMsats: 128_000_000,
  },
  {
    id: "update-2024-04-08",
    title: "Roadmap screen prototype live",
    publishedAt: "APR 08 • 2024",
    body: "Hooked up the new Platform Roadmap tab with composer mocks so the community can zap the priorities that resonate.",
    zapMsats: 64_000_000,
  },
];

export const devDashboardComments: DevDashboardComment[] = [
  {
    id: "comment-2024-03-30",
    author: "Proof of Play team",
    postedAt: "Internal note · MAR 30, 2024",
    body: "The dev dashboard prototype includes panels for build status, zap analytics, and comment moderation controls.",
  },
  {
    id: "comment-2024-04-03",
    author: "Sprint coordination",
    postedAt: "Internal note · APR 03, 2024",
    body: "Next sprint connects the dashboard publish flow to the Nostr pipeline so storefront updates stay curated by ops.",
  },
];

export const communityRoadmapNotes: CommunityRoadmapNote[] = [
  {
    id: "note-crew-leaderboards",
    author: "npub1k6...road",
    createdAgo: "3h ago",
    note: "Leaderboard for most-zapped crews on the storefront would highlight where players are most active.",
    lightningAddress: "ideas@proof-of-play.games",
    zapMsats: 54_000_000,
    replies: 6,
  },
  {
    id: "note-mod-tools",
    author: "npub1xq...sk7p",
    createdAgo: "9h ago",
    note: "Expose basic moderation actions to trusted reviewers so flagged community notes get resolved faster.",
    lightningAddress: null,
    zapMsats: 18_500_000,
    replies: 2,
  },
  {
    id: "note-saved-builds",
    author: "npub1fe...9vyq",
    createdAgo: "1d ago",
    note: "Allow me to pin previous builds for offline play and zap the dev when I revisit an older version.",
    lightningAddress: "support@chromaflux.games",
    zapMsats: 32_200_000,
    replies: 4,
  },
];

export const platformUpdateLightningAddress = "updates@proof-of-play.games";

export const invoiceSteps: InvoiceStep[] = [
  { label: "Invoice created", status: "done", timestamp: "18:41:07" },
  { label: "Waiting for payment", status: "active", timestamp: "18:41:08" },
  { label: "Payment confirmed", status: "pending", timestamp: "--" },
  { label: "Download unlocked", status: "pending", timestamp: "--" },
];

export const receipt: ReceiptSummary = {
  status: "Settled",
  amountSats: 22000,
  buyerPubkey: "npub1k6q8n6c9r7w5f7h2v9x3k0z4l8p2d4s6m8a7u9c3f1",
  orderId: "POP-20240314-8842",
  nextStepLabel: "Download build + leave a zap",
};

export const npubBenefits: NpubBenefit[] = [
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

export function createPlaceholderGameDetail(title: string): GameDetail {
  return {
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
  };
}
