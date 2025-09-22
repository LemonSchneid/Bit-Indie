# Proof of Play — Simple MVP Plan (Nostr-Off)

Goal: Ship a web-first MVP with Lightning purchases for downloadable games, first-party comments and verified‑purchase reviews, and a small admin to moderate spam. Nostr sign‑in, relay publishing, and zap receipt ingestion are disabled for launch and will return post‑MVP.

---

## AI Workflow Enforcement Flag

`ai_enforce_mvp_flow = true`

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
- Auth: Anonymous guest checkout at launch; optional email/magic‑link later.
- Infra: Docker Compose locally; simple Fly.io/Render/Vercel split for prod.

Non‑Goals for MVP (explicitly off):
- Nostr login (NIP‑07), relay publishing, reply ingestion, and zap‑receipt ingestion.
- Any background workers that depend on relays.

---

## Monorepo Layout

```
proof-of-play/
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
        services/             # payments, storage, emails (nostr later)
        schemas/              # Pydantic models
        workers/              # (post‑MVP) background tasks
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

# Payments (choose one)
LN_PROVIDER=lnbits                        # or btcpay
LNBITS_API_URL=https://legend.lnbits.com/api/v1
LNBITS_API_KEY=...
LNBITS_WALLET_ID=...
BTCPAY_URL=
BTCPAY_API_KEY=

# Feature flags (MVP: Nostr off)
NOSTR_ENABLED=false

# URLs
PUBLIC_WEB_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:8080

# Web (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_NOSTR_ENABLED=false
```

---

## Minimal DB Schema (v0)

users `(id, created_at, updated_at, display_name, pubkey_hex UNIQUE NULLABLE, reputation_score int default 0, is_admin bool default false)`

games `(id, slug UNIQUE, title, description_md, price_msats NULLABLE, status enum['DISCOVER','FEATURED','UNLISTED'], category enum['PROTOTYPE','EARLY_ACCESS','FINISHED'], cover_image_url, build_object_key NULLABLE, published_at)`

purchases `(id, user_id NULLABLE, game_id, invoice_id, invoice_status enum['PENDING','PAID','EXPIRED','REFUNDED'], amount_msats, download_granted bool, created_at, updated_at)`

reviews `(id, game_id, user_id, title NULLABLE, body_md, rating NULLABLE, helpful_score int default 0, total_zap_msats int default 0, is_verified_purchase bool, created_at)`

comments `(id, game_id, user_id NULLABLE, body_md, created_at, is_verified_purchase bool)`

Indexes: `users(pubkey_hex)`, `games(status, category)`, `purchases(user_id, game_id)`, `reviews(game_id, helpful_score DESC)`.

---

## MVP Milestones (Fresh Backlog)

M1 — Core Purchase Flow
- Guest checkout with LNURL/Lightning Address to developer.
- Account‑linked invoice creation (LNbits) for signed‑in users (optional later).
- Receipt page and restore‑by‑receipt for guest purchases.
- Unlock download when payment confirmed or allow manual receipt usage.

M2 — First‑Party Comments & Reviews
- Post/list comments stored in first‑party DB only.
- Create reviews with optional rating; compute helpful_score without zap receipts.
- Verified‑purchase badge based on purchases table.

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
- Update READMEs and runbooks (Nostr off; how to re‑enable later).

---

## Tickets (Active Enforcement)

### Ticket M1-T001 — Sunset Mock Storefront Data ✅ Done
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Remove the Next.js mock storefront fixtures now that Docker seeding provides real catalog data.
- **Acceptance Criteria:**
  1. Delete mock storefront data modules and references without breaking local or Docker Compose startup flows.
  2. Ensure the seeded data path remains the source for storefront listings in development.
  3. Update any documentation or scripts that previously pointed to the mock data, if applicable.

### Ticket M1-T002 — Productionize Lightning Checkout Modal
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Rework the Lightning checkout modal to consume real invoice payloads while ensuring seeded games use the developer wallet `piteousfrench82@walletofsatoshi.com` for end-to-end testing.
- **Acceptance Criteria:**
  1. Fetch and display live invoice data (amount, payment request, and status timeline) provided by the backend.
  2. Confirm Docker seeding assigns every game’s Lightning address to `piteousfrench82@walletofsatoshi.com`.
  3. Verify checkout remains functional across all seeded games with the developer wallet receiving payments.

### Ticket M1-T003 — Consolidate Game Metric Components
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Deduplicate metric rows across storefront and game detail views into a shared, well-tested component.
- **Acceptance Criteria:**
  1. Replace duplicate metric helpers with a single reusable component covering existing use cases.
  2. Preserve or improve visual parity and responsiveness for all screens currently displaying metrics.
  3. Add component-level tests or stories to guard against regressions.

### Ticket M1-T004 — Harden Home Screen State Machine
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Replace ad-hoc integer-based home screen state tracking with a typed, self-documenting state machine or router flow.
- **Acceptance Criteria:**
  1. Introduce named states (enum or route segments) for every screen transition on the home page.
  2. Remove redundant handlers that manually reset selection state.
  3. Add unit or integration coverage for the primary navigation paths.

### Ticket M1-T005 — Extract Purchase Workflow Services
- **Milestone:** M1 — Core Purchase Flow
- **Summary:** Move purchase lookup, webhook reconciliation, download presigning, and refund transitions from FastAPI routes into a dedicated service layer.
- **Acceptance Criteria:**
  1. Create a purchase service encapsulating business logic currently embedded in API routes.
  2. Update routes to call the service while preserving existing behavior and tests.
  3. Extend or add tests to cover the service layer, ensuring all purchase scenarios remain validated.

Post‑MVP (Nostr Re‑enable Roadmap)
- NIP‑07 login, relay publish of release notes, reply ingestion and caching, zap receipt ingestion and aggregation.

