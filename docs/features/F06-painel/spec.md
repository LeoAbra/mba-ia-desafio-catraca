# Spec F06 — Painel do Evento

**PRD:** Seção 6/F06 · Critérios AC-F06-01 … AC-F06-05 e cross-feature X08, X09 · Regras: R03, R05, R12, R13

## Escopo
**Incluído:** seção "Painel" na página de gerenciamento (F02) com os seis números do R12, calculados no momento da requisição.
**Não incluído:** atualização em tempo real (fora de escopo: recarregar basta), gráficos, exportação.

## Decisões técnicas
| Tema | Escolha | Motivo |
|---|---|---|
| Fonte | uma consulta agregada sobre `tickets` do evento, sem contadores desnormalizados | Sempre bate com o estado dos ingressos; evita o bug "estorno somado como receita". |
| Confirmados | `count(*) FILTER (WHERE status = 'confirmed')` — inclui quem fez check-in | R12. |
| Pendentes | `FILTER (WHERE status = 'pending')` | R12. |
| Check-ins | `FILTER (WHERE status = 'confirmed' AND checked_in_at IS NOT NULL)` | R12: só confirmados que passaram pelo check-in. |
| Vagas disponíveis | `computeSeats(event, pendentes + confirmados)` de F03 (0 se cancelado) | R05, mesma função da vitrine e da API. |
| Receita | `sum(price_cents) FILTER (WHERE status = 'confirmed')`, formatada `R$ 350,00` | R03/R12: preço gravado em cada ingresso; estornados/recusados/cancelados ficam fora. |
| Estornados | `FILTER (WHERE status = 'refunded')` | R12. |
| Canais | não filtra por `channel` | Vitrine e API contam igual. |
| Marcação | tabela com `<td data-metric="confirmed|pending|checkins|available|revenue|refunded">` | Verificável por texto/atributo. |
| Posse | a seção só é renderizada dentro da página de gerenciamento, que já aplica `findOwned` (F02) | R13 sem código novo de acesso. |

## Estratégia de testes
Unitário: formatação e mapeamento das métricas. Integração: painel com mix de status (pendente, confirmado, recusado, estornado, check-in), receita após mudança de preço, vitrine + API (inserindo ingressos via `purchaseTicket` com `channel: 'partner'`), vagas 0 em evento cancelado, painel ausente para outro organizador.
