#!/usr/bin/env bash
set -euo pipefail

retry() {
  local retries=0
  local max_retries=${1:-10}
  local delay=${2:-2}
  shift 2

  until "$@"; do
    retries=$((retries + 1))
    if [ "$retries" -ge "$max_retries" ]; then
      echo "Command failed after ${retries} attempts: $*" >&2
      return 1
    fi
    echo "Command failed. Retrying in ${delay}s..." >&2
    sleep "$delay"
  done
}

if [ "${RUN_DB_MIGRATIONS:-1}" = "1" ]; then
  retry 15 2 alembic upgrade head
fi

if [ "${RUN_SIMPLE_MVP_SEED:-0}" = "1" ]; then
  python -m proof_of_play_api.scripts.seed_simple_mvp || echo "Seed script failed (continuing startup)" >&2
fi

exec "$@"
