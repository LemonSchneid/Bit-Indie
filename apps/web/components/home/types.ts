export type FeaturedGame = {
  title: string;
  category: string;
  priceSats: number | null;
  updatedAt: string;
  summary: string;
};

export type DiscoverGame = {
  title: string;
  developer: string;
  status: string;
  category: string;
  priceSats: number | null;
  reviewCount: number;
  zapTotal: number;
};

export type GameDetail = {
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

export type MetricStatus = "healthy" | "syncing" | "degraded";

export type RelayMetric = {
  name: string;
  status: MetricStatus;
};

export type LiveMetrics = {
  apiLatency: string;
  uptime: string;
  invoicesToday: number;
  zapsLastHour: number;
  nostrRelays: RelayMetric[];
};

export type MockComment = {
  author: string;
  lightningAddress: string | null;
  timeAgo: string;
  body: string;
  verified: boolean;
  zapMsats: number;
};

export type RoadmapStatus = "shipped" | "in-progress" | "exploring";

export type RoadmapEntry = {
  title: string;
  description: string;
  status: RoadmapStatus;
};

export type RoadmapStage = {
  title: string;
  timeframe: string;
  summary: string;
  items: RoadmapEntry[];
};

export type DeveloperUpdate = {
  id: string;
  title: string;
  publishedAt: string;
  body: string;
  zapMsats: number;
};

export type DevDashboardComment = {
  id: string;
  author: string;
  postedAt: string;
  body: string;
};

export type CommunityRoadmapNote = {
  id: string;
  author: string;
  createdAgo: string;
  note: string;
  lightningAddress: string | null;
  zapMsats: number;
  replies: number;
};

export type InvoiceStep = {
  label: string;
  status: "done" | "active" | "pending";
  timestamp: string;
};

export type ReceiptSummary = {
  status: string;
  amountSats: number;
  buyerPubkey: string;
  orderId: string;
  nextStepLabel: string;
};

export type IdentityBenefit = {
  title: string;
  description: string;
};
