import { rest } from "msw";

import { mockCommentsByGame, mockGame, mockPurchases, mockReceipts, mockReviewsByGame, buildInvoiceResponse } from "./fixtures";
import type { GameComment } from "../lib/api/comments";
import type { GameReview } from "../lib/api/reviews";
import type { PurchaseRecord } from "../lib/api/purchases";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

const guestUserMapping: Record<string, string> = {};

function withBase(path: string): string {
  return `${API_BASE_URL}${path}`;
}

type Resolver = Parameters<typeof rest.get>[1];

type PostResolver = Parameters<typeof rest.post>[1];

function dualGet(path: string, resolver: Resolver) {
  return [rest.get(withBase(path), resolver), rest.get(path, resolver)] as const;
}

function dualPost(path: string, resolver: PostResolver) {
  return [rest.post(withBase(path), resolver), rest.post(path, resolver)] as const;
}

function findPurchaseBy(predicate: (purchase: PurchaseRecord) => boolean): PurchaseRecord | undefined {
  return Object.values(mockPurchases).find(predicate);
}

export const handlers = [
  ...dualGet("/v1/games/featured", (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          game: mockGame,
          verified_review_count: mockReviewsByGame[mockGame.id]?.filter((review) => review.is_verified_purchase).length ?? 0,
          paid_purchase_count: 42,
          refunded_purchase_count: 1,
          refund_rate: 0.02,
          updated_within_window: true,
        },
      ]),
    );
  }),
  ...dualGet("/v1/games/slug/:slug", (req, res, ctx) => {
    const { slug } = req.params as { slug: string };
    if (slug === mockGame.slug) {
      return res(ctx.status(200), ctx.json(mockGame));
    }

    return res(
      ctx.status(404),
      ctx.json({ detail: "Game not found." }),
    );
  }),
  ...dualGet("/v1/games/:gameId/comments", (req, res, ctx) => {
    const { gameId } = req.params as { gameId: string };
    const comments: GameComment[] = mockCommentsByGame[gameId] ?? [];
    return res(ctx.status(200), ctx.json(comments));
  }),
  ...dualGet("/v1/games/:gameId/reviews", (req, res, ctx) => {
    const { gameId } = req.params as { gameId: string };
    const reviews: GameReview[] = mockReviewsByGame[gameId] ?? [];
    return res(ctx.status(200), ctx.json(reviews));
  }),
  ...dualPost("/v1/games/:gameId/invoice", async (req, res, ctx) => {
    const { gameId } = req.params as { gameId: string };
    const payload = (await req.json()) as { user_id?: string; anon_id?: string };
    const baseId = crypto.randomUUID ? crypto.randomUUID() : `mock-${Date.now()}`;
    const purchaseId = `purchase-mock-${baseId}`;
    let userId = payload.user_id;
    if (!userId && payload.anon_id) {
      userId = guestUserMapping[payload.anon_id] ?? `guest-${payload.anon_id}`;
      guestUserMapping[payload.anon_id] = userId;
    }
    if (!userId) {
      userId = "guest-mock-user";
    }
    const purchase: PurchaseRecord = {
      id: purchaseId,
      user_id: userId,
      game_id: gameId,
      invoice_id: `ln-invoice-${baseId}`,
      invoice_status: "PENDING",
      amount_msats: mockGame.price_msats ?? 0,
      paid_at: null,
      download_granted: false,
      refund_requested: false,
      refund_status: "NONE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockPurchases[purchase.id] = purchase;
    mockReceipts[purchase.id] = {
      purchase,
      game: {
        id: mockGame.id,
        title: mockGame.title,
        slug: mockGame.slug,
        cover_url: mockGame.cover_url,
        price_msats: mockGame.price_msats,
        build_available: true,
      },
      buyer: {
        id: purchase.user_id,
        pubkey_hex: purchase.user_id,
        display_name: payload.user_id ? "Account Buyer" : "Guest Buyer",
      },
    };

    return res(ctx.status(200), ctx.json(buildInvoiceResponse(purchase.id)));
  }),
  ...dualGet("/v1/purchases/lookup", (req, res, ctx) => {
    const url = new URL(req.url.toString());
    const gameId = url.searchParams.get("game_id");
    const userIdParam = url.searchParams.get("user_id");
    const anonIdParam = url.searchParams.get("anon_id");

    if (!gameId) {
      return res(ctx.status(400), ctx.json({ detail: "Missing parameters" }));
    }

    if (!userIdParam && !anonIdParam) {
      return res(ctx.status(400), ctx.json({ detail: "Missing parameters" }));
    }

    let resolvedUserId = userIdParam;
    if (!resolvedUserId && anonIdParam) {
      resolvedUserId = guestUserMapping[anonIdParam] ?? null;
    }

    if (!resolvedUserId) {
      return res(ctx.status(404), ctx.json({ detail: "Purchase not found." }));
    }

    const purchase = findPurchaseBy(
      (record) => record.game_id === gameId && record.user_id === resolvedUserId,
    );

    if (!purchase) {
      return res(ctx.status(404), ctx.json({ detail: "Purchase not found." }));
    }

    return res(ctx.status(200), ctx.json(purchase));
  }),
  ...dualGet("/v1/purchases/:purchaseId", (req, res, ctx) => {
    const { purchaseId } = req.params as { purchaseId: string };
    const purchase = mockPurchases[purchaseId];
    if (!purchase) {
      return res(ctx.status(404), ctx.json({ detail: "Purchase not found." }));
    }

    return res(ctx.status(200), ctx.json(purchase));
  }),
  ...dualGet("/v1/purchases/:purchaseId/receipt", (req, res, ctx) => {
    const { purchaseId } = req.params as { purchaseId: string };
    const receipt = mockReceipts[purchaseId];
    if (!receipt) {
      return res(ctx.status(404), ctx.json({ detail: "Purchase not found." }));
    }

    return res(ctx.status(200), ctx.json(receipt));
  }),
];
