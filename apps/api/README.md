# Bit Indie API

This directory houses the FastAPI service for the Bit Indie marketplace. For the Simple‑MVP, the API focuses on purchases, comments, reviews, and admin.

## Local development

Use Docker Compose from the repository root to build and run the API alongside its dependencies:

```bash
docker compose -f infra/docker-compose.yml up --build
```

The API listens on [http://localhost:8080](http://localhost:8080) and exposes a simple health endpoint at `/health`.

### Observability

- Logs are JSON formatted and capture the `X-Request-ID` correlation header. Provide a custom header name with the
  `REQUEST_ID_HEADER` environment variable when your ingress forwards a different identifier.
- Request lifecycle logs include method, path, response code, latency (ms), and client IP, making it easy to ship metrics from
  your log pipeline.

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

In MVP, comments and reviews are first‑party only. When expanding social features post‑MVP, plan for a shared cache (Redis) so moderation and publish actions invalidate all workers consistently.
