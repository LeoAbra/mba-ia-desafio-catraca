# AGENTS.md — porta de entrada dos agentes

Catraca: venda de ingressos para eventos pequenos. Leia este arquivo antes de qualquer tarefa.

## Comandos do harness

| O quê | Comando | Observações |
|---|---|---|
| Subir tudo | `./scripts/up.sh` | Docker Compose (Postgres + app). Migrações e seed rodam no boot. Produto em `http://localhost:3000`. |
| Derrubar tudo | `./scripts/down.sh` | Remove contêineres e rede do projeto. `--clean` também apaga o volume do banco. |
| Gates | `./scripts/gates.sh` | Typecheck + checagem de artefatos + testes (Vitest + Supertest) num Postgres efêmero, sem porta no host. Precisa passar antes de declarar qualquer trabalho pronto. |

- Variáveis opcionais: `CATRACA_PORT` (porta no host, padrão `3000`) e `COMPOSE_PROJECT_NAME` (padrão `catraca`). Use as duas para subir instâncias isoladas em paralelo (ex.: avaliações de worktrees diferentes).
- Não rode o app direto no host (`node`, `tsx`) para validar comportamento: use `./scripts/up.sh`.
- Seed (idempotente, roda em todo boot): ver credenciais no [README](README.md#credenciais).

## Regras do projeto

1. **Rastreabilidade:** toda mudança de comportamento cita a regra (R01–R13) do [brief](docs/brief.md) e o critério do [PRD](docs/PRD.md) que atende.
2. **Fluxo SDD:** PRD → `spec.md` + `plan.md` + `contract.md` da feature → implementação na branch `feat/Fxx-*` → gates → avaliação independente → correção → nova avaliação. Templates em [`docs/harness/`](docs/harness/).
3. **Quem implementa não avalia.** A avaliação é feita por um agente de contexto vazio (ver [`.claude/agents/evaluator.md`](.claude/agents/evaluator.md)), que gera um relatório **novo** em `docs/features/Fxx-*/reports/`. Relatórios nunca são editados depois do commit que os criou; falha gera correção e um relatório novo.
4. **Estado:** [`docs/state.json`](docs/state.json) registra status e o relatório mais recente de cada feature. Atualize-o ao terminar cada etapa.
5. **Regras de negócio críticas ficam no banco/serviço, não na UI:** lotação (R07) é garantida com `SELECT … FOR UPDATE` na linha do evento; respostas do gateway só se aplicam a ingressos ainda `pending` (R11).
6. **Contrato da API de parceiros é fixo** (ver brief): não renomeie campos, status HTTP nem códigos de erro.
7. **Gateway:** o modo padrão é o simulado do brief. `GATEWAY_DELAY_SCALE` (padrão `1`) só pode ser alterado no ambiente de testes (`docker-compose.gates.yml`).
8. Nunca commite `.env` nem segredos. Não crie arquivos temporários na raiz do repo.

## Código

- Stack: Node.js 22 + TypeScript + Express 4 (HTML renderizado no servidor) + PostgreSQL 16 (`pg`). Testes: Vitest + Supertest.
- `src/app.ts` é a raiz de composição: cria pool, serviços e registra os routers das features.
- Cada feature vive em `src/features/<nome>/`. Pontos de extensão entre features ficam em `src/shared/extensions.ts`.
- Migrações SQL em `db/migrations/NNN_fxx_descricao.sql` (aplicadas em ordem no boot, sob advisory lock).
- HTML sempre via o template `html\`` de `src/shared/html.ts` (escapa interpolações).
- Toda função nova de regra de negócio ganha teste; correção de bug ganha teste de regressão.

## Mapa dos artefatos

| Artefato | Caminho |
|---|---|
| Brief (enunciado) | [`docs/brief.md`](docs/brief.md) |
| PRD | [`docs/PRD.md`](docs/PRD.md) |
| Feature (spec, plano, contrato, relatórios) | `docs/features/Fxx-<nome>/{spec.md,plan.md,contract.md,reports/}` |
| Estado do projeto | [`docs/state.json`](docs/state.json) |
| Templates do processo | [`docs/harness/`](docs/harness/) |
| Agente avaliador | [`.claude/agents/evaluator.md`](.claude/agents/evaluator.md) |
| Fluxo do avaliador automatizado | [`scripts/evaluator-flow.sh`](scripts/evaluator-flow.sh) |
