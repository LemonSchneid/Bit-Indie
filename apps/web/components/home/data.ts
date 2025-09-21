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

export const discoverGames: DiscoverGame[] = [
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
    title: "Bit Descent",
    developer: "Lantern Forge",
    status: "DISCOVER",
    category: "RPG",
    priceSats: 10,
    reviewCount: 12,
    zapTotal: 18400,
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

export const gameDetails: Record<string, GameDetail> = {
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
  "Bit Descent": {
    title: "Bit Descent",
    status: "DISCOVER",
    category: "RPG",
    version: "0.3.1",
    lastUpdated: "2024-04-18",
    description: [
      "Descend through procedurally generated caverns where Lightning-charged traps rewire every run.",
      "Collect arcane chips that cash out to sat-backed upgrades between dungeon dives.",
      "Outsmart adaptive bosses that study your zap-enabled loadout and counter your favorite builds.",
    ],
    coverArt: "/images/concepts/bit-descent-cover.png",
    developer: "Lantern Forge",
    lightningAddress: "piteousfrench82@walletofsatoshi.com",
    priceSats: 10,
    tipRecommended: 3,
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
