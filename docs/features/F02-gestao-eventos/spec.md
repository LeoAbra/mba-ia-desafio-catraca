# Spec F02 — Gestão de Eventos

**PRD:** Seção 6/F02 · Critérios AC-F02-01 … AC-F02-07 e cross-feature X01 · Regras: R01, R02, R03 (aumento de lotação), R04, R11 (bloqueio de edição), R13

## Escopo
**Incluído:** criação, edição e publicação de eventos pelo organizador; lista "Meus eventos"; página de gerenciamento com URL própria; vitrine pública; página pública do evento; pontos de extensão das páginas e da edição.
**Não incluído:** compra e vagas ocupadas (F03 — inclusive a regra "lotação ≥ vagas ocupadas", que F03 registra como `capacityGuard`), check-in (F05), painel (F06), a ação de cancelar (F07).

## Decisões técnicas
| Decisão | Escolha | Motivo |
|---|---|---|
| Status | coluna `status` ∈ {`draft`, `published`, `cancelled`} com `CHECK`; nasce `draft` | R02; `cancelled` já existe no modelo para F02 bloquear edição/republicação e F07 só fazer a transição. |
| Datas | formulário `datetime-local` interpretado como horário de Brasília (`-03:00`); gravado em `timestamptz`; exibido `dd/mm/aaaa hh:mm` e na API em ISO com `-03:00` | O brief deixa o fuso livre; Brasília sem horário de verão tem offset fixo. |
| Preço | entrada em reais (`100`, `100,00`, `100.50`); gravado em centavos inteiros (`price_cents > 0`) | Sem ponto flutuante em dinheiro. |
| Posse (R13) | toda consulta da área do organizador filtra `organizer_id = usuário logado`; evento de outro organizador → `404` "Evento não encontrado" (mesma resposta de inexistente) | Não vaza nem a existência do evento. |
| Concorrência na edição | edição roda em transação com `SELECT … FOR UPDATE` no evento e chama os `capacityGuards` dentro dela | F03 conta vagas com a linha travada; compra e edição se serializam (R03/R07). |
| Extensões | `managePageSections` (ordenadas por `order`), `eventPageSections`, `capacityGuards` em `src/shared/extensions.ts` | F03–F07 se encaixam sem editar o código de F02. |
| Mensagens pós-ação | redirecionamento com `?aviso=<chave>` mapeado para texto fixo | PRG sem permitir texto arbitrário na página. |

## Modelo
```sql
events(id text pk 'evt_…', organizer_id → users, name, starts_at timestamptz, venue,
       capacity int CHECK (capacity >= 1), price_cents int CHECK (price_cents > 0),
       status text CHECK (status IN ('draft','published','cancelled')) DEFAULT 'draft',
       created_at, published_at, cancelled_at)
```

## Rotas
| Rota | Quem | Comportamento |
|---|---|---|
| `GET /` | todos | vitrine: eventos `published`, ordenados por data, com link `/eventos/:id` |
| `GET /eventos/:id` | todos | página pública se `published`; senão `404` "Evento não disponível"; renderiza `eventPageSections` |
| `GET /organizador` | organizador | "Meus eventos": só os do organizador, com status e link para a gestão |
| `GET /organizador/eventos/novo` · `POST /organizador/eventos` | organizador | cria rascunho; sucesso → `302 /organizador/eventos/:id`; erro → `422` |
| `GET /organizador/eventos/:id` | dono | página de gerenciamento (R04): dados, edição, publicação + seções de extensão |
| `POST /organizador/eventos/:id/editar` | dono | valida (R01), `capacityGuards` (R03), grava; cancelado → `409` "Evento cancelado não pode ser editado" |
| `POST /organizador/eventos/:id/publicar` | dono | `draft → published`; cancelado → `409` "Evento cancelado não pode ser republicado" |

## Validação (criar e editar)
| Campo | Regra | Mensagem |
|---|---|---|
| nome | não vazio | "Informe o nome do evento" |
| data de início | `AAAA-MM-DDTHH:MM` válido | "Data de início inválida" |
| data de início | > agora | "A data de início precisa estar no futuro" |
| local | não vazio | "Informe o local" |
| lotação | inteiro ≥ 1 | "A lotação precisa ser um número inteiro maior ou igual a 1" |
| preço | número em reais > 0, até 2 casas | "O preço precisa ser maior que zero" |

## Estratégia de testes
Unitários: validação do formulário, parse/format de dinheiro e datas. Integração (Supertest + Postgres): criar rascunho, rejeições, vitrine com rascunho × publicado, posse (lista e URL direta de outro organizador), edição com data passada, aumento de lotação, bloqueio de evento cancelado.

## Premissas
- O organizador pode editar evento publicado (preço e lotação mudam durante as vendas — R03).
- A página pública de evento não publicado responde 404 para não expor rascunhos.
