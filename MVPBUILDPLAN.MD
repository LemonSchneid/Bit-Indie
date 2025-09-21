# Proof of Play — MVP Build Plan (Folder Structure + Tickets)

**Goal:** Ship a web-first MVP with **free comments + creator zaps**, Lightning purchases for downloadable games, verified-purchase reviews, and a tiny admin to kill spam. No deposits at launch. Optional tripwires to add the refundable $100 deposit later.

---

## 0) Tech choices (keep it small & boring)

* **Frontend:** Next.js 14 (App Router), React Query (TanStack), Tailwind, shadcn/ui.
* **Backend:** FastAPI (Python 3.11), SQLAlchemy 2.x, Alembic migrations, Pydantic v2.
* **DB:** Postgres 15 (Supabase/Railway in prod, Docker in dev).
* **Cache/Queue (optional for MVP):** Redis (rate limits, background jobs).
* **Object storage:** Cloudflare R2 or AWS S3 (MinIO in dev).
* **Payments (Lightning invoices):** BTCPay Server **or** LNbits (start with LNbits for speed).
* **Zaps:** Nostr **NIP-57** (wallet does the payment), client-side NIP-07 for login/signing; server ingests zap receipts via relays.
* **Relays:** Use 2–3 reputable public relays first; mirror your content. Add your relay later.
* **Auth:** NIP-07 (browser signer). Optional email magic-link fallback later.
* **Infra:** Docker Compose for local; simple Fly.io/Render/Vercel split for prod.

---

## 1) Monorepo layout

```
proof-of-play/
  apps/
    web/                      # Next.js app (catalog, game pages, comments, zaps UI)
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
        services/             # nostr, payments, storage, emails (later)
        schemas/              # Pydantic models
        workers/              # (optional) background tasks
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

## 2) Environment variables (.env.example)

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

# Nostr
NOSTR_RELAYS=wss://relay.damus.io,wss://relay.snort.social
PLATFORM_PUBKEY=...                       # hex
PLATFORM_NSEC_FOR_SERVER_POSTS=...        # (optional) keep separate from user auth

# URLs
PUBLIC_WEB_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:8080
```

---

## 3) Minimal DB schema (v0)

**users** `(id, created_at, updated_at, pubkey_hex UNIQUE, display_name, nip05, reputation_score int default 0, is_admin bool default false)`

**developers** `(id PK, user_id FK users.id, verified_dev bool default false, profile_url, contact_email)`

**games** `(id PK, developer_id FK, status enum['UNLISTED','DISCOVER','FEATURED'] default 'UNLISTED', title, slug UNIQUE, summary, description_md, price_msats bigint, cover_url, trailer_url, category enum['PROTOTYPE','EARLY_ACCESS','FINISHED'] default 'PROTOTYPE', build_object_key, build_size_bytes, checksum_sha256, active bool)`

**purchases** `(id PK, user_id FK, game_id FK, invoice_id, invoice_status enum['PENDING','PAID','EXPIRED','REFUNDED'], amount_msats, paid_at, download_granted bool, refund_requested bool, refund_status enum['NONE','REQUESTED','APPROVED','DENIED','PAID'], playtime_minutes int default 0)`

**reviews** `(id PK, game_id FK, user_id FK, rating int NULL, title, body_md, helpful_score numeric default 0, is_verified_purchase bool, created_at)`

**comments** `(id PK, game_id FK, user_id FK, body_md, created_at)`

**zaps** `(id PK, target_type enum['REVIEW','GAME','COMMENT','PLATFORM'], target_id, from_pubkey, to_pubkey, amount_msats, event_id, received_at)`

**moderation_flags** `(id PK, target_type, target_id, user_id, reason enum['SPAM','TOS','DMCA','MALWARE'], status enum['OPEN','DISMISSED','ACTIONED'])`

**audit_logs** `(id PK, actor_user_id, action, target_type, target_id, meta JSONB, created_at)`

