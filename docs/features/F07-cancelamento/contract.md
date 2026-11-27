# Contrato: F07 Cancelamento de Evento

## Pré-requisitos
**Serviços:** produto no ar via `./scripts/up.sh` em modo padrão; `$WEB` = `$API` = `http://localhost:<porta>`.
**Estado persistente:** organizadores A e B e participante da seed (senha `catraca123`). Eventos criados/publicados pela UI (F02); ingressos pela API de parceiros (F04) e pela vitrine (F03).
**Configuração:** `$KEY` = `catraca-parceiro-2026`.
**Dependências externas:** `curl`, `bash`, `docker compose exec` (consulta ao banco).

## Quality gates
- **gates** — `./scripts/gates.sh` — typecheck, check-artifacts e testes (incluindo `tests/f07-cancellation.test.ts`) passam

## Mapa de cobertura
| Critério do PRD | Itens |
|---|---|
| AC-F07-01 O organizador dono cancela um evento publicado pela página de gerenciamento; rascunho ou evento de outro organizador não pode ser cancelado (R11, R13). | UI-CANCEL-01, UI-CANCEL-02, UI-CANCEL-03 |
| AC-F07-02 O cancelamento é irreversível: o evento cancelado não pode ser republicado, editado nem cancelado de novo (R11). | UI-CANCEL-04 |
| AC-F07-03 Evento cancelado sai da vitrine e não vende mais (R02, R11). | E2E-CANCEL-01 |
| AC-F07-04 Em até 10 segundos do cancelamento, os ingressos confirmados ficam estornados e os pendentes ficam cancelados (R11). | E2E-CANCEL-02 |
| AC-F07-05 Resposta do gateway que chega depois do cancelamento não muda o status de nenhum ingresso (R11). | E2E-CANCEL-03 |
| X10 (F02→F07) Depois do cancelamento, a página de gerenciamento de F02 não oferece edição nem publicação e recusa a edição enviada diretamente; o evento some da vitrine e da página pública de F02 (R11). | UI-CANCEL-04, E2E-CANCEL-01 |
| X11 (F03→F07) O cancelamento migra os ingressos de F03 (confirmados→estornados, pendentes→cancelados) em ≤ 10 s; uma resposta tardia do gateway de F03 (cartão `0003`) não altera o ingresso cancelado; compra pela vitrine é recusada (R05, R11). | E2E-CANCEL-01, E2E-CANCEL-02, E2E-CANCEL-03 |
| X12 (F04→F07) Evento cancelado some de `GET /api/partner/events`; a compra pela API responde `404 event_not_available`; `GET /api/partner/tickets/{id}` mostra `refunded` e `cancelled` (R11). | E2E-CANCEL-01, E2E-CANCEL-02 |
| X13 (F05→F07) Check-in de um ingresso de evento cancelado resulta em `Evento cancelado`, inclusive para ingresso que estava confirmado (R10, R11). | E2E-CANCEL-04 |
| X14 (F06→F07) Depois do cancelamento, o painel mostra Confirmados 0, Pendentes 0, Vagas disponíveis 0, Receita R$ 0,00 e Estornados igual aos confirmados de antes (R11, R12). | E2E-CANCEL-05 |

## UI
**Modo de verificação:** HTTP com cookie jar; cancelar = `POST /organizador/eventos/<id>/cancelar` (botão "Cancelar evento" da página de gerenciamento).

### Cancel
#### `UI-CANCEL-01` — dono cancela publicado
- given: evento publicado E de A
- when: `GET /organizador/eventos/<E>` e depois `POST /organizador/eventos/<E>/cancelar` como A
- then:
  - a página antes do cancelamento tem o formulário `/organizador/eventos/<E>/cancelar`
  - o POST responde `302` para `/organizador/eventos/<E>?aviso=cancelado`
  - a página passa a mostrar o status "Cancelado"

#### `UI-CANCEL-02` — rascunho não cancela
- given: evento em rascunho D de A
- when: `POST /organizador/eventos/<D>/cancelar` como A
- then:
  - `409` com "Só evento publicado pode ser cancelado"
  - D continua "Rascunho"

#### `UI-CANCEL-03` — outro organizador
- given: evento publicado E de A
- when: `POST /organizador/eventos/<E>/cancelar` como B; e como participante
- then:
  - B recebe `404` sem dados de E; participante recebe `403`
  - E continua "Publicado"

#### `UI-CANCEL-04` — irreversível
- given: evento E de A cancelado
- when: `GET /organizador/eventos/<E>`; `POST …/editar` (dados válidos); `POST …/publicar`; `POST …/cancelar`
- then:
  - a página não tem formulários de edição, publicação nem cancelamento
  - editar → `409` "Evento cancelado não pode ser editado"; publicar → `409` "Evento cancelado não pode ser republicado"; cancelar → `409` "Evento já cancelado"

## E2E
**Modo de verificação:** sistema completo; compras pela API de parceiros (`$KEY`) e pela vitrine; consultas pela API e pelo painel. Tempos medidos a partir da resposta do cancelamento.

### Cancel effects
**Common given:** evento publicado E3 de A (lotação 5, R$ 50,00); compra pela API com `4000000000000003` (T5, pendente por 30–40 s) e logo depois com `4000000000000001` (T6, código C6); T6 `confirmed`; A cancela E3 antes de 30 s da compra de T5.

#### `E2E-CANCEL-01` — sai de tudo e não vende
- when: logo após o cancelamento, `GET /`, `GET /eventos/<E3>`, `GET /api/partner/events`, `POST /api/partner/events/<E3>/purchases` (corpo válido) e `POST /eventos/<E3>/comprar` como participante
- then:
  - E3 não aparece na vitrine nem na listagem da API
  - `/eventos/<E3>` → `404` "Evento não disponível"
  - compra pela API → `404 {"error":"event_not_available"}`; compra pela vitrine → `404`

#### `E2E-CANCEL-02` — migração em até 10 s
- when: `GET /api/partner/tickets/<T6>` e `/<T5>` até 10 s após o cancelamento
- then:
  - T6 `refunded`
  - T5 `cancelled`

#### `E2E-CANCEL-03` — resposta tardia ignorada
- when: `GET /api/partner/tickets/<T5>` 45 s após a compra de T5 (depois da resposta do gateway)
- then:
  - T5 continua `cancelled`
  - no banco, o pagamento de T5 tem `responded_at` preenchido (o gateway respondeu) e o ingresso não mudou

#### `E2E-CANCEL-04` — check-in em evento cancelado
- when: check-in em E3 com `code=<C6>`
- then:
  - a página mostra `Evento cancelado`

#### `E2E-CANCEL-05` — painel após cancelamento
- when: `GET /organizador/eventos/<E3>` como A, depois da resposta tardia
- then:
  - Confirmados 0, Pendentes 0, Check-ins 0, Vagas disponíveis 0, Receita R$ 0,00, Estornados 1
