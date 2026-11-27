# Spec F05 — Check-in

**PRD:** Seção 6/F05 · Critérios AC-F05-01 … AC-F05-06 e cross-feature X06, X07 · Regras: R04, R10, R13

## Escopo
**Incluído:** seção "Check-in" na página de gerenciamento (F02), ação `POST /organizador/eventos/:id/checkin`, regra ordenada do R10, gravação de `tickets.checked_in_at`.
**Não incluído:** a ação de cancelar (F07). O item 2 do R10 depende só de `events.status = 'cancelled'`, que já existe no modelo de F02.

## Decisões técnicas
| Tema | Escolha | Motivo |
|---|---|---|
| Regra | função pura `checkinOutcome(ticket, event)` que percorre a lista do R10 **na ordem** e devolve a primeira situação verdadeira | Ordem testável isoladamente; evita o bug "evento cancelado deixa entrar". |
| Atomicidade | transação com `SELECT … FROM tickets WHERE code = $1 FOR UPDATE`; marca `checked_in_at = now()` só no caso "Entrada liberada" | Dois check-ins simultâneos do mesmo código: um libera, o outro vê "já utilizado". |
| Normalização | `trim()` + maiúsculas no código digitado | Organizador digita na porta. |
| Posse (R13) | evento carregado por `findOwned(organizador, id)`; outro organizador → `404` sem dados, nada é gravado | Mesmo padrão de F02. |
| Campo em evento cancelado | o campo continua disponível; vale a lista (o brief permite as duas opções) | Uma regra só, sempre a mesma lista. |
| Resposta | `200` com a página de gerenciamento e a mensagem num `<p role="status" data-checkin="<resultado>">` | Fácil de verificar por texto. |

## Mensagens (exatas, R10)
1. `Ingresso inválido para este evento` — código inexistente ou de outro evento
2. `Evento cancelado`
3. `Ingresso não confirmado` — `pending`, `declined`, `cancelled`, `refunded`
4. `Ingresso já utilizado`
5. `Entrada liberada`

## Estratégia de testes
Unitário: `checkinOutcome` com todas as combinações relevantes, inclusive precedência (ingresso de outro evento cancelado → inválido; ingresso confirmado de evento cancelado → cancelado; ingresso pendente já... etc.). Integração: as 5 mensagens pela rota, código em minúsculas, outro organizador recebe 404, participante 403, check-in duplo concorrente.