Indexes: `users(pubkey_hex)`, `games(status, category)`, `purchases(user_id, game_id)`, `reviews(game_id, helpful_score DESC)`, `zaps(target_type, target_id)`, `moderation_flags(status)`.

---

## 4) API endpoints (v0)

**Auth & users**

* `POST /v1/users/login-nostr` → verify signed challenge (NIP-07), upsert user.
* `GET /v1/users/me` → current profile.

**Developers & games**

* `POST /v1/devs` → become dev (attach contact + claim pubkey).
* `POST /v1/games` → create draft; returns upload URL (S3 presign).
* `PUT /v1/games/{id}` → update metadata.
* `POST /v1/games/{id}/publish` → run checklist → set status `UNLISTED`.
* `GET /v1/games` → list (filters: category, status=DISCOVER/FEATURED, search).
* `GET /v1/games/{slug}` → details, aggregated helpful_score, recent reviews, purchase state.

**Purchases & downloads**

* `POST /v1/games/{id}/invoice` → create Lightning invoice via LNbits/BTCPay.
* `POST /v1/payments/webhook` → invoice paid/expired callback.
* `POST /v1/purchases/{id}/refund` → request refund (manual in MVP).
* `GET /v1/games/{id}/download` → if paid → return short-lived signed URL.

**Reviews & comments**

* `POST /v1/games/{id}/reviews` → requires verified purchase to include rating; free text always allowed as comment.
* `GET /v1/games/{id}/reviews` → sorted by `helpful_score * freshness_decay`.
* `POST /v1/games/{id}/comments` → free comments.

**Zaps ingestion**

* `POST /v1/nostr/zap-receipt` (optional) → accept relay push if you subscribe via a worker.
* Background worker: subscribe to relays for zap receipts referencing your game/review notes; update `zaps` + recompute helpful_score.

**Admin & moderation**

* `GET /v1/admin/mod/queue` → open flags, suspicious listings.
* `POST /v1/admin/mod/takedown` → unlist a game, hide content.
* `GET /v1/admin/stats` → refunds %, takedowns %, mod hours estimate.

---

## 5) Review ranking (MVP formula)

**helpful_score = ln(1 + Σ zap_msats_on_review) * trust(user) * freshness_decay(days)**

* `trust(user)`: 1.0 default; +0.2 if NIP-05; +0.3 if verified purchase; −0.5 if correlated/self-zaps detected.
* `freshness_decay = max(0.5, e^(−days/30))` (slow fade).
* Always show **“Received X sats”** badge and **“Verified Purchase”** tag.
* Block self-zaps (dev on own game/review) from count.

---

## 6) Integrity & discovery gates (lightweight)

* New games start `UNLISTED` (shareable URL, not on front page).
* Auto-promote to `DISCOVER` after: checksum present, ≥1 verified purchase, ≥1 review.
* `FEATURED` requires: ≥10 verified reviews, refund rate ≤5%, recent update ≤30 days.
* Rate limits: per-pubkey comment/review caps (e.g., 10/hour); NIP-13 PoW for low-rep accounts.

---

## 7) Nostr flows (MVP)

* **Login:** client signs a server challenge with NIP-07 → server verifies pubkey → issues JWT.
* **Publish:** when a game is published or updated, server signs a **kind 30018 (marketplace)** note (or 1/30023 metadata) from **platform pubkey** with link to page.
* **Zaps:** reviews/comments are client notes; wallets send zaps; your server subscribes to zap receipts (kind 9735) to update helpful_score.

---

## 8) Payments flows (MVP)

**Purchase**

1. Client calls `POST /games/{id}/invoice` → API creates invoice via LNbits → returns `payment_request` + `check_url`.
2. Wallet pays invoice → LNbits webhook → API sets purchase `PAID` and grants download.
3. Client polls purchase or listens via SSE/WebSocket (optional).

**Refunds (manual in MVP)**

* Buyer requests → admin decides → API triggers LNbits payout to user-provided LNURL/bolt11; marks `REFUNDED`.

---

## 9) Milestones & tickets (90-day plan)

