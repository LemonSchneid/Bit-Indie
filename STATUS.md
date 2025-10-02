# Bit Indie MVP Status Review

## What already works

- **Storefront surfaces live data.** The landing page fetches featured rotations and the full catalog from the FastAPI backend at render time, gracefully degrading if either query fails so the UI still renders.【F:apps/web/app/page.tsx†L1-L43】
- **Game detail pages deliver the end-to-end player flow.** Each listing loads metadata, comments, and reviews, renders verified-purchase badges, and hands off to the modal-based Lightning checkout to unlock downloads and receipts.【F:apps/web/app/games/[slug]/page.tsx†L1-L118】【F:apps/web/components/game-detail/reviews-section.tsx†L1-L83】【F:apps/web/components/game-purchase-flow/index.tsx†L1-L133】
- **Lightning purchases wire through the API.** The purchase hook coordinates guest versus account invoices, polls invoice status, restores prior receipts, and exposes download/receipt links once payment clears.【F:apps/web/components/game-purchase-flow/hooks.ts†L1-L205】【F:apps/web/components/game-purchase-flow/hooks.ts†L205-L314】
- **Receipts, moderation, and admin metrics have full UI + API support.** Players can load shareable receipts, while admins get queue tooling and integrity stats backed by the FastAPI routes that enforce admin checks and aggregate refund/flag metrics.【F:apps/web/app/purchases/[purchaseId]/receipt/page.tsx†L1-L167】【F:apps/web/components/admin-moderation-queue.tsx†L1-L213】【F:apps/web/components/admin-integrity-dashboard.tsx†L1-L109】【F:apps/api/src/bit_indie_api/api/v1/routes/admin.py†L39-L173】【F:apps/api/src/bit_indie_api/api/v1/routes/admin_stats.py†L1-L96】
- **Developer services exist behind the scenes.** The API exposes draft management, asset uploads, publish checklists, and Lightning payout plumbing so a dashboard can be layered on when accounts arrive.【F:apps/api/src/bit_indie_api/api/v1/routes/game_drafts.py†L1-L177】【F:apps/api/src/bit_indie_api/services/payments.py†L1-L151】

## Gaps to close before launch

- **First-party authentication is still disabled.** The landing widgets and login card explicitly note that sign-in is “coming soon,” so there is no way to access admin-only surfaces without manual profile seeding. Finish the non-Nostr account flow before launch.【F:apps/web/components/landing/sections/account-access-widget.tsx†L1-L39】【F:apps/web/components/login-card.tsx†L1-L18】
- **Developer console UI is missing.** The marketing copy links to `/admin`, but the route tree only contains moderation and stats views—no page renders the existing `GameDraftForm`, so developers cannot actually manage drafts or uploads yet.【F:apps/web/app/sell/page.tsx†L68-L110】【189bc9†L1-L2】
- **Automated admin access and session hand-off are unresolved.** Admin dashboards rely on a `UserProfile` stored in local storage, but there is no sign-in handshake to populate it. Implement the account/session endpoints and client bridge so moderation and integrity tools gate correctly.【F:apps/web/components/admin-moderation-queue.tsx†L1-L116】【F:apps/web/lib/hooks/use-admin-integrity-metrics.ts†L1-L87】
- **Content polish for assets remains outstanding.** Catalog tiles, hero sections, and receipts all show “Cover art coming soon” fallbacks. Ensure production uploads populate imagery and summaries before launch so the storefront doesn’t ship with placeholders.【F:apps/web/components/catalog/catalog-grid.tsx†L35-L78】【F:apps/web/components/game-detail/hero.tsx†L47-L81】【F:apps/web/app/purchases/[purchaseId]/receipt/page.tsx†L151-L215】

## Suggested next steps

1. Ship the account creation + login slice (backend + web) so profiles, admin gating, and developer tooling can unlock.
2. Stand up the `/admin` dashboard that wraps `GameDraftForm`, integrates asset uploads, and surfaces publish checklist + status.
3. Finish seeding production-ready media for the demo catalog and wire the upload pipeline into the draft form.

Once those are in place, run the end-to-end Lightning checkout in staging to verify receipts, download unlocks, moderation actions, and admin metrics all round-trip correctly.
