# Proof of Play API

This directory houses the FastAPI service for the Proof of Play marketplace. The app is intentionally minimal at this stage and
will expand as future tickets implement authentication, games, and purchase logic.

## Local development

Use Docker Compose from the repository root to build and run the API alongside its dependencies:

```bash
docker compose -f infra/docker-compose.yml up --build
```

The API listens on [http://localhost:8080](http://localhost:8080) and exposes a simple health endpoint at `/health`.