### Milestone 0 — Repo & Skeleton (Week 1)

* **T0-1** Monorepo scaffolding (apps/web, apps/api, infra/docker-compose). *DoD:* `docker-compose up` brings Postgres, MinIO, API health. ✅ Done
* **T0-2** FastAPI skeleton + health route + OpenAPI. *DoD:* `/docs` renders; CORS set. ✅ Done
* **T0-3** Next.js app boot + base layout. *DoD:* Web home renders; calls API health. ✅ Done
* **T0-4** DB init + Alembic baseline. *DoD:* `alembic upgrade head` creates v0 tables. ✅ Done

### Milestone 1 — Auth, Devs, Games (Week 2–3)

* **T1-1** NIP-07 login flow (challenge → signature). *DoD:* Can login; user in DB. ✅ Done
* **T1-2** Become Developer endpoint/UI. *DoD:* Dev profile saved; badge on profile. ✅ Done
* **T1-3** Game create/update endpoints + form. *DoD:* Draft saved; validation errors surfaced. ✅ Done
* **T1-4** Storage presign + upload build/cover. *DoD:* Upload to MinIO/S3 works; checksum stored. ✅ Done
* **T1-5** Publish checklist + UNLISTED status. *DoD:* Game visible at direct URL. ✅ Done

### Milestone 2 — Purchase & Download (Week 4–5)

* **T2-1** LNbits invoice creation + webhook verification. *DoD:* Invoice lifecycles recorded. ✅ Done
* **T2-2** Purchase flow UI (modal → QR → polling). *DoD:* Paid state unlocks download. ✅ Done
* **T2-3** Signed URL for downloads. *DoD:* Expiring links; audit log entry. ✅ Done
* **T2-4** Basic receipts (email optional later). *DoD:* Client sees receipt page. ✅ Done

### Milestone 3 — Comments, Reviews, Ranking (Week 6–7)

* **T3-1** Comments CRUD (free speech). *DoD:* Post/list comments per game. ✅ Done
* **T3-2** Verified-purchase reviews (rating gated). *DoD:* If purchase → allow rating; else text only. ✅ Done
* **T3-3** Helpful score calculation (backend service). *DoD:* Endpoint returns sorted reviews. ✅ Done
* **T3-4** UI badges (Verified Purchase, sats received). *DoD:* Visible labels; tooltip for disclosures. ✅ Done

### Milestone 4 — Zaps Integration (Week 8–9)

* **T4-1** Client zap buttons (Lightning Address/LNURL). *DoD:* Wallet opens; payment leaves client. ✅ Done
* **T4-2** Zap receipts ingestion from relays. *DoD:* On receipt, DB `zaps` row added; review helpful_score recomputed. ✅ Done
* **T4-3** Anti self-zap + correlation guard. *DoD:* Self zaps excluded; simple correlation rule flagged. ✅ Done

### Milestone 5 — Discovery & Moderation (Week 10)

* **T5-1** Unlisted → Discover auto-promotion. *DoD:* Transition on ≥1 verified purchase + ≥1 review. ✅ Done
* **T5-2** Admin mod queue (flags, takedown). *DoD:* Admin can unlist a game or hide content. ✅ Done
* **T5-3** Rate limits + PoW for low-rep. *DoD:* Comment spam rate drops; limits logged. ✅ Done

### Milestone 6 — Launch Hardening (Week 11–12)

* **T6-1** Refund request flow (manual payout). *DoD:* Admin can mark REFUNDED; payout recorded. ✅ Done
* **T6-2** Integrity dashboard (refund %, takedown %, mod hours). *DoD:* Stats page for ops. ✅ Done
* **T6-3** Telemetry & error alerting. *DoD:* Basic logs/alerts wired. ✅ Done
* **T6-4** First Featured rotation UI. *DoD:* Featured shelf renders; criteria enforced. ✅ Done

### Milestone 7 — Nostr Release Notes & Relay Sync (Week 13–14)

