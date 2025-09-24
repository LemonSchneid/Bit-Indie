#!/usr/bin/env bash
set -euo pipefail

# Bootstraps the development environment by building and starting the Docker Compose stack.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/docker-compose.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Docker Compose file not found at $COMPOSE_FILE" >&2
  exit 1
fi

echo "Starting Bit Indie development stack..."
export WEB_APP_PATH="$REPO_ROOT/apps/web"
docker compose -f "$COMPOSE_FILE" up --build postgres minio api web
