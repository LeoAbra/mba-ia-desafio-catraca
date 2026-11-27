#!/usr/bin/env bash
# Sobe o produto completo (Postgres + app). Migrações e seed rodam no boot do app.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="${COMPOSE_PROJECT_NAME:-catraca}"
PORT="${CATRACA_PORT:-3000}"
docker compose -p "$PROJECT" up -d --build --wait
echo "Catraca no ar: http://localhost:${PORT}  (API de parceiros: http://localhost:${PORT}/api/partner)"
