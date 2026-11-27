# Template de contrato (`contract.md`)

Adaptado de `spec-writer/references/contract-template.md` (Full Cycle). O contrato descreve só comportamento observável na borda da feature; serve de checklist para quem implementa e de asserções para quem avalia.

```markdown
# Contrato: Fxx <Nome>

## Pré-requisitos
**Serviços:** <processos que precisam estar no ar e como subir>
**Estado persistente:** <contas, eventos, ingressos que precisam existir — o quê, não como>
**Configuração:** <variáveis de ambiente>
**Dependências externas:** <ferramentas: curl, jq…>

## Quality gates
- **gates** — `./scripts/gates.sh` — typecheck, artefatos e testes passam

## Mapa de cobertura
| Critério do PRD (ID + texto) | Itens |
|---|---|
| AC-Fxx-01 <texto literal> | API-XXX-01, UI-XXX-02 |
| X0n (Fa→Fb) <texto literal> | E2E-XXX-01 |

## <Superfície: HTTP API | UI | Worker | E2E>
**Modo de verificação:** <como exercitar>

### <Capacidade>
#### `UI-CAPACIDADE-01` — <rótulo>
- given: <pré-condição declarativa>
- when: <uma ação atômica>
- then:
  - <consequência observável>
- notes: <opcional>
```

Regras:
- ID do item: `<SUPERFÍCIE>-<CAPACIDADE>-<NN>`; superfícies `API`, `UI`, `WRK`, `E2E`.
- Todo critério da feature no PRD e todo cross-feature marcado `[contrato Fxx]` aparece no mapa com ≥ 1 item.
- `then` com até ~5 observações atômicas.
