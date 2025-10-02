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

M5 — Download Delivery ✅ Done
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

M2 — Accounts & Developer Tooling
- Deliver the core account system, developer console surfaces, and production-ready media assets so creators can manage their catalogs before launch.

M3 — Developer Settings
- Creators can authenticate into a settings surface to manage Lightning payout details, core game metadata, and upload a playable build with basic validation and guidance.

### Ticket M3-T001 — Developer profile settings surface ✅ Done
- **Milestone:** M3 — Developer Settings
- **Summary:** Add a secure developer profile API and console form so admins can publish contact email and studio URLs alongside their listings.
- **Acceptance Criteria:**
  1. `/v1/devs/{user_id}` returns the authenticated developer profile and both GET and POST mutations require a valid session for the matching user.
  2. Developer console renders a profile settings form gated behind the developer flag, allowing admins to save contact email and optional studio URL.
  3. Automated tests cover the new API authentication paths and the updated web API client helpers.

### Ticket M3-T002 — Lightning payout settings card ✅ Done
- **Milestone:** M3 — Developer Settings
- **Summary:** Add a developer console card so admins can manage Lightning payout addresses required for game sales.
- **Acceptance Criteria:**
  1. Developer console displays a Lightning payouts form for admin developer accounts with clear messaging and disabled states while saving.
  2. Submitting the form persists the trimmed Lightning address via the `/v1/users/{id}/lightning-address` endpoint and refreshes the stored user profile.
  3. Blank submissions and API failures surface actionable error messages without clearing the current address.
  4. Automated tests cover the Lightning status helper utilities and the web API client responsible for updating Lightning addresses.

### Ticket M3-T003 — Auto-generate game draft slugs ✅ Done
- **Milestone:** M3 — Developer Settings
- **Summary:** Help developers create URL-ready slugs by automatically generating one from the draft title while still allowing manual overrides.
- **Acceptance Criteria:**
  1. Typing a draft title pre-populates the slug input with a normalized value that updates as the title changes until the slug is manually edited.
  2. Manually entering a slug keeps the custom value intact on subsequent title edits unless the field is cleared.
  3. Utility tests cover the slug normalization helper to prevent regressions.

M4 — Admin & Moderation
- Provide admin-only tools to hide or restore abusive comments and reviews, enforce simple rate limits, and surface an abuse-triage dashboard for day-to-day moderation.

### Ticket M4-T001 — Hidden content triage and restoration ✅ Done
- **Milestone:** M4 — Admin & Moderation
- **Summary:** Expand the moderation dashboard with hidden content triage, enabling administrators to review and restore previously removed comments and reviews.
- **Acceptance Criteria:**
  1. `/v1/admin/mod/hidden` returns hidden comments and reviews for admin users, including associated game metadata.
  2. `/v1/admin/mod/restore` unhides comments or reviews and dismisses related moderation flags, with automated tests covering both endpoints.
  3. The admin moderation UI displays hidden items with restore actions that call the new API endpoints and update state after completion.

M5 — Download Delivery
- Complete the storage pipeline with uploads to S3/R2 (MinIO in dev), generate presigned download links, and enforce safe file-type and size checks before games go live.

M6 — Telemetry & Docs
- Ship health endpoints alongside structured logging/tracing, and refresh README/runbooks to reflect the Lightning-first architecture and removal of the legacy social stack.

M8 — Legacy Social Stack Removal
- Strip every remaining dependency on the discontinued Nostr/zap/noted relay features.
- Ensure the product, API, and data models no longer reference the legacy social stack while preserving current Lightning purchase flows.

---