* **T7-1** Platform release-note publisher pipeline. *DoD:* Publishing a game invokes a dedicated `nostr.publisher` service that assembles a kind 30023 event with title/summary/image/url plus LNURL tags, signs via platform keys loaded through the settings/secret store (no raw nsec in env), enforces retry/backoff + circuit breaker, persists unsent payloads in a durable queue for later replay, posts to every configured relay, and persists the resulting `release_note_event_id` + publish timestamp on the game; contract tests stub a relay and unit tests cover payload hash/signature verification. ✅ Done
* **T7-2** Relay reply ingestion service. *DoD:* Background worker built on the queue abstraction (Redis/worker runner) pulls `release_note_event_id` jobs, keeps per-relay checkpoints/watermarks, supports sharded workers prioritizing by age/popularity to avoid backlogs, queries replies, persists them in a new table keyed by event id + game, dedupes on re-fetch, and emits failure metrics; integration tests exercise the relay stub plus unit tests for parsing and bad event handling. ✅ Done
* **T7-3** Storefront comments merge. *DoD:* Domain mapper converts Nostr replies into `CommentDTO`s behind a caching boundary; API merges cached replies with first-party comments honoring moderation flags and verified-purchase markers using a deterministic rule (`npub` must match a purchase record or linked aliases), and rate-limit/moderation guards apply uniformly; game page renders the combined thread with `npub` display + timestamps; tests cover sorting, verified badge logic, guard enforcement, and alias mapping. ✅ Done
* **T7-4** Zap accounting & landing-page widgets. *DoD:* Idempotent `ZapLedger` service records `target_type='GAME'` and `target_type='PLATFORM'` totals from NIP-57 receipts (including multi-part events), captures `zap_source` to distinguish forwarded/multi-hop payments, API exposes aggregates, web app renders dev zap totals and platform zap/tip buttons using configured LNURL, and telemetry is emitted for zap parsing errors; tests cover parsing, aggregation, idempotency, and source tracking. ✅ Done
* **T7-5** Reply moderation controls. *DoD:* Schema gains moderation flags for ingested relay replies, admin tooling (CLI or stub UI) can hide/unhide replies, automated filters enforce length/profanity thresholds before surfacing to clients, and tests verify hidden replies stay suppressed while remaining fetchable for audit. ✅ Done
* **T7-6** Observability & alerting. *DoD:* Metrics/logs/dashboards track publish latency, per-relay latency/failure rates, ingestion backlog, and zap parsing errors; alerts fire on sustained failures or backlog growth; documentation captures runbooks for publisher failures and ingestion stalls. ✅ Done

---

## 10) Acceptance criteria (examples)

* **Purchase success path:** Create invoice → pay → webhook → purchase=PAID → download link works within 60s.
* **Review ranking:** Adding a 10k-sats zap to a review moves it above an otherwise equal review; label shows the sats.
* **Spam control:** New account cannot post >10 comments/hour; low-rep shows PoW gate; admin can nuke abusive pubkey.

---

## 11) Estimation (realistic MVP ~4k–8k LoC)

* Web app: 1.2k–2k LoC
* API + models + services: 1.2k–2k LoC
* Payments + zaps plumbing: 500–900 LoC
* Storage + uploads: 250–500 LoC
* Admin + moderation: 300–500 LoC
* Ops glue/tests/docs: 400–800 LoC

---

## 12) Nice-to-haves (after MVP)

* One-click importer (itch/Steam link → prefill).
* Your own relay with mod hooks.
* Reviewer stipends & leaderboards.
* Email magic links for non-Nostr users.
* Automated refund rules (≤2h/≤14d), VAT OSS support.

---

## 13) Out of scope for MVP

* $100 dev deposit (enable later via tripwires).
* Mobile native IAPs (web-first only).
* Custodial wallets.

---

## 14) Tripwires to enable refundable deposit

Enable only if for 2 consecutive weeks: takedowns >1% of new listings, or mod hours >20/wk, or duplicate spam >3%, or refund rate >8% on low-review titles. Apply to **FINISHED** games first; grandfather early adopters.

---

