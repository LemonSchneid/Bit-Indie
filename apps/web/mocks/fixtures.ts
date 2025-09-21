import type { GameComment } from "../lib/api/comments";
import type { GameDraft } from "../lib/api/games";
import type { GameReview } from "../lib/api/reviews";
import type {
  InvoiceCreateResponse,
  PurchaseReceipt,
  PurchaseRecord,
} from "../lib/api/purchases";

const nowIso = new Date().toISOString();

export const mockGame: GameDraft = {
  id: "game-demo-001",
  developer_id: "dev-demo-001",
  status: "DISCOVER",
  title: "Starpath Siege",
  slug: "starpath-siege",
  summary: "Fast-paced roguelite combat among floating ruins.",
  description_md:
    "## Welcome to Starpath Siege\n\nFight across procedurally generated sky temples, craft lightning weapons, and rescue stranded NPCs before the storm front crashes in.",
  price_msats: 150000,
  cover_url: "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80",
  trailer_url: null,
  category: "EARLY_ACCESS",
  build_object_key: "games/starpath-siege/v0.3.2.zip",
  build_size_bytes: 734003200,
  checksum_sha256: "d34db33fd34db33fd34db33fd34db33fd34db33fd34db33fd34db33fd34db33f",
  active: true,
  developer_lightning_address: "piteousfrench82@walletofsatoshi.com",
  created_at: nowIso,
  updated_at: nowIso,
};

export const mockCommentsByGame: Record<string, GameComment[]> = {
  [mockGame.id]: [
    {
      id: "comment-demo-001",
      game_id: mockGame.id,
      body_md: "Landed the first boss on my second attempt. Controller support feels great!",
      created_at: nowIso,
      source: "FIRST_PARTY",
      author: {
        user_id: "user-demo-001",
        pubkey_hex: "cafe0001",
        npub: null,
        display_name: "NovaRunner",
        lightning_address: "novarunner@example.com",
      },
      is_verified_purchase: true,
      total_zap_msats: 0,
    },
    {
      id: "comment-demo-002",
      game_id: mockGame.id,
      body_md: "Would love to see co-op in a future update!",
      created_at: nowIso,
      source: "FIRST_PARTY",
      author: {
        user_id: "user-demo-002",
        pubkey_hex: "cafe0002",
        npub: null,
        display_name: "OrbitSmith",
        lightning_address: null,
      },
      is_verified_purchase: false,
      total_zap_msats: 0,
    },
  ],
};

export const mockReviewsByGame: Record<string, GameReview[]> = {
  [mockGame.id]: [
    {
      id: "review-demo-001",
      game_id: mockGame.id,
      user_id: "user-demo-001",
      title: "Brutal but fair",
      body_md:
        "The aerial arena design keeps every run tense. Each update has improved performance on my Steam Deck.",
      rating: 5,
      helpful_score: 4.6,
      total_zap_msats: 0,
      is_verified_purchase: true,
      created_at: nowIso,
      author: {
        id: "user-demo-001",
        pubkey_hex: "cafe0001",
        display_name: "NovaRunner",
        lightning_address: "novarunner@example.com",
      },
    },
    {
      id: "review-demo-002",
      game_id: mockGame.id,
      user_id: "user-demo-003",
      title: "Needs more builds",
      body_md:
        "Movement tech is slick, but I hit a wall after the second region. Excited to see where it goes.",
      rating: 3,
      helpful_score: 2.1,
      total_zap_msats: 0,
      is_verified_purchase: false,
      created_at: nowIso,
      author: {
        id: "user-demo-003",
        pubkey_hex: "cafe0003",
        display_name: "SkyFletcher",
        lightning_address: null,
      },
    },
  ],
};

export const mockPurchases: Record<string, PurchaseRecord> = {
  "purchase-demo-paid": {
    id: "purchase-demo-paid",
    user_id: "user-demo-guest",
    game_id: mockGame.id,
    invoice_id: "ln-invoice-demo-paid",
    invoice_status: "PAID",
    amount_msats: mockGame.price_msats,
    paid_at: nowIso,
    download_granted: true,
    refund_requested: false,
    refund_status: "NONE",
    created_at: nowIso,
    updated_at: nowIso,
  },
  "purchase-demo-pending": {
    id: "purchase-demo-pending",
    user_id: "user-demo-guest",
    game_id: mockGame.id,
    invoice_id: "ln-invoice-demo-pending",
    invoice_status: "PENDING",
    amount_msats: mockGame.price_msats,
    paid_at: null,
    download_granted: false,
    refund_requested: false,
    refund_status: "NONE",
    created_at: nowIso,
    updated_at: nowIso,
  },
};

export const mockReceipts: Record<string, PurchaseReceipt> = {
  "purchase-demo-paid": {
    purchase: mockPurchases["purchase-demo-paid"],
    game: {
      id: mockGame.id,
      title: mockGame.title,
      slug: mockGame.slug,
      cover_url: mockGame.cover_url,
      price_msats: mockGame.price_msats,
      build_available: true,
    },
    buyer: {
      id: "user-demo-guest",
      pubkey_hex: "guest",
      display_name: "Guest Buyer",
    },
  },
};

export function buildInvoiceResponse(purchaseId: string): InvoiceCreateResponse {
  const purchase = mockPurchases[purchaseId];
  return {
    purchase_id: purchase.id,
    invoice_id: purchase.invoice_id,
    payment_request: "lnbc1demoexamplepp5d6cqzyssp5demoexample",
    amount_msats: purchase.amount_msats ?? mockGame.price_msats ?? 0,
    invoice_status: purchase.invoice_status,
    check_url: `https://example.com/invoices/${purchase.invoice_id}`,
  };
}
