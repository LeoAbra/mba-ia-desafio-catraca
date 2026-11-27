# Catraca — do brief ao produto em modo agente

MVP de venda de ingressos para eventos pequenos (shows em bar, workshops, meetups), construído **do zero, por agentes**, a partir do [brief do fundador](docs/brief.md). Cada recurso tem spec, plano e contrato, foi implementado por um agente e aprovado por **outro agente de contexto vazio** contra o contrato. Os recursos foram integrados em ondas, uma delas em paralelo via worktrees e PRs.

> Desafio do módulo *Desenvolvimento em modo agente* — MBA Engenharia de Software com IA (Full Cycle).

## Como rodar

### Pré-requisitos
- Linux ou macOS (no Windows, Git Bash ou WSL) com **Docker** (Compose v2), **Git** e **Node.js LTS**.
- Nada mais: Postgres e o app rodam em contêiner, e o gateway de pagamento é simulado (sem chave real).

### Comandos
| O quê | Comando |
|---|---|
| **Subir** tudo (build, migrações e seed incluídos) | `./scripts/up.sh` |
| **Derrubar** tudo que a subida iniciou | `./scripts/down.sh` (`--clean` também apaga o volume do banco) |
| **Gates** (typecheck + checagem de artefatos + 122 testes automatizados) | `./scripts/gates.sh` |
| Fluxo do avaliador automatizado (passos 2–16; `--harness` inclui o 17) | `./scripts/evaluator-flow.sh` |

```bash
git clone https://github.com/LeoAbra/mba-ia-desafio-catraca.git && cd mba-ia-desafio-catraca
./scripts/up.sh          # produto em http://localhost:3000, com a seed
./scripts/gates.sh       # Postgres efêmero próprio, nenhuma porta no host
./scripts/down.sh        # nenhum contêiner do projeto nem porta aberta depois disso
```

Variáveis opcionais: `CATRACA_PORT` (porta no host, padrão `3000`) e `COMPOSE_PROJECT_NAME` (padrão `catraca`), usadas para subir instâncias isoladas em paralelo (cada avaliação usou as suas).

## Endereços

| | Endereço |
|---|---|
| Produto (`$WEB`) | `http://localhost:3000` |
| API de parceiros (`$API`) | `http://localhost:3000` — rotas em `/api/partner/...` |
| Healthcheck | `http://localhost:3000/health` |

## Credenciais

Criadas pela seed em todo boot (idempotente: subir de novo não falha nem duplica).

| Conta | E-mail | Senha |
|---|---|---|
| Organizador A | `organizador.a@catraca.dev` | `catraca123` |
| Organizador B | `organizador.b@catraca.dev` | `catraca123` |
| Participante da seed | `participante@catraca.dev` | `catraca123` |
| **Chave de parceiro** (`X-Api-Key`, `$KEY`) | `catraca-parceiro-2026` | — |

Participantes novos se cadastram em `/cadastro`. Organizadores só vêm da seed.

## Mapa dos artefatos

| Artefato | Onde |
|---|---|
| Brief (enunciado transcrito, R01–R13) | [`docs/brief.md`](docs/brief.md) |
| **PRD** (7 features com Provides/Consumes, grafo, ondas, critérios por feature, 14 critérios cross-feature, fora de escopo, rastreabilidade R01–R13) | [`docs/PRD.md`](docs/PRD.md) |
| **Estado do projeto** (status e relatório mais recente por feature) | [`docs/state.json`](docs/state.json) |
| **`AGENTS.md`** (porta de entrada dos agentes; `CLAUDE.md` aponta para ele) | [`AGENTS.md`](AGENTS.md) · [`CLAUDE.md`](CLAUDE.md) |
| Processo e templates (contrato, relatório) | [`docs/harness/`](docs/harness/) |
| Definição do agente avaliador | [`.claude/agents/evaluator.md`](.claude/agents/evaluator.md) |
| Fluxo do avaliador automatizado | [`scripts/evaluator-flow.sh`](scripts/evaluator-flow.sh) |

### Features (spec, plano, contrato e relatórios)

