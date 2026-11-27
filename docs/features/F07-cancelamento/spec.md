# Spec F07 — Cancelamento de Evento

**PRD:** Seção 6/F07 · Critérios AC-F07-01 … AC-F07-05 e cross-feature X10–X14 · Regras: R02, R05, R10, R11, R12, R13

## Escopo
**Incluído:** ação de cancelar evento publicado, migração atômica dos ingressos, seção "Cancelamento" na página de gerenciamento.
**Não incluído:** estorno financeiro real (fora de escopo), notificação aos compradores (fora de escopo).

## Decisões técnicas
| Tema | Escolha | Motivo |
|---|---|---|
| Transação | `SELECT … FROM events WHERE id AND organizer_id FOR UPDATE` → `UPDATE events SET status='cancelled', cancelled_at=now()` → `UPDATE tickets SET status = CASE WHEN status='confirmed' THEN 'refunded' ELSE 'cancelled' END WHERE event_id = $1 AND status IN ('pending','confirmed')` → `COMMIT` | Tudo acontece na requisição (bem antes dos 10 s do R11). Trava a mesma linha que a compra trava: nenhuma compra entra depois do cancelamento. |
| Um `UPDATE` com `CASE` | em vez de dois `UPDATE`s | Se o gateway confirmar um ingresso entre dois statements, o segundo não o pegaria e sobraria um confirmado num evento cancelado. Com um só statement, o Postgres reavalia a linha travada (READ COMMITTED) e aplica o `CASE` sobre a versão mais nova. |
| Resposta tardia do gateway | nenhuma mudança necessária: `PaymentProcessor.applyResult` (F03) só atualiza ingresso `pending` | O pagamento fica `approved`/`declined` em `payments` (auditoria), mas o ingresso continua `cancelled`. |
| Quem pode | só o dono (`lockOwned`); só evento `published` | R11 ("cancelar um evento publicado"), R13. Rascunho → `409` "Só evento publicado pode ser cancelado"; já cancelado → `409` "Evento já cancelado". |
| Irreversível | F02 já bloqueia editar/republicar `cancelled`; não existe rota de "descancelar" | R11. |
| Saída da vitrine/API | automática: F02 (`listOnSale`/`findOnSale`) e F04 filtram `status='published'`; compra falha com `EventNotAvailable` | R02/R11 sem código extra. |
| Vagas | `computeSeats` devolve 0 para `cancelled` | R05. |
| UI | seção order 50 com botão "Cancelar evento" (só se publicado) e aviso de irreversibilidade; após cancelar, `302 ?aviso=cancelado` | — |

## Estratégia de testes
Integração: cancelar publicado (migração confirmados→refunded, pendentes→cancelled, recusados intactos), rascunho e já cancelado → 409, outro organizador → 404, resposta tardia do gateway (cartão `0003`) não altera, vitrine e API sem o evento, compra 404 na API e na vitrine, check-in `Evento cancelado`, painel com Estornados e Vagas 0. Concorrência: cancelamento simultâneo a uma rajada de compras nunca deixa ingresso `pending`/`confirmed` no evento cancelado.
