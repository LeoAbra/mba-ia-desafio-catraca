#!/usr/bin/env bash
# Derruba tudo que o up.sh iniciou (contêineres e rede). Os dados ficam no volume;
# use --clean para apagar o volume também.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="${COMPOSE_PROJECT_NAME:-catraca}"
if [[ "${1:-}" == "--clean" ]]; then
  docker compose -p "$PROJECT" down --remove-orphans --volumes
else
  docker compose -p "$PROJECT" down --remove-orphans
fi
echo "Catraca derrubado (projeto ${PROJECT})."