## Frontend Tickets

* **F1-1** currently the sign in with npub widget is top right on my landing page. can we make it inline right under the "Proof of play marketplace" widget. lay it out more horizontally then vertically so it matches the flow of the rest of the page. ✅ Done
* **F1-2** the create new npub button should be underneath the sign in with npub button. not beside it. ✅ Done
* **F1-3** center the hero header on the landing page so the intro block and its copy are centered rather than left-aligned. ✅ Done
* **F1-4** center the homepage screen switcher tabs (STOREFRONT, SELL YOUR GAME, INFO FOR PLAYERS) so they align with the centered hero content. ✅ Done
* **F1-5** decouple the “Sell your game” tab from the GameDetailScreen so cards on the storefront open their own detail view, while the tab shows dedicated publishing content. ✅ Done
* **F1-6** ensure the “Launch Lightning purchase modal” button within the game detail view opens the checkout flow, and detach the Info for Players tab from the Lightning checkout screen. ✅ Done
* **F1-7** display the Lightning checkout as an overlay modal when launched from a game detail so players don’t have to scroll down the page. ✅ Done
* **F1-8** restore the Lightning checkout to the Info for Players tab so it takes over the view (no overlay) and wire the game detail button to navigate there. ✅ Done
* **F1-9** show the Lightning checkout via a modal launched from each game detail, while the Info for Players tab goes back to informational content. ✅ Done
* **F1-10** extend the Lightning checkout modal to full viewport height so the embedded card doesn&apos;t require scrolling. ✅ Done
* **F1-11** remove the Zap-powered reviews card from the game detail view so Community comments span the full width. ✅ Done
* **F1-12** remove all references to the "Share crew invite" action from game detail screens and related concept pages. ✅ Done
* **F1-13** add zap support to community comments: backend totals, zap button, and Lightning flow mirroring Nostr behaviour. ✅ Done
* **F1-14** remove the outdated Neon Market concept page to avoid confusion with the production frontend. ✅ Done
* **F1-15** mirror the zap totals and button in landing-page mock comments so the demo matches the real UI. ✅ Done
* **F1-16** hide lightning addresses in the UI and keep zap handling backend-driven for comments and mock data. ✅ Done
* **F1-17** change ZapButton fallback label to "LINK WALLET TO RECEIVE ZAPS" to clarify it’s for the comment author. ✅ Done
* **F1-18** in landing-page mocks, pass a fake Lightning address/LNURL for all but one comment so the zap button shows both states (active vs. fallback). ✅ Done
* **F1-19** reduce ZapButton quick amounts to [1, 10, 21, 50] sats and ensure the zap menu positions as a fixed overlay so it never gets clipped or hidden. ✅ Done
* **F1-20** change the ZapButton menu to open as a centered modal with backdrop, staying put until closed. ✅ Done
* **F1-21** redesign the Lightning checkout modal opened by the landing/game button so it presents a polished, centered layout. ✅ Done
* **F1-22** adjust Lightning checkout modal backdrop gradients so the fade covers the very top corners without harsh edges. ✅ Done
* **F1-23** allow Lightning checkout modal content to scroll internally so nothing gets clipped on smaller viewports. ✅ Done
* **F1-24** refine Lightning checkout modal backdrop using the provided radial gradient overlay. ✅ Done
* **F1-25** render Lightning checkout modals through document-level portals so their backdrops cover the full viewport. ✅ Done
* **F1-26** revert the Lightning checkout modal backdrop to a neutral slate gradient without emerald overlays. ✅ Done
* **F1-27** move the developer update feed off the storefront, reserving the space for future dev-dashboard comments. ✅ Done
* **F1-28** connect the homepage "Sign in with npub" button to the Nostr login flow so visitors can authenticate directly. ✅ Done
* **F1-29** Nostr sign-in (NIP-07) and mobile signer (NIP-46) pairing. Status: deferred. DoD: Landing widget enables extension login and mobile pairing with Nostr Connect; purchase flows remain guest-friendly with anon IDs. 
