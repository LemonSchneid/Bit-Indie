# 🎮 Bit Indie — Lightning‑First Indie Game Marketplace

---

## 1. Core Vision (Simple MVP)

Bit Indie is a **Bitcoin‑native indie game store**. For the MVP we focus on:

- Lightning purchases for downloadable games.
- First‑party comments and verified‑purchase reviews.
- A small admin to keep spam down.

Legacy social integrations have been removed so the MVP ships with a purely first‑party experience.

---

## 2. Developers

- Create listings, upload builds, and set a Lightning Address to receive payments.
- Use the `/admin` developer console to edit drafts, monitor publish readiness, and manage payout settings.
- All data is first‑party in our database with no external service dependencies.
- Revenue: game sales (minus platform cut).

---

## 3. Players

- Guest checkout without creating an account; pay with any Lightning wallet.
- First‑party comments and reviews; verified badge if you purchased the game.
- Lightning identity and optional accounts will arrive after the MVP.

---

## 4. Bit Indie (the Platform)

- First‑party API and database power the entire experience.
- Revenue: sales cut; platform tips via LNURL (optional UI).

---

## 5. Content Flow (MVP)

- Game Listings → stored in first‑party DB only.
- Reviews/Comments → first‑party only with built-in anti-spam checks.
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

- Reviews → sorted by helpful_score computed from first-party interactions.

- Dev Profiles → show games plus Lightning payout details.

---

## 7. Revenue Model

* **Game Sales** → \~10% platform cut.
* Tips → platform LNURL for direct support (optional UI).
* Optional Future → refundable deposits as a quality filter.

---

## 8. Why It’s Unique

* **Bitcoin-native economy** → sats for sales and in-house rewards.
* **Focused surface area** → reduced scope keeps the MVP fast and maintainable.

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

- Lightning-native accounts and richer social features.
- Expanded reputation systems for reviews.
- Refundable deposit system for spam filtering.
- Native mobile client.

---

## ✅ Summary

Bit Indie = a Lightning‑first indie game marketplace. Legacy social integrations have been removed so the MVP stays lean and reliable.

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

- The catalog pulls real data from the FastAPI backend; run the Docker seed script to explore the full storefront.

### Updating payment environment variables

- The API container reads Lightning settings from `.env` (or `.env.example` during initial setup).
- After changing `OPENNODE_API_KEY` or `OPENNODE_TREASURY_WALLET`, recreate the API service so it loads the new values:

  ```bash
  docker compose -f infra/docker-compose.yml up -d --force-recreate api
  ```

- Confirm the running container sees the values:

  ```bash
  docker compose -f infra/docker-compose.yml exec api env | grep OPENNODE_
  ```

### Configuring webhook callbacks

- Set `OPENNODE_WEBHOOK_SECRET` to the value from your OpenNode dashboard when running in production. The API rejects unsigned callbacks.
- During local development, expose the API with a tunnel (for example `ngrok http 8080`) and point the OpenNode webhook URL to `https://<your-tunnel>/v1/purchases/opennode/webhook` so Lightning charges flip to PAID automatically.
- In production keep the webhook under HTTPS (e.g. `https://api.example.com/v1/purchases/opennode/webhook`) and rotate the secret periodically. Client polling remains as a fallback if the webhook is delayed.

### Observability quick start

- API logs are emitted as structured JSON and include the `X-Request-ID` correlation header by default. Override the header name
  with `REQUEST_ID_HEADER` if your ingress already sets a different identifier.
- The request logger captures method, path, status code, latency, and client IP so you can stream metrics into your preferred
  log pipeline without additional adapters.
- Keep uptime checks pointed at `/health`; FastAPI returns `{ "status": "ok" }` when the service is ready.

### Full-stack dev loop

- Start the full stack (Postgres, MinIO, FastAPI + Web) with seeded data and hot reload for Web:

  ```bash
  ./scripts/dev_bootstrap.sh
  ```

  The API container applies migrations and runs the Simple-MVP seed script on boot. The Web service runs `next dev` with your repo mounted (hot reload) and binds to `localhost:3000`, using `http://api:8080` inside the compose network. Override by setting `RUN_SIMPLE_MVP_SEED=0` in `infra/docker-compose.yml` when you no longer need the demo data. Only the development web container is started by default; the production build stays behind a Compose profile to avoid port conflicts during local work.

- Alternatively, run the web app locally with the API running in another terminal:

  ```bash
  pnpm --filter web dev
  ```

  Visit `http://localhost:3000/games/starpath-siege` to exercise the seeded flow.

- To mark a seeded purchase as paid (optional), run:

  ```bash
  python -m bit_indie_api.scripts.mark_purchase_paid --purchase-id purchase-seed-pending
  ```

- Spin up the production-style stack (hot reload off, optimized build):

  ```bash
  ./scripts/dev_prod_stack.sh
  ```

  This brings up Postgres, MinIO, API, and a `next start` web container using the build in `apps/web/Dockerfile`, enabling the Compose `prod` profile under the hood.
