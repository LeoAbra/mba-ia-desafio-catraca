# Plano F01 — Fundação e Contas

1. **Harness:** `Dockerfile` (estágios `runtime` e `gates`), `docker-compose.yml` (db + app com healthcheck), `docker-compose.gates.yml`, `scripts/up.sh`, `scripts/down.sh`, `scripts/gates.sh`, `scripts/check-artifacts.mjs`.
2. **Config e banco:** `src/config.ts` (única leitura de `process.env`), `src/db/pool.ts` (pool + `withTransaction`), `src/db/migrate.ts` (advisory lock, tabela `schema_migrations`).
3. **Migração `001_f01_accounts.sql`:** `users`, `sessions`.
4. **Compartilhados:** `src/shared/html.ts` (template que escapa), `src/shared/layout.ts` (nav por papel), `src/shared/ids.ts` (ids e tokens aleatórios), `src/shared/extensions.ts` (registro de extensões, vazio por enquanto).
5. **Contas:** `src/features/accounts/` — `passwords.ts`, `users.repo.ts`, `sessions.ts` (middleware que carrega `req.user`), `guards.ts`, `accounts.router.ts`, `seed.ts`.
6. **Composição:** `src/app.ts` (`createApp`), `src/server.ts` (migra, semeia, escuta, encerra limpo em SIGTERM).
7. **Testes:** `tests/helpers.ts` (reset de banco, agente com cookie), `tests/f01-accounts.test.ts`.
8. **Gates verdes** → PR `feat/F01-fundacao-contas` → avaliação independente → merge.
