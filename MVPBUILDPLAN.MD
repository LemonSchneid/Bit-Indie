# Bit Indie — Simple MVP Plan

Goal: Ship a web-first MVP with Lightning purchases for downloadable games, first-party comments and verified-purchase reviews, and a small admin area to moderate spam. Legacy social relay features are removed for launch and will only return if a later milestone explicitly calls for them.

---

## AI Workflow Enforcement Flag

`ai_enforce_mvp_flow = false`

- AI contributors must tackle tickets in the order listed below, stopping after completing the first open item.
- Append `✅ Done` to a ticket once its acceptance criteria are met and verified.
- Do not reprioritize milestones without explicit human direction.

---

## Tech Choices (stable + simple)

- Frontend: Next.js 14 (App Router), React Query, Tailwind, shadcn/ui.
- Backend: FastAPI (Python 3.11), SQLAlchemy 2.x, Alembic, Pydantic v2.
- DB: Postgres 15.
- Cache/Queue (optional): Redis for rate limits and background jobs.
- Object storage: Cloudflare R2 or AWS S3 (MinIO in dev).
- Payments: LNbits (initial) or BTCPay Server.
- Auth: Anonymous guest checkout at launch; optional email/magic-link later.
- Infra: Docker Compose locally; simple Fly.io/Render/Vercel split for prod.

Non-Goals for MVP (explicitly off):
- Legacy social login (e.g., NIP-07 equivalents), relay publishing, reply ingestion, and tip receipt aggregation.
- Any background workers that depend on social relays.

---

## Monorepo Layout

```
bit-indie/
  apps/
    web/                      # Next.js app (catalog, game pages, comments, purchase UI)
      app/
      components/
      lib/
      public/
      next.config.js
    api/                      # FastAPI app
      src/
        api/
          v1/
            routes/          # Routers (users, listings, purchases, reviews, admin)
            deps.py
        core/                 # settings, logging, security, rate limits
        db/                   # SQLAlchemy models, session
        services/             # payments, storage, emails (legacy social features removed)
        schemas/              # Pydantic models
        workers/              # (post-MVP) background tasks
        main.py               # FastAPI entry
      alembic/
        versions/
      alembic.ini
      pyproject.toml
  packages/
    shared-types/             # (optional) TS types shared with web via openapi-gen
  infra/
    docker-compose.yml        # postgres, redis, minio, api, web
    nginx/                    # (optional) edge
  scripts/
    dev_bootstrap.sh
  .env.example
  README.md
```

---

## Environment Variables (.env.example)