| ID | Feature | Onda | Pasta | Relatórios | PR |
|---|---|---|---|---|---|
| F01 | Fundação e Contas | 1 | [`docs/features/F01-fundacao-contas/`](docs/features/F01-fundacao-contas/) | [reprovado](docs/features/F01-fundacao-contas/reports/eval-20261127T162738Z.md) → corrigido → [aprovado](docs/features/F01-fundacao-contas/reports/eval-20261127T163116Z.md) | [#1](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/1) |
| F02 | Gestão de Eventos | 2 | [`docs/features/F02-gestao-eventos/`](docs/features/F02-gestao-eventos/) | [aprovado](docs/features/F02-gestao-eventos/reports/eval-20261127T163546Z.md) | [#2](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/2) |
| F03 | Compra e Gateway | 3 | [`docs/features/F03-compra-gateway/`](docs/features/F03-compra-gateway/) | [aprovado](docs/features/F03-compra-gateway/reports/eval-20261127T164114Z.md) | [#3](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/3) |
| F04 | API de Parceiros | **4 (paralela)** | [`docs/features/F04-api-parceiros/`](docs/features/F04-api-parceiros/) | [aprovado](docs/features/F04-api-parceiros/reports/eval-20261127T164944Z.md) | [#5](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/5) |
| F05 | Check-in | **4 (paralela)** | [`docs/features/F05-checkin/`](docs/features/F05-checkin/) | [aprovado](docs/features/F05-checkin/reports/eval-20261127T164945Z.md) | [#6](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/6) |
| F06 | Painel do Evento | **4 (paralela)** | [`docs/features/F06-painel/`](docs/features/F06-painel/) | [aprovado](docs/features/F06-painel/reports/eval-20261127T164944Z.md) | [#4](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/4) |
| F07 | Cancelamento de Evento | 5 | [`docs/features/F07-cancelamento/`](docs/features/F07-cancelamento/) | [aprovado](docs/features/F07-cancelamento/reports/eval-20261127T170001Z.md) | [#7](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/7) |

### Onda paralela (onda 4: F04, F05, F06)

PRs: [#4 F06](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/4) · [#5 F04](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/5) · [#6 F05](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/6)

Cada feature teve sua branch num `git worktree` próprio (`catraca-wt/F04`, `F05`, `F06`) e um agente implementador próprio, rodando ao mesmo tempo. Commits de cada PR (horário do commit, UTC):

| PR | 1º commit | Commits de implementação | Último commit de código |
|---|---|---|---|
| #5 F04 | `9fe0753` 16:45:46 | `891c4df` 16:47:21 | `6dfac29` 16:48:39 |
| #6 F05 | `795b7da` 16:45:50 | `3bcff6e` 16:47:59 | `66d0d2f` 16:48:05 |
| #4 F06 | `2271919` 16:45:54 | `5b1ee22` 16:47:45 | `a399037` 16:48:10 |

O primeiro commit de cada PR (16:45:46–16:45:54) é anterior ao último commit dos outros (≥ 16:48:05). Para conferir: `gh api repos/LeoAbra/mba-ia-desafio-catraca/pulls/<n>/commits --jq '.[] | .commit.committer.date + " " + .sha[0:7]'`. Houve conflito de merge em `src/app.ts` (as três features registram seus blocos no mesmo ponto da raiz de composição), resolvido mantendo os três blocos nos commits de merge dos PRs #6 e #5.

## Decisões

### Pilha e por quê
**Node.js 22 + TypeScript + Express 5 (HTML renderizado no servidor) + PostgreSQL 16 (`pg`, SQL puro), Vitest + Supertest, Docker Compose.**
- A máquina do avaliador tem só Node, Docker e Git: o app é Node, e o Postgres roda em contêiner.
- HTML renderizado no servidor, sem build de front: as telas são simples (não há critério de design), e tudo é verificável com `curl`, o que deixa os contratos executáveis por um agente avaliador.
- Postgres porque as duas regras difíceis (R07 e R11) são **regras de transação**: o banco é o lugar certo para garanti-las.
- Cada feature fica em `src/features/<nome>/`. As integrações entre features passam por pontos de extensão explícitos (`src/shared/extensions.ts`: seções da página de gerenciamento, seções da página pública, guardas de lotação) e por uma raiz de composição única (`src/app.ts`).

### Como R07 foi garantido sob concorrência
- Toda compra (vitrine ou API) passa por `purchaseTicket` ([`purchase.service.ts`](src/features/purchases/purchase.service.ts)), que abre uma transação e começa com `SELECT … FROM events WHERE id = $1 FOR UPDATE`.
- Com a linha do evento travada, a compra conta as vagas ocupadas (`pending` + `confirmed`), compara com a lotação e insere o ingresso.
- Compras simultâneas do mesmo evento são **serializadas pelo Postgres**: a seguinte só conta depois do `COMMIT` da anterior.
- Edição de lotação (R03) e cancelamento (R11) travam a mesma linha, então também enxergam um estado estável.
- Não existe contador desnormalizado que possa divergir: a verdade é a tabela `tickets`.

**Prova:**
- [`tests/f03-concurrency.test.ts`](tests/f03-concurrency.test.ts): 3 rodadas × 30 compras simultâneas em lotação 5 → exatamente 5 sucessos e 25 esgotados, e `count(*) ≤ lotação` no banco.
- [`tests/f04-partner-api.test.ts`](tests/f04-partner-api.test.ts): 2 rodadas × 30 requisições HTTP simultâneas → 5 × `202` e 25 × `409`.
- [`tests/f07-cancellation.test.ts`](tests/f07-cancellation.test.ts): cancelamento no meio de uma rajada nunca deixa ingresso ativo.
- O passo 15 do fluxo, rodado várias vezes em eventos novos com `curl | xargs -P 30`, deu sempre 5 × `202` e 25 × `409`.

### Como a resposta assíncrona do gateway foi implementada
1. A transação da compra grava o ingresso `pending` e um `payments(status='processing')`, e faz `COMMIT`. A resposta HTTP sai na hora (R06).
2. Depois do commit, o `PaymentProcessor` ([`payments.processor.ts`](src/features/purchases/payments.processor.ts)) dispara a cobrança em segundo plano no `SimulatedGateway` ([`gateway.ts`](src/features/purchases/gateway.ts)). O gateway decide pelo final do cartão e espera o tempo do brief (2–5 s ou 30–40 s).
3. A resposta é aplicada com `UPDATE tickets SET status = 'confirmed'|'declined' WHERE id = $1 AND status = 'pending'` (R08). **A condição `status = 'pending'` é o que garante R11**: se o evento foi cancelado no meio, o ingresso já é `cancelled`/`refunded` e a resposta tardia não muda nada (fica só registrada em `payments`).
4. No boot, `resumePending()` redispara cobranças que ficaram `processing` (reinício no meio). O sistema guarda só os 4 últimos dígitos do cartão.
5. O cancelamento ([`cancel.service.ts`](src/features/cancellation/cancel.service.ts)) usa **um único** `UPDATE … SET status = CASE WHEN status='confirmed' THEN 'refunded' ELSE 'cancelled' END`. Assim, uma confirmação concorrente nunca escapa entre dois statements.
6. O modo padrão usa os tempos do brief (`GATEWAY_DELAY_SCALE=1`). Só o ambiente dos gates (`docker-compose.gates.yml`) encolhe os atrasos 100× (`0.01`), para os testes rodarem em segundos.

### Como a avaliação foi isolada da implementação
- **Contrato antes do código:** o `contract.md` de cada feature foi escrito a partir do PRD e commitado como **primeiro commit** da branch, antes da implementação.
- **Outro agente, contexto vazio:** cada avaliação foi um subagente novo do Claude Code (ferramenta `Agent`, modelo `claude-sonnet-5-5`), sem acesso à conversa do implementador. Ele recebeu só o caminho do contrato, o commit e as instruções de [`.claude/agents/evaluator.md`](.claude/agents/evaluator.md).
- **Checkout próprio do commit avaliado:** o avaliador trabalhou num `git worktree` destacado (`catraca-eval/Fxx`), com instância própria (`COMPOSE_PROJECT_NAME=eval-fxx`, porta 31xx). Exercitou o sistema real com `curl` e registrou evidência por item. Não podia editar código nem commitar.
- **Implementadores independentes na onda paralela:** F04, F05 e F06 foram implementadas por três subagentes, cada um no seu worktree. A integração e a resolução de conflitos foram feitas na sessão principal.
- **Relatórios imutáveis:** cada avaliação gera um arquivo novo `reports/eval-<timestamp>.md`, commitado sozinho e nunca alterado. A F01 foi **reprovada** na primeira avaliação (2 itens), corrigida com teste de regressão e reaprovada por um avaliador novo. Os dois relatórios estão no histórico. Conferência: `git log --format="%h %ad" --date=iso -- <relatório>` mostra um único commit.

## Fluxo do avaliador

[`scripts/evaluator-flow.sh`](scripts/evaluator-flow.sh) executa os passos 2 a 16 do Fluxo do avaliador com `curl` (81 verificações) contra o produto no ar, e o passo 17 com `--harness`. A validação final rodou num contêiner Linux, a partir de um clone limpo da `main` no GitHub. O resultado está registrado em [`docs/validation/`](docs/validation/).

## Estrutura

```
src/
  app.ts                 raiz de composição (liga as features)
  server.ts              boot: migrações, seed, servidor, desligamento limpo
  features/
    accounts/            F01 cadastro, login, sessão, guardas, seed
    events/              F02 eventos, vitrine, página de gerenciamento
    purchases/           F03 compra, vagas, gateway simulado, pagamentos
    partner-api/         F04 API de parceiros
    checkin/             F05 check-in (R10)
    dashboard/           F06 painel (R12)
    cancellation/        F07 cancelamento (R11)
  shared/                html, layout, dinheiro, datas, ids, extensões
db/migrations/           SQL por feature
tests/                   Vitest + Supertest (unitário, integração, concorrência)
scripts/                 up, down, gates, check-artifacts, evaluator-flow
docs/                    brief, PRD, features, estado, processo
```
