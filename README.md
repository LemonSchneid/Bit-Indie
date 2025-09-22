# 🎮 Proof of Play — Lightning‑First Indie Game Marketplace

---

## 1. Core Vision (Simple MVP)

Proof of Play is a **Bitcoin‑native indie game store**. For the MVP we focus on:

- Lightning purchases for downloadable games.
- First‑party comments and verified‑purchase reviews.
- A small admin to keep spam down.

Nostr integrations (sign‑in, relay publishing, zap receipts) are turned off for launch and will return post‑MVP.

---

## 2. Developers

- Create listings, upload builds, and set a Lightning Address to receive payments.
- No relay publishing at launch; all data is first‑party in our DB.
- Revenue: game sales (minus platform cut). Nostr zaps are planned post‑MVP.

---

## 3. Players

- Guest checkout without creating an account; pay with any Lightning wallet.
- First‑party comments and reviews; verified badge if you purchased the game.
- Zaps and Nostr identity are planned features after MVP.

---

## 4. Proof of Play (the Platform)

- First‑party API and DB at launch; no public relay dependency.
- Revenue: sales cut; platform tips via LNURL (optional UI).

---

## 5. Content Flow (MVP)

- Game Listings → stored in first‑party DB only.
- Reviews/Comments → first‑party only; no relay sync.
- Payments → Lightning invoices to developer Lightning Addresses.
- Optional future: refundable deposits for anti‑spam.

---

## 6. Storefront Design

* **Categories**

  * **Prototypes & Jams** → *“Throw it out there, get feedback.”*
  * **Early Access** → *“Playable now, evolving with you.”*
  * **Finished Games** → *“Polished and ready.”*

* **Game Page Actions**

  * Comment → free, stored first‑party.
  * Tip/Purchase → LNURL/Lightning Address.

- Reviews → sorted by helpful_score (no zap weighting in MVP).

- Dev Profiles → show games, sales/tips summary; Nostr badges later.

---

## 7. Revenue Model

* **Game Sales** → \~10% platform cut.
* Tips → platform LNURL for direct support (optional UI).
* Optional Future → refundable deposits as a quality filter.

---

## 8. Why It’s Unique

* **Bitcoin-native economy** → sats for sales + zaps.
* **Nostr‑ready** → architecture keeps Nostr integrations behind flags, ready to switch on after MVP.

---

## 9. Launch Plan (Simple MVP)

1. Core purchase flow (guest invoices + receipt restore).
2. First‑party comments and reviews with verified‑purchase badges.
3. Developer settings (Lightning Address, builds, metadata).
4. Admin moderation + minimal rate‑limiting.
5. Download delivery via S3/R2 presigned links.
6. Telemetry and docs; deploy web/API.

---

## 10. Future Upgrades

- Re‑enable Nostr: sign‑in (NIP‑07), relay publishing, reply ingestion, zap receipts.
- Zap‑weighted reputation for reviews.
- Refundable deposit system for spam filtering.
- Native mobile client.

---

## ✅ Summary

Proof of Play = a Lightning‑first indie game marketplace. Nostr integrations are preserved in code behind feature flags and will be re‑enabled after MVP.

---

## Development Setup

This repository is a polyglot monorepo:

* `apps/web` — Next.js 14 storefront (TypeScript + Tailwind CSS).
* `apps/api` — FastAPI backend service.
* `infra` — Docker Compose stack for local dependencies (Postgres, MinIO, API).
* `scripts/dev_bootstrap.sh` — helper to build and start the stack.

To bring the stack online, run:

```bash
./scripts/dev_bootstrap.sh
```

The API listens on [http://localhost:8080](http://localhost:8080) with a `/health` endpoint. Postgres is exposed on `localhost:5432`
and MinIO on `localhost:9000` (console at `:9001`).

MVP feature flags:

- API: set `NOSTR_ENABLED=false` (default) to disable Nostr routes/services.
- Web: set `NEXT_PUBLIC_NOSTR_ENABLED=false` (default) to hide Nostr UI.
- The catalog pulls real data from the FastAPI backend; run the Docker seed script to explore the full storefront.

### Full-stack dev loop

- Start the full stack (Postgres, MinIO, FastAPI + Web) with seeded data and hot reload for Web:

  ```bash
  ./scripts/dev_bootstrap.sh
  ```

  The API container applies migrations and runs the Simple-MVP seed script on boot. The Web service runs `next dev` with your repo mounted (hot reload) and binds to `localhost:3000`, using `http://api:8080` inside the compose network. Override by setting `RUN_SIMPLE_MVP_SEED=0` in `infra/docker-compose.yml` when you no longer need the demo data.

- Alternatively, run the web app locally with the API running in another terminal:

  ```bash
  pnpm --filter web dev
  ```

  Visit `http://localhost:3000/games/starpath-siege` to exercise the seeded flow.

- To mark a seeded purchase as paid (optional), run:

  ```bash
  python -m proof_of_play_api.scripts.mark_purchase_paid --purchase-id purchase-seed-pending
  ```

- Spin up the production-style stack (hot reload off, optimized build):

  ```bash
  ./scripts/dev_prod_stack.sh
  ```

  This brings up Postgres, MinIO, API, and a `next start` web container using the build in `apps/web/Dockerfile`.
