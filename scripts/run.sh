#!/usr/bin/env bash
# RPG Arena on http://localhost:5175 (API reference at /docs).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f infra/docker-compose.yml up --build "$@"
