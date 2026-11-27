# Contrato: F04 API de Parceiros

## Pré-requisitos
**Serviços:** produto no ar via `./scripts/up.sh` em modo padrão; `$API` = `http://localhost:<porta>`.
**Estado persistente:** organizador A e participante da seed (senha `catraca123`); eventos criados e publicados pelo organizador A pela UI (F02) quando o item pede.
**Configuração:** `$KEY` = chave de parceiro padrão `catraca-parceiro-2026` (variável `PARTNER_API_KEY`).
**Dependências externas:** `curl`, `bash`, `xargs`, `jq` (opcional).

## Quality gates
- **gates** — `./scripts/gates.sh` — typecheck, check-artifacts e testes (incluindo `tests/f04-partner-api.test.ts`) passam

## Mapa de cobertura
| Critério do PRD | Itens |
|---|---|
| AC-F04-01 Nas três rotas, sem `X-Api-Key` ou com chave inválida, a resposta é `401` com `{"error":"unauthorized"}`. | API-AUTH-01 |
| AC-F04-02 `GET /api/partner/events` responde `200` com a lista de eventos publicados e não cancelados, cada um com `id`, `name`, `startsAt` (ISO 8601 com fuso), `priceCents` e `availableSeats` (R02, R05). | API-EVENTS-01, API-EVENTS-02 |
| AC-F04-03 `POST /api/partner/events/{eventId}/purchases` válido responde `202` com `ticketId`, `code` e `status` `pending`, sem esperar o gateway (R06). | API-PURCHASE-01 |
| AC-F04-04 Erros da compra seguem a ordem: corpo inválido (campo faltando, e-mail mal formado, cartão sem 16 dígitos) → `422 invalid_request`; evento inexistente, rascunho ou cancelado → `404 event_not_available`; sem vaga → `409 sold_out` (R07). | API-PURCHASE-02, API-PURCHASE-03, API-PURCHASE-04, API-PURCHASE-05 |
| AC-F04-05 `GET /api/partner/tickets/{ticketId}` responde `200` com `ticketId`, `code`, `eventId`, `status` e `checkedIn` para ingresso de qualquer canal; inexistente → `404 ticket_not_found` (R09). | API-TICKETS-01, API-TICKETS-02, API-TICKETS-03 |
| AC-F04-06 Em duas rodadas, cada uma num evento novo com lotação 5, 30 compras simultâneas pela API resultam em exatamente 5 respostas `202` e 25 `409` (R07). | API-LOAD-01 |
| X04 (F02→F04) O evento publicado em F02 aparece em `GET /api/partner/events` com `priceCents` = preço × 100 e `startsAt` igual à data cadastrada; rascunho não aparece e comprá-lo pela API responde `404 event_not_available` (R02). | API-EVENTS-01, API-PURCHASE-03 |
| X05 (F03→F04) Compra pela API passa pelo mesmo serviço de F03: ocupa vaga (`availableSeats` diminui), é confirmada/recusada pelo mesmo gateway, e um ingresso comprado na vitrine é consultável em `GET /api/partner/tickets/{id}` (R05, R06, R08). | API-EVENTS-02, API-TICKETS-01, API-TICKETS-03 |

## HTTP API
**Modo de verificação:** `curl -s -i` contra `$API`; asserções sobre status HTTP e corpo JSON (campos e valores exatos).

### Auth
#### `API-AUTH-01` — sem chave ou chave errada
- given: um evento publicado E e um ingresso T existentes
- when: chamar as três rotas (`GET /api/partner/events`, `POST /api/partner/events/<E>/purchases` com corpo válido, `GET /api/partner/tickets/<T>`) sem `X-Api-Key` e, de novo, com `X-Api-Key: errada`
- then:
  - as 6 respostas são `401` com corpo exatamente `{"error":"unauthorized"}`
  - nenhum ingresso novo é criado em E

### Events
#### `API-EVENTS-01` — listagem
- given: organizador A tem o evento publicado P ("Jazz API", `startsAt` = `<mês seguinte>T21:00`, R$ 100,00, lotação 2) e o rascunho D
- when: `GET /api/partner/events` com `$KEY`
- then:
  - `200` com um array JSON
  - contém `{"id":"<P>","name":"Jazz API","startsAt":"<mês seguinte>T21:00:00-03:00","priceCents":10000,"availableSeats":2}` (exatamente essas 5 chaves)
  - não contém D

