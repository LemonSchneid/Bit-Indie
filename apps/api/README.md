# Bit Indie API

This directory houses the FastAPI service for the Bit Indie marketplace. For the Simple‑MVP, Nostr features are disabled and the API focuses on purchases, comments, reviews, and admin.

## Local development

Use Docker Compose from the repository root to build and run the API alongside its dependencies:

```bash
docker compose -f infra/docker-compose.yml up --build
```

The API listens on [http://localhost:8080](http://localhost:8080) and exposes a simple health endpoint at `/health`.

Feature flags:

- `NOSTR_ENABLED=false` (default) disables Nostr auth/ingestion routes.

### Seed demo data

- When running via Docker (`./scripts/dev_bootstrap.sh`), migrations and the `seed_simple_mvp` script run automatically. Disable by setting `RUN_SIMPLE_MVP_SEED=0` in `infra/docker-compose.yml`.
- For manual runs, execute `python -m bit_indie_api.scripts.seed_simple_mvp` to seed the demo developer/game/comments/purchases.
- Use `python -m bit_indie_api.scripts.mark_purchase_paid --purchase-id <id>` to flip a specific purchase to `PAID` during manual testing.

## Database migrations

The service uses Alembic for schema migrations. After installing the API dependencies (`pip install -e .[dev]` from this
directory), apply the latest migrations with:

```bash
export DATABASE_URL=postgresql+psycopg://pop:devpass@localhost:5432/pop
alembic upgrade head
```

Alternatively, set the `PG_*` environment variables shown in `.env.example` before running Alembic.

## Scaling considerations

In MVP, comments and reviews are first‑party only (no relay ingestion). When adding Nostr back post‑MVP, replace any in‑memory caches with a shared cache (Redis) so moderation and publish actions invalidate all workers consistently.
