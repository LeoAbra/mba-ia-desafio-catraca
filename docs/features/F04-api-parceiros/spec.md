# Spec F04 — API de Parceiros

**PRD:** Seção 6/F04 · Critérios AC-F04-01 … AC-F04-06 e cross-feature X04, X05 · Regras: R02, R05, R06, R07, R09 · Contrato fixo do brief

## Escopo
**Incluído:** as três rotas do contrato fixo, autenticação por `X-Api-Key`, validação do corpo, mapeamento de erros na ordem do brief.
**Não incluído:** qualquer rota além das três; vínculo de compra a conta de participante (o brief proíbe); cancelamento (F07).

## Decisões técnicas
| Tema | Escolha | Motivo |
|---|---|---|
| Montagem | `Router` em `/api/partner`, registrado em `src/app.ts` | Isolado das rotas HTML. |
| Ordem dos middlewares | 1) chave → 2) `express.json()` → 3) handler; erro de JSON malformado vira `422 invalid_request` | "Depois da chave, os erros…": a chave vem antes de tudo, inclusive do parse do corpo. |
| Chave | `PARTNER_API_KEY` (config), comparada com `crypto.timingSafeEqual`; padrão documentado no README | Sem chave ou chave errada → `401 {"error":"unauthorized"}` em qualquer rota sob `/api/partner`. |
| Corpo da compra | objeto com `buyerEmail` (string, `^[^\s@]+@[^\s@]+\.[^\s@]+$`) e `cardNumber` (string, `^\d{16}$`); campos extras ignorados | Qualquer violação → `422 invalid_request`, **antes** de consultar o evento. |
| Compra | `purchaseTicket` de F03 com `channel: 'partner'`, `userId: null` | Mesma transação com `FOR UPDATE` (R07), mesmo gateway (R08) e mesma tabela de ingressos (painel, check-in e cancelamento enxergam). |
| Mapeamento de erros | `EventNotAvailable` → `404 event_not_available`; `SoldOut` → `409 sold_out` | Contrato fixo. |
| Listagem | `listOnSale()` de F02 + `occupiedByEvent()` de F03 numa consulta agregada | `availableSeats` = R05. |
| `startsAt` | `formatIso()` (ISO 8601 com `-03:00`) | Mesmo formato do exemplo do brief. |
| `checkedIn` | `checked_in_at IS NOT NULL` | Coluna do modelo de F03; F05 escreve. |
| Rota desconhecida sob `/api/partner` | `404 {"error":"not_found"}` (após a chave) | Respostas sempre JSON na API. |

## Respostas
| Rota | Sucesso | Erros |
|---|---|---|
| `GET /api/partner/events` | `200 [{id, name, startsAt, priceCents, availableSeats}]` | 401 |
| `POST /api/partner/events/{eventId}/purchases` | `202 {ticketId, code, status:"pending"}` | 401 → 422 → 404 → 409 |
| `GET /api/partner/tickets/{ticketId}` | `200 {ticketId, code, eventId, status, checkedIn}` | 401, 404 `ticket_not_found` |

## Estratégia de testes
Integração com Supertest: 401 nas três rotas (sem cabeçalho e chave errada), formato exato dos JSON, cada erro e a precedência entre eles, listagem sem rascunho, `availableSeats` antes/depois de compra e recusa, consulta de ingresso da vitrine, rajada de 30 compras HTTP simultâneas em lotação 5 (2 rodadas).