#### `API-EVENTS-02` — availableSeats acompanha as vagas
- given: P com lotação 2 e nenhum ingresso
- when: comprar P pela API com `4000000000000004` e listar; esperar 45 s e listar de novo
- then:
  - logo após a compra, `availableSeats` de P é 1
  - aos 45 s (recusado pelo gateway), `availableSeats` volta a 2

### Purchase
**Common given:** evento publicado P com vagas.

#### `API-PURCHASE-01` — compra aceita
- when: `POST /api/partner/events/<P>/purchases` com `{"buyerEmail":"ana@example.com","cardNumber":"4000000000000001"}`
- then:
  - `202` em menos de 1 segundo, com `{"ticketId":"tkt_…","code":"<8 caracteres [A-Z0-9]>","status":"pending"}` (exatamente essas 3 chaves)
  - em até 5 s, `GET /api/partner/tickets/<ticketId>` mostra `"status":"confirmed"`

#### `API-PURCHASE-02` — corpo inválido
- when: POST em P com: `{"buyerEmail":"ana@example.com"}`; `{"cardNumber":"4000000000000001"}`; `{"buyerEmail":"nao-e-email","cardNumber":"4000000000000001"}`; `{"buyerEmail":"ana@example.com","cardNumber":"123"}`; corpo `{` (JSON malformado)
- then:
  - todos `422` com `{"error":"invalid_request"}`
  - nenhum ingresso criado

#### `API-PURCHASE-03` — evento indisponível
- when: POST válido em `evt_naoexiste` e no rascunho D
- then:
  - ambos `404` com `{"error":"event_not_available"}`

#### `API-PURCHASE-04` — sem vaga
- given: evento publicado S com lotação 1 e um ingresso pendente/confirmado
- when: POST válido em S
- then:
  - `409` com `{"error":"sold_out"}`

#### `API-PURCHASE-05` — precedência dos erros
- when: (a) sem chave, com corpo inválido em `evt_naoexiste`; (b) com chave, corpo inválido (`cardNumber":"123"`) em `evt_naoexiste`; (c) com chave, corpo inválido em S esgotado; (d) com chave, corpo válido num evento em rascunho D cuja lotação já está tomada no banco (estado preparado com `UPDATE events SET status='published' …`, compra, e `UPDATE events SET status='draft' …`)
- then:
  - (a) `401 unauthorized`
  - (b) `422 invalid_request`
  - (c) `422 invalid_request`
  - (d) `404 event_not_available`

### Tickets
#### `API-TICKETS-01` — ingresso da API
- given: ingresso T comprado pela API em P
- when: `GET /api/partner/tickets/<T>`
- then:
  - `200` com exatamente `ticketId`, `code`, `eventId` (= P), `status`, `checkedIn` (`false`)

#### `API-TICKETS-02` — inexistente
- when: `GET /api/partner/tickets/tkt_naoexiste`
- then:
  - `404` com `{"error":"ticket_not_found"}`

#### `API-TICKETS-03` — ingresso da vitrine
- given: participante da seed comprou P na vitrine (`POST /eventos/<P>/comprar`) e o id do ingresso foi obtido no banco (`SELECT id FROM tickets WHERE channel='storefront' ORDER BY created_at DESC LIMIT 1`)
- when: `GET /api/partner/tickets/<id>`
- then:
  - `200` com o `code` igual ao exibido em "Meus ingressos" e `eventId` = P

### Load
#### `API-LOAD-01` — rajada em duas rodadas
- given: eventos novos E4 e E5, publicados, lotação 5, R$ 10,00
- when: para cada um, `seq 30 | xargs -P 30 -I{} curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/api/partner/events/<id>/purchases" -H "X-Api-Key: $KEY" -H "Content-Type: application/json" -d '{"buyerEmail":"carga{}@example.com","cardNumber":"4000000000000001"}' | sort | uniq -c`
- then:
  - cada rodada mostra exatamente `5 202` e `25 409`
  - em até 10 s, os 5 ingressos de cada evento estão `confirmed` e `availableSeats` = 0
