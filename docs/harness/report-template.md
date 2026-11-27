# Template de relatório de avaliação

Adaptado de `evaluator/references/report-template.md` (Full Cycle). Um arquivo novo por avaliação, `docs/features/Fxx-*/reports/eval-<YYYYMMDDTHHMMSSZ>.md`; nunca editado depois de commitado.

```markdown
# Relatório de avaliação — Fxx <Nome>

| Campo | Valor |
|---|---|
| Data (UTC) | <ISO 8601> |
| Commit avaliado | `<sha completo>` (branch `<branch>`) |
| Contrato | `docs/features/Fxx-*/contract.md` |
| Ferramenta | Claude Code — subagente avaliador (contexto vazio, ferramenta Agent) |
| Modelo | <id do modelo> |
| Ambiente | <COMPOSE_PROJECT_NAME / porta / SO> |
| Veredito | APROVADO | REPROVADO |
| Itens | <P> PASS · <F> FAIL · <B> BLOCKED (de <total>) |

## Quality gates
- ✓/✗ `./scripts/gates.sh` — exit <n> — <resumo>

## Pré-requisitos
- ✓/✗ <condição> — <evidência curta>

## Mapa de cobertura
| Critério | Itens | Resultado |
|---|---|---|

## Itens
### `<ID>` — <rótulo>
**Veredito:** PASS | FAIL | BLOCKED
- ✓/✗ <observação do then> — esperado `<E>` · observado `<O>`

<details><summary>Evidência</summary>

```
<comando executado e saída / resposta HTTP / trecho de HTML>
```
</details>

## Falhas e causa provável
<lista ou "nenhuma">
```
