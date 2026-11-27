#!/usr/bin/env bash
# Gates do projeto: typecheck + checagem de artefatos + testes automatizados (unitários,
# integração HTTP e concorrência) contra um Postgres efêmero. Não usa nem altera o ambiente do up.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="${COMPOSE_PROJECT_NAME:-catraca}-gates"
COMPOSE=(docker compose -p "$PROJECT" -f docker-compose.gates.yml)
cleanup() { "${COMPOSE[@]}" down --remove-orphans --volumes >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${COMPOSE[@]}" build gates
"${COMPOSE[@]}" run --rm gates
echo "Gates OK."
