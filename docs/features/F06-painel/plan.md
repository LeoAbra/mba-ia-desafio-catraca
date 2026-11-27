# Plano F06 — Painel do Evento

1. `src/features/dashboard/dashboard.repo.ts` — `eventMetrics(db, event)` com uma consulta agregada (`count … FILTER`, `sum`).
2. `src/features/dashboard/dashboard.section.ts` — `dashboardSection` (order 20) para `managePageSections`, com `data-metric`.
3. Registrar a seção em `src/app.ts`.
4. Testes `tests/f06-dashboard.test.ts`.
5. Gates → PR da onda 4 → avaliação independente.
