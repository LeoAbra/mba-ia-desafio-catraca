# Processo de desenvolvimento em modo agente

Adaptado das skills do curso (repositório `devfullcycle/mba-ia-videomax-harness-scaffold`: `prd-writer`, `spec-writer`, `implement-feature`, `evaluator`, `fix-runner`, `implement-and-evaluate`). Aqui elas viram um processo documentado, executado com Claude Code.

```
brief ──prd-writer──▶ PRD (features, Provides/Consumes, grafo, ondas, ACs, cross-feature)
                        │
              spec-writer (por feature)
                        ▼
         spec.md + plan.md + contract.md   (commit 1 da branch feat/Fxx-*)
                        │
              implementador (agente A)
                        ▼
                código + testes + gates verdes ──▶ PR
                        │
              avaliador (agente B, contexto vazio)
                        ▼
         reports/eval-<timestamp>.md  (imutável, 1 commit)
                        │
        FAIL? ──▶ fix (agente A) ──▶ nova avaliação (agente B novo) ──▶ novo relatório
        PASS  ──▶ docs/state.json: status=done, report_path=<último relatório>
```

## Regras

1. **Contrato antes do código.** `contract.md` é gerado do PRD (não do código) e mapeia cada critério da feature (e os cross-feature de que ela é dona) para itens verificáveis.
2. **Isolamento da avaliação.** O avaliador é um subagente novo (ferramenta `Agent` do Claude Code, sem herdar a conversa do implementador). Ele recebe só: o caminho do contrato, o commit a avaliar e as instruções de [`.claude/agents/evaluator.md`](../../.claude/agents/evaluator.md). Ele não edita código.
3. **Relatório imutável.** Cada avaliação cria um arquivo novo `reports/eval-<YYYYMMDDTHHMMSSZ>.md`, commitado sozinho. Conferência: `git log --format="%h %ad" --date=iso -- <relatório>` mostra um único commit.
4. **Instâncias isoladas.** Avaliações paralelas usam `COMPOSE_PROJECT_NAME` e `CATRACA_PORT` distintos.
5. **Onda paralela.** Features da mesma onda são implementadas ao mesmo tempo em `git worktree`s, cada uma na sua branch, e integradas à `main` por PRs. O primeiro commit de cada branch (spec/plano/contrato) é feito antes do último commit das outras.
6. **Regressão entre features.** Ao final, o Fluxo do avaliador (`scripts/evaluator-flow.sh`) roda contra a `main` a partir de um clone limpo.

Templates: [contrato](contract-template.md) · [relatório](report-template.md).