```
# API
API_PORT=8080
API_ORIGINS=http://localhost:3000
SECRET_KEY=change-me

# Postgres
PG_HOST=localhost
PG_PORT=5432
PG_DB=pop
PG_USER=pop
PG_PASSWORD=devpass

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# Storage
STORAGE_PROVIDER=s3
S3_BUCKET=pop-games
S3_REGION=auto
S3_ENDPOINT=http://localhost:9000       # MinIO in dev
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Payments
LN_PROVIDER=opennode
OPENNODE_API_BASE_URL=https://api.opennode.com
OPENNODE_API_KEY=...
OPENNODE_TREASURY_WALLET=...
OPENNODE_WEBHOOK_SECRET=

# URLs
PUBLIC_WEB_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:8080

# Web (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## Minimal DB Schema (v0)

users `(id, created_at, updated_at, account_identifier UNIQUE, email UNIQUE NULLABLE, display_name, reputation_score int default 0, is_admin bool default false, lightning_address)`

games `(id, slug UNIQUE, title, description_md, price_msats NULLABLE, status enum['DISCOVER','FEATURED','UNLISTED'], category enum['PROTOTYPE','EARLY_ACCESS','FINISHED'], cover_image_url, build_object_key NULLABLE, published_at)`

purchases `(id, user_id NULLABLE, game_id, invoice_id, invoice_status enum['PENDING','PAID','EXPIRED','REFUNDED'], amount_msats, download_granted bool, created_at, updated_at)`

reviews `(id, game_id, user_id, title NULLABLE, body_md, rating NULLABLE, helpful_score int default 0, total_tip_msats int default 0, is_verified_purchase bool, created_at)`

comments `(id, game_id, user_id NULLABLE, body_md, created_at, is_verified_purchase bool)`

Indexes: `users(account_identifier)`, `games(status, category)`, `purchases(user_id, game_id)`, `reviews(game_id, helpful_score DESC)`.

---

## MVP Milestones (Fresh Backlog)

M1 — Core Purchase Flow
- Guest checkout with LNURL/Lightning Address to developer.
- Account-linked invoice creation (LNbits) for signed-in users (optional later).
- Receipt page and restore-by-receipt for guest purchases.
- Unlock download when payment confirmed or allow manual receipt usage.

M2 — First-Party Comments & Reviews
- Post/list comments stored in first-party DB only.
- Create reviews with optional rating; compute helpful_score without relay-dependent receipts.
- Verified-purchase badge based on purchases table.

M3 — Developer Settings
- Add/manage Lightning Address, game metadata, build upload.
- Simple validations and hints; no relay publishing.

M4 — Admin & Moderation
- Hide/unhide comments and reviews; basic rate limits.
- Admin dashboard for abuse triage.

M5 — Download Delivery
- S3/R2 object upload and presigned download links.
- Safe file type and size checks.

M6 — Telemetry & Docs
- Health endpoints, structured logging, minimal tracing.
- Update READMEs and runbooks to reflect removal of legacy social features.

M7 — Code Health & Refactors
- Consolidate repeated UI helpers and long-lived hooks into reusable modules.
- Break large presentation components into focused, testable pieces.

---

## Tickets (Active Enforcement)

### Ticket M1-T001 — Sunset Mock Storefront Data ✅ Done
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Remove the Next.js mock storefront fixtures now that Docker seeding provides real catalog data.
- **Acceptance Criteria:**
  1. Delete mock storefront data modules and references without breaking local or Docker Compose startup flows.
  2. Ensure the seeded data path remains the source for storefront listings in development.
  3. Update any documentation or scripts that previously pointed to the mock data, if applicable.

### Ticket M1-T002 — Productionize Lightning Checkout Modal ✅ Done
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Rework the Lightning checkout modal to consume real invoice payloads while ensuring seeded games use the developer wallet `piteousfrench82@walletofsatoshi.com` for end-to-end testing.
- **Acceptance Criteria:**
  1. Fetch and display live invoice data (amount, payment request, and status timeline) provided by the backend.
  2. Confirm Docker seeding assigns every game's Lightning address to `piteousfrench82@walletofsatoshi.com`.
  3. Verify checkout remains functional across all seeded games with the developer wallet receiving payments.

### Ticket M1-T003 — Consolidate Game Metric Components ✅ Done
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Deduplicate metric rows across storefront and game detail views into a shared, well-tested component.
- **Acceptance Criteria:**
  1. Replace duplicate metric helpers with a single reusable component covering existing use cases.
  2. Preserve or improve visual parity and responsiveness for all screens currently displaying metrics.
  3. Add component-level tests or stories to guard against regressions.

### Ticket M1-T004 — Harden Home Screen State Machine ✅ Done
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Replace ad-hoc integer-based home screen state tracking with a typed, self-documenting state machine or router flow.
- **Acceptance Criteria:**
  1. Introduce named states (enum or route segments) for every screen transition on the home page.
  2. Remove redundant handlers that manually reset selection state.
  3. Add unit or integration coverage for the primary navigation paths.

### Ticket M1-T005 — Extract Purchase Workflow Services ✅ Done
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Move purchase lookup, webhook reconciliation, download presigning, and refund transitions from FastAPI routes into a dedicated service layer.
- **Acceptance Criteria:**
  1. Create a purchase service encapsulating business logic currently embedded in API routes.
  2. Update routes to call the service while preserving existing behavior and tests.
  3. Extend or add tests to cover the service layer, ensuring all purchase scenarios remain validated.

### Ticket M7-T001 — Consolidate Formatting Utilities ✅ Done
- **Milestone:** M7 — Code Health & Refactors
- **Summary:** Extract the shared Lightning price, badge, and date formatting helpers into a single module that the storefront can reuse.
- **Acceptance Criteria:**
  1. Move the Lightning price label, status/category badge, and date formatting helpers into a shared utility file.
  2. Update `GameDetailPage`, the catalog grid, and the featured rotation components to consume the shared helpers without altering existing copy.
  3. Add targeted unit tests covering the shared formatting helpers.

### Ticket M7-T002 — Modularize Game Detail Page ✅ Done
- **Milestone:** M7 — Code Health & Refactors
- **Summary:** Split the monolithic game detail route into composable sections to simplify maintenance and testing.
- **Acceptance Criteria:**
  1. Move the hero, sidebar, comments, and reviews into dedicated child components.
  2. Ensure data-fetching logic is isolated from presentation concerns.
  3. Add tests or stories that exercise the new components.

### Ticket M7-T003 — Decompose Purchase Flow Hook ✅ Done
- **Milestone:** M7 — Code Health & Refactors
- **Summary:** Break `useGamePurchaseFlow` into smaller hooks/services so each behavior can be tested independently.
- **Acceptance Criteria:**
  1. Extract LNURL guest invoice creation, invoice polling, and receipt handling into focused helpers.
  2. Keep the public hook lean, delegating side-effects to the extracted helpers.
  3. Add unit coverage for the new helpers and update existing tests accordingly.

Post-MVP follow-up will be captured in future planning documents once the legacy social stack decisions are revisited.

---

M2 — Accounts & Developer Tooling
- Deliver the core account system, developer console surfaces, and production-ready media assets so creators can manage their catalogs before launch.

### Ticket M2-T001 — Launch Email-Based Account Flow ✅ Done
- **Milestone:** M2 — Accounts & Developer Tooling
- **Summary:** Implement the non-Nostr account creation and login experience so players and admins can authenticate without seeded profiles.
- **Acceptance Criteria:**
  1. Expose FastAPI routes for sign-up, login, logout, and session refresh backed by the neutral account model introduced in M8-T004.
  2. Persist hashed credentials, profile basics, and admin flags while maintaining guest checkout for anonymous purchases.
  3. Replace the "coming soon" login card and landing widgets with working React Query mutations that store the session and hydrate the `UserProfile` client cache.
  4. Cover happy-path and failure flows with backend and frontend tests.

### Ticket M2-T002 — Ship Developer Console Dashboard ✅ Done
- **Milestone:** M2 — Accounts & Developer Tooling
- **Summary:** Build the `/admin` dashboard that wraps `GameDraftForm`, enabling developers to manage drafts, uploads, and publish readiness.
- **Acceptance Criteria:**
  1. Render a secure dashboard route gated by the authenticated admin session from M2-T001.
  2. Integrate the existing `GameDraftForm` with asset upload helpers, publish checklist status, and draft metadata editing.
  3. Provide optimistic UI feedback and error handling for uploads and checklist actions, with tests or Storybook coverage verifying the flow.
  4. Ensure moderation and integrity views remain accessible via the updated navigation.

### Ticket M2-T003 — Replace Placeholder Media with Production Assets
- **Milestone:** M2 — Accounts & Developer Tooling
- **Summary:** Eliminate "coming soon" catalog imagery and receipts by seeding production-ready assets through the draft workflow.
- **Acceptance Criteria:**
  1. Populate launch-ready cover art, hero images, and receipt thumbnails for all catalog entries via the upload pipeline.
  2. Update catalog, game detail, and receipt components to display the new assets while keeping fallbacks for missing media.
  3. Add validation preventing publishes without required media and confirm staging data matches production expectations.
  4. Document the asset seeding process for future catalog updates.

M8 — Legacy Social Stack Removal
- Strip every remaining dependency on the discontinued Nostr/zap/noted relay features.
- Ensure the product, API, and data models no longer reference the legacy social stack while preserving current Lightning purchase flows.

---

### Ticket M8-T001 — Retire Legacy Social Features on the Web App ✅ Done
- **Milestone:** M8 — Legacy Social Stack Removal
- **Summary:** Remove all zap- and Nostr-driven UI flows so the web app no longer depends on the deprecated social stack.
- **Acceptance Criteria:**
  1. Delete zap/Nostr-specific components and hooks (e.g., `zap-button`, `use-zap-workflow`, `use-nostr-*`) and replace their call sites with neutral UI copy.
  2. Remove `nostr-tools` (and related packages) from `package.json`, update lockfiles, and ensure the build passes without those dependencies.
  3. Drop web API clients for `/v1/zaps` and zap totals, updating types, data fetchers, and tests that referenced zap counts.
  4. Remove `NEXT_PUBLIC_NOSTR_ENABLED` (and any gating flags) from config, runtime code, and documentation.
  5. Update all affected CLIs/tests so `pnpm test` / `yarn test` succeed with the new UI.

### Ticket M8-T002 — Delete Zap Ledger and Review Zap Weighting ✅ Done
- **Milestone:** M8 — Legacy Social Stack Removal
- **Summary:** Remove the zap ingestion pipeline and zap-weighted review scoring from the API and data model.
- **Acceptance Criteria:**
  1. Delete zap-related routes (`/v1/nostr/zap-receipts`, `/v1/zaps`), services (`zaps.py`, `zap_ledger.py`), schemas, and tests.
  2. Create an Alembic migration that drops the `zaps`, `zap_ledger_events`, and `zap_ledger_totals` tables and removes zap-specific columns (`total_zap_msats`, `suspicious_zap_pattern`, etc.) from remaining tables.
  3. Update review/comment serializers and ranking logic to exclude zap fields and rely solely on first-party data.
  4. Remove zap metrics/logging and ensure `pytest` passes without zap fixtures.

### Ticket M8-T003 — Remove Release Note Relay Integration ✅ Done
- **Milestone:** M8 — Legacy Social Stack Removal
- **Summary:** Eliminate the release note publisher, ingestion worker, and cached relay replies.
- **Acceptance Criteria:**
  1. Delete release note publisher/ingestor services, caches, schemas, workers, and related tests.
  2. Provide an Alembic migration dropping `release_note_publish_queue`, `release_note_relay_checkpoints`, and `release_note_replies` tables plus any supporting enums.
  3. Refactor `GamePublicationService`, `GameDraftingService`, and `CommentThreadService` so they no longer accept or depend on release note publishers or Nostr replies.
  4. Remove release-note/relay metrics and confirm comment endpoints continue to return first-party data with updated tests.

### Ticket M8-T004 — Replace Nostr Auth with Neutral Account Model ✅ Done
- **Milestone:** M8 — Legacy Social Stack Removal
- **Summary:** Remove the Nostr authentication flow and adapt the user model to a neutral account representation.
- **Acceptance Criteria:**
  1. Remove `/v1/auth` routes, `services.nostr`, `services.auth`, and associated schemas/tests.
  2. Introduce a migration that drops Nostr-specific columns (`pubkey_hex`, `nip05`, etc.) and adds whatever minimal fields are required for non-Nostr accounts (e.g., `email`, `password_hash` placeholders) while keeping developer profiles functional.
  3. Update session/token helpers and any remaining services to work with the revised user model (or disable unused flows), ensuring all API tests pass.
  4. Remove `NOSTR_ENABLED` and related feature-switch logic from services (e.g., comment workflow) so the API no longer branches on legacy flags.

### Ticket M8-T005 — Configuration and Documentation Cleanup ✅ Done
- **Milestone:** M8 — Legacy Social Stack Removal
- **Summary:** Finish removing the last traces of the legacy social stack from configuration, tooling, and docs.
- **Acceptance Criteria:**
  1. Remove `NOSTR_*`, `PLATFORM_*`, zap-related, and relay-related environment variables from `.env.example`, configuration code, and any docs.
  2. Strip leftover constants, caches, and metrics from `core/config` or other modules so no code references the old stack.
  3. Update test/tooling configs (e.g., tsconfig, lint rules) to drop paths that referenced deleted files.
  4. Run a repo-wide search verifying that `nostr`, `zap`, and relay terminology no longer appear in source, tests, or docs (aside from historical migration filenames), documenting the verification in PR notes.
  5. Ensure full test suites (backend + frontend) pass after the cleanup.
