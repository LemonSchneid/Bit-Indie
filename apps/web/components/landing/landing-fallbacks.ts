import type {
  CommunityComment,
  DeveloperChecklistItem,
  DiscoverCard,
  FeaturedCard,
  InvoiceSnapshot,
  InvoiceStep,
  LiveMetrics,
  ReceiptSnapshot,
  ReviewHighlight,
  SignInOption,
} from "./landing-types";

export const FALLBACK_FEATURED: FeaturedCard[] = [
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
    summary: "Synthwave street racing with crew-managed upgrades and weekly tournaments.",
    href: "/games/neon-drift-syndicate",
  },
  {
    id: "fallback-afterlight",
    title: "Afterlight Archives",
    categoryLabel: "PROTOTYPE",
    priceLabel: "FREE",
    updatedLabel: "Updated Mar 4, 2024",
    summary: "Lore-driven exploration puzzler discovering forgotten starports.",
    href: "/games/afterlight-archives",
  },
];

export const FALLBACK_DISCOVER: DiscoverCard[] = [
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

export const FALLBACK_LIVE_METRICS: LiveMetrics = {
  apiLatency: "142 ms",
  uptime: "99.98%",
  invoicesToday: 483,
  downloadsToday: 1620,
  firstPartyComments: 284,
  verifiedReviews: 118,
};

export const FALLBACK_COMMENTS: CommunityComment[] = [
  {
    author: "Casey",
    timeAgo: "2h ago",
    body: "Garage sync works flawlessly with my saved receipt. Crew invites in seconds!",
    verified: true,
  },
  {
    author: "Riley",
    timeAgo: "6h ago",
    body: "Would love to see more neon night variants of the Harbor Circuit.",
    verified: false,
  },
  {
    author: "Morgan",
    timeAgo: "1d ago",
    body: "Paid with Zeus in under five seconds. Handling model is dialed in now.",
    verified: true,
  },
];

export const FALLBACK_REVIEWS: ReviewHighlight[] = [
  {
    author: "Jordan",
    rating: 5,
    helpfulLabel: "42 finds helpful",
    summary: "Nightfall league finally feels balanced",
    body: "The new drift assist patch fixed rubber banding. Crew tournaments feel tighter now that payouts are first-party.",
  },
  {
    author: "Avery",
    rating: 4,
    helpfulLabel: "27 finds helpful",
    summary: "Soundtrack unlocked",
    body: "Unlocked the hidden synth pack after finishing the weekly challenge. Worth it for the extra tracks.",
  },
];

export const FALLBACK_INVOICE_STEPS: InvoiceStep[] = [
  { label: "Invoice created", status: "done", timestamp: "18:41:07" },
  { label: "Waiting for payment", status: "active", timestamp: "18:41:08" },
  { label: "Payment confirmed", status: "pending", timestamp: "--" },
  { label: "Download unlocked", status: "pending", timestamp: "--" },
];

export const FALLBACK_INVOICE: InvoiceSnapshot = {
  gameTitle: "Neon Drift Syndicate",
  amountLabel: "22,000 SATS",
  lightningAddress: "pay@chromaflux.games",
  invoiceBolt11:
    "lnbc220u1pj3zsyapp5j42rfq3p63t0m4pq6smef7u66n4vz8yq5n3y5c0q3zd4l8p2d4sdp6xysxxatzd3skxct5ypmkxmmwypmk7mf5yppk7mfqgcqzpgxqyz5vqsp5rgl5e3qg7syeu4j6q9zw7u4m5c5d6f62mdla9qurcgr7yp3ynq9qyyssq0lf7ne9cfp3nd5s4jn4zxr3c0e7jfk8p0s8e0kaxsf6k9c3w7xjnk5d76v0ydf8tlyfmlc2j7a",
  expiresInLabel: "14:32",
};

export const FALLBACK_RECEIPT: ReceiptSnapshot = {
  status: "Settled",
  amountLabel: "22,000 SATS",
  orderId: "POP-20240314-8842",
  buyerAccountId: "account-1k6q8n6c9r7w5f7h2v9",
  nextStepLabel: "Download build + leave a review",
};

export const FALLBACK_CHECKLIST: DeveloperChecklistItem[] = [
  { title: "Upload build & checksum", complete: true },
  { title: "Attach Lightning address", complete: true },
  { title: "Provide game summary", complete: true },
  { title: "Enable verified purchase reviews", complete: false },
];

export const SIGN_IN_OPTIONS: SignInOption[] = [
  {
    title: "Keep purchases synced",
    description: "Sign in to save receipts, downloads, and reviews across every device.",
  },
  {
    title: "Checkout as a guest",
    description: "Skip the account step—pay with Lightning and grab the build immediately.",
  },
  {
    title: "Upgrade anytime",
    description: "Create an account later to restore purchases or leave feedback for developers.",
  },
];
