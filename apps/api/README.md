# Proof of Play API

This directory houses the FastAPI service for the Proof of Play marketplace. The app is intentionally minimal at this stage and
will expand as future tickets implement authentication, games, and purchase logic.

## Local development

Use Docker Compose from the repository root to build and run the API alongside its dependencies:

```bash
docker compose -f infra/docker-compose.yml up --build
```

The API listens on [http://localhost:8080](http://localhost:8080) and exposes a simple health endpoint at `/health`.

## Database migrations

The service uses Alembic for schema migrations. After installing the API dependencies (`pip install -e .[dev]` from this
directory), apply the latest migrations with:

```bash
export DATABASE_URL=postgresql+psycopg://pop:devpass@localhost:5432/pop
alembic upgrade head
```

Alternatively, set the `PG_*` environment variables shown in `.env.example` before running Alembic.

## Scaling considerations

The comment thread service keeps an in-memory cache of merged first-party comments and ingested Nostr replies. When we scale the
API to run with multiple worker processes, swap the module-level singleton for a dependency-injected service backed by a shared
cache (Redis or Memcached) so moderation and publish actions invalidate all workers consistently.
