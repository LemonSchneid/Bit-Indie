export type LiveMetrics = {
  apiLatency: string;
  uptime: string;
  invoicesToday: number;
  downloadsToday: number;
  firstPartyComments: number;
  verifiedReviews: number;
};

export type FeaturedCard = {
  id: string;
  title: string;
  categoryLabel: string;
  priceLabel: string;
  updatedLabel: string;
  summary: string;
  href: string;
};

export type DiscoverCard = {
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

export type CommunityComment = {
  author: string;
  timeAgo: string;
  body: string;
  verified: boolean;
};

export type ReviewHighlight = {
  author: string;
  rating: number;
  helpfulLabel: string;
  summary: string;
  body: string;
};

export type InvoiceStep = {
  label: string;
  status: "done" | "active" | "pending";
  timestamp: string;
};

export type InvoiceSnapshot = {
  gameTitle: string;
  amountLabel: string;
  lightningAddress: string;
  invoiceBolt11: string;
  expiresInLabel: string;
};

export type ReceiptSnapshot = {
  status: string;
  amountLabel: string;
  orderId: string;
  buyerAccountId: string;
  nextStepLabel: string;
};

export type DeveloperChecklistItem = {
  title: string;
  complete: boolean;
};

export type SignInOption = {
  title: string;
  description: string;
};
