# Contrato: F06 Painel do Evento

## Pré-requisitos
**Serviços:** produto no ar via `./scripts/up.sh` em modo padrão; `$WEB` = `http://localhost:<porta>`.
**Estado persistente:** organizadores A e B e participante da seed (senha `catraca123`). Eventos criados/publicados pela UI (F02); ingressos comprados na vitrine (F03). Ingressos do canal parceiro e os estados `refunded`/check-in, que dependem de F04/F05/F07, podem ser preparados no banco quando essas features não estão presentes (SQL indicado nos itens).
**Configuração:** modo padrão.
**Dependências externas:** `curl`, `bash`, `docker compose exec`.

## Quality gates
- **gates** — `./scripts/gates.sh` — typecheck, check-artifacts e testes (incluindo `tests/f06-dashboard.test.ts`) passam

## Mapa de cobertura
| Critério do PRD | Itens |
|---|---|
| AC-F06-01 O painel na página de gerenciamento mostra Confirmados (inclui os com check-in), Pendentes e Estornados com a contagem exata de ingressos em cada status (R12). | UI-DASH-01, UI-DASH-02 |
| AC-F06-02 Check-ins conta só ingressos confirmados que passaram pelo check-in (R12). | UI-DASH-02 |
| AC-F06-03 Vagas disponíveis segue R05: lotação − (pendentes + confirmados), e 0 em evento cancelado (R05, R12). | UI-DASH-01, UI-DASH-04 |
| AC-F06-04 Receita é a soma do preço pago por ingresso confirmado, usando o preço vigente em cada compra, exibida em reais (`R$ 350,00`) (R03, R12). | UI-DASH-03 |
| AC-F06-05 O painel conta igualmente vendas da vitrine e da API (R12). | UI-DASH-05 |
| X08 (F02→F06) O painel aparece na página de gerenciamento de F02 e só para o organizador dono (R04, R13). | UI-DASH-06 |
| X09 (F03→F06) Os números do painel batem com os ingressos criados por F03 em vitrine e API, inclusive Receita com o preço de cada compra após mudança de preço e Check-ins após check-in (R03, R05, R12). | UI-DASH-01, UI-DASH-02, UI-DASH-03, UI-DASH-05 |

## UI
**Modo de verificação:** `GET /organizador/eventos/<id>` com cookie jar do organizador; o painel é a seção "Painel", com cada número numa célula `data-metric="confirmed|pending|checkins|available|revenue|refunded"` ao lado do rótulo (Confirmados, Pendentes, Check-ins, Vagas disponíveis, Receita, Estornados). Cada item compara o painel com `SELECT status, checked_in_at, price_cents FROM tickets WHERE event_id='<id>'`.

### Dashboard
#### `UI-DASH-01` — pendentes, confirmados, recusados e vagas
- given: evento publicado E de A (lotação 4, R$ 100,00); na vitrine: um ingresso `4000000000000001` (confirmado), um `4000000000000003` (pendente nos primeiros 30 s) e um `4000000000000002` (recusado)
- when: `GET /organizador/eventos/<E>` ~10 s após as compras
- then:
  - Confirmados 1, Pendentes 1, Check-ins 0, Vagas disponíveis 2, Receita R$ 100,00, Estornados 0
  - os números batem com a consulta ao banco

#### `UI-DASH-02` — check-in e estornados
- given: evento publicado F de A com 3 ingressos confirmados; um deles com check-in (via F05, ou no banco: `UPDATE tickets SET checked_in_at=now() WHERE id='<t1>'`) e outro estornado (via F07, ou no banco: `UPDATE tickets SET status='refunded' WHERE id='<t2>'`)
- when: `GET /organizador/eventos/<F>`
- then:
  - Confirmados 2 (inclui o do check-in), Check-ins 1, Estornados 1
  - Receita conta só os 2 confirmados

#### `UI-DASH-03` — receita com o preço de cada compra
- given: evento publicado G de A (lotação 3, R$ 100,00) com 2 ingressos confirmados; A muda o preço para R$ 150,00; mais 1 ingresso confirmado
- when: `GET /organizador/eventos/<G>`
- then:
  - Receita `R$ 350,00`
  - Confirmados 3, Vagas disponíveis 0

#### `UI-DASH-04` — evento cancelado
- given: evento H de A com 1 ingresso pendente e status `cancelled` (via F07, ou no banco)
- when: `GET /organizador/eventos/<H>`
- then:
  - Vagas disponíveis 0

#### `UI-DASH-05` — vitrine e API contam igual
- given: evento publicado K de A (lotação 5) com 1 ingresso confirmado da vitrine e 1 confirmado do canal parceiro (via F04 `POST /api/partner/events/<K>/purchases` com `4000000000000001`, ou, sem F04, inserido no banco com `channel='partner'`, `status='confirmed'`, `price_cents=10000`)
- when: `GET /organizador/eventos/<K>`
- then:
  - Confirmados 2, Receita R$ 200,00, Vagas disponíveis 3

#### `UI-DASH-06` — só para o dono
- given: evento E de A com vendas
- when: `GET /organizador/eventos/<E>` como B, como participante e sem login
- then:
  - B: `404` sem a seção "Painel" e sem números de E
  - participante: `403`; visitante: `302` para `/entrar…`
