# Spec F03 — Compra e Gateway

**PRD:** Seção 6/F03 · Critérios AC-F03-01 … AC-F03-11 e cross-feature X02, X03 · Regras: R03, R05, R06, R07, R08, R09

## Escopo
**Incluído:** serviço de compra (vitrine e, depois, parceiros), alocação de vaga com garantia de lotação, modelo de ingresso, gateway simulado, processador assíncrono de pagamentos, seção de compra na página pública, "Meus ingressos", guarda de lotação na edição.
**Não incluído:** rotas da API de parceiros (F04), check-in (F05), painel (F06), cancelamento (F07).

## Decisões técnicas

### R07 — lotação sob concorrência
Toda compra roda numa transação que começa com `SELECT … FROM events WHERE id = $1 FOR UPDATE`. Com a linha do evento travada, conta as vagas ocupadas (`status IN ('pending','confirmed')`), compara com a lotação e insere o ingresso. Compras simultâneas do mesmo evento ficam **serializadas no banco**: a segunda só lê a contagem depois do `COMMIT` da primeira. A edição de lotação (F02) trava a mesma linha, então "reduzir abaixo das ocupadas" (R03) também é avaliado num estado estável. Não há contador desnormalizado para ficar dessincronizado: a verdade é a tabela `tickets`.

Alternativas descartadas: checar e inserir sem lock (corrida clássica, o bug dos 112 de 100); `SERIALIZABLE` (funciona, mas exige retry de serialization failure em toda compra); contador com `UPDATE … WHERE ocupadas < lotação` (bom, mas duplica a verdade e precisa ser mantido em recusa/cancelamento).

**Prova:** teste automatizado nos gates dispara 30 compras simultâneas contra lotação 5, em 3 eventos novos, e exige exatamente 5 sucessos e 25 `SoldOut`, além de `COUNT(*) ≤ capacity` no banco.

### R06/R08 — resposta assíncrona do gateway
1. A transação da compra grava o ingresso `pending` **e** um registro `payments(status='processing')`, e faz `COMMIT`.
2. Só depois do commit, o `PaymentProcessor` dispara a cobrança em segundo plano (promise não aguardada pela requisição). A resposta HTTP sai imediatamente com o ingresso pendente.
3. Quando o gateway responde, `applyResult` atualiza `payments` e faz `UPDATE tickets SET status = 'confirmed'|'declined' WHERE id = $1 AND status = 'pending'`. A condição `status = 'pending'` é o que garante R11: se o evento foi cancelado no meio, o ingresso já não está pendente e a resposta tardia não muda nada.
4. No boot, `resumePending()` redispara as cobranças ainda `processing` (o processo pode ter reiniciado no meio).

### Gateway simulado
`SimulatedGateway` implementa a interface `PaymentGateway.charge({paymentId, amountCents, cardToken}, signal)`. Decide pelo final do cartão (tabela do brief) e espera um tempo sorteado uniformemente na faixa, multiplicado por `GATEWAY_DELAY_SCALE` (padrão 1 = tempos do brief; os gates usam 0,01). O sistema guarda só os 4 últimos dígitos (`card_last4`), que são o `cardToken` do simulador.

### Outras decisões
| Tema | Escolha |
|---|---|
| Validação do cartão | `^\d{16}$` antes de abrir transação; falha → nada é gravado |
| Código do ingresso | 8 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, `UNIQUE`; insere com `ON CONFLICT (code) DO NOTHING` e tenta outro código em caso de colisão |
| Preço | `tickets.price_cents` copiado do evento dentro da transação da compra (R03: mudança de preço só vale para compras posteriores) |
| Canal | `channel` ∈ {`storefront`, `partner`}; vitrine grava `user_id`; parceiro só `buyer_email` |
| Quem compra na vitrine | só participante logado (`requireParticipant`); visitante vê "Entre para comprar" |
| `checked_in_at` | coluna já criada aqui (modelo do ingresso); F05 escreve, F06 e F04 leem |

## Modelo
```sql
tickets(id 'tkt_…', event_id → events, code UNIQUE, status CHECK IN (pending, confirmed, declined, cancelled, refunded),
        price_cents, channel, user_id → users NULL, buyer_email, created_at, updated_at, checked_in_at NULL)
payments(id 'pay_…', ticket_id UNIQUE → tickets, card_last4, status CHECK IN (processing, approved, declined), requested_at, responded_at)
```

## Interface fornecida (para F04–F07)
- `purchaseTicket(deps, {eventId, cardNumber, channel, userId?, buyerEmail})` → `TicketRecord` | lança `InvalidCard`, `EventNotAvailable`, `SoldOut`.
- `seatsFor(db, event)` → `{capacity, occupied, available}`; `occupiedByEvent(db, ids[])`.
- `findTicketById`, `findTicketByCode`.
- `PaymentProcessor` (`dispatch`, `resumePending`, `idle`, `close`).

## UI
| Rota | Comportamento |
|---|---|
| Seção da página `/eventos/:id` | "Vagas disponíveis: N"; com vaga e participante logado: formulário com o número do cartão; sem vaga: `Ingressos esgotados` no lugar do formulário; visitante: link "Entre para comprar" |
| `POST /eventos/:id/comprar` | participante; sucesso → `302 /meus-ingressos?aviso=compra`; cartão inválido → `422` "O número do cartão precisa ter 16 dígitos"; sem vaga → `409` `Ingressos esgotados`; indisponível → `404` |
| `GET /meus-ingressos` | tabela evento, data, status (rótulo), código — só do participante logado |

## Estratégia de testes
Unitários: regra do gateway por final e faixa de tempo. Integração: compra pendente → confirmada/recusada (escala 0,01), vaga ocupada enquanto pendente e liberada na recusa, cartão inválido não cria ingresso, esgotado na página e na tentativa, "Meus ingressos" isolado por participante, preço vigente, guarda de lotação, resposta tardia ignorada se o ingresso não está mais pendente. Concorrência: 3 rodadas × 30 compras simultâneas em lotação 5.
