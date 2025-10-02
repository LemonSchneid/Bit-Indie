# Cross-Service Workflows

Bit Indie couples a marketing-forward storefront with a fully instrumented API surface. This reference maps the
end-to-end responsibilities across the stack so contributors can reason about ripple effects when making changes.

## Lightning Purchase Lifecycle

1. **Storefront surfaces payment context.** The landing checkout screen walks players through the QR invoice,
   active status timeline, and Lightning address metadata so they understand how sats move during a purchase.
   Those UI states render the snapshot that higher-level helpers compose for the home page experience.
   【F:apps/web/components/landing/sections/lightning-checkout-screen.tsx†L1-L79】
2. **Web clients create and monitor invoices.** The `purchases` API client validates identifiers, issues invoice
   creation requests, polls for the latest purchase by game/user, and resolves receipts once an invoice settles.
   These helpers centralize error messages and request policies so the UI can depend on consistent behavior.
   【F:apps/web/lib/api/purchases.ts†L1-L145】
3. **Backend workflows reconcile settlement and payouts.** `PurchaseWorkflowService` looks up purchases for
   authenticated or guest buyers, applies OpenNode webhook updates, provisions download links, and routes sats to
   the developer and platform treasuries. Whenever a payment posts, it also evaluates promotion heuristics so the
   catalog reflects fresh momentum automatically.【F:apps/api/src/bit_indie_api/services/purchase_workflow.py†L120-L315】

When evolving Lightning payments, keep the contract between these layers intact: adjust request helpers first,
refresh the landing snapshots, then update the workflow service so telemetry and payouts remain balanced.

## Moderation and Verified Feedback Loop

1. **UI highlights verified sentiment.** The game detail screen displays the count of verified reviews, flags
   comments with purchase badges, and offers CTA buttons that depend on checklist progress so community signals are
   obvious to buyers.【F:apps/web/components/landing/sections/game-detail-screen.tsx†L1-L177】
2. **Landing helpers aggregate trustworthy metrics.** Featured game summaries supply review and purchase counts
   that feed the storefront cards, live metrics, and developer checklist, ensuring the marketing layer reflects
   real transaction data.【F:apps/web/components/landing/landing-helpers.ts†L1-L184】
3. **API enforces verification rules.** The comment thread service loads first-party remarks, joins author data,
   and tags responses as verified by cross-checking paid purchases. A shared helper surfaces the set of buyers who
   actually settled Lightning invoices so moderation decisions rest on canonical data.【F:apps/api/src/bit_indie_api/services/comment_thread/__init__.py†L1-L75】【F:apps/api/src/bit_indie_api/services/comment_thread/verification.py†L1-L27】

Feature work that touches moderation should coordinate changes across these tiers—update helper aggregations, keep
UI copy aligned with verification guarantees, and evolve backend filters in tandem so badges stay meaningful.
