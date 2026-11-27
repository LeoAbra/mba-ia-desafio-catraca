# Contrato: F02 Gestão de Eventos

## Pré-requisitos
**Serviços:** produto no ar via `./scripts/up.sh`; `$WEB` = `http://localhost:<porta>`.
**Estado persistente:** organizadores A (`organizador.a@catraca.dev`) e B (`organizador.b@catraca.dev`) e participante (`participante@catraca.dev`), senha `catraca123` (seed de F01).
**Configuração:** modo padrão.
**Dependências externas:** `curl`, `bash`, `date`.

## Quality gates
- **gates** — `./scripts/gates.sh` — typecheck, check-artifacts e testes passam

## Mapa de cobertura
| Critério do PRD | Itens |
|---|---|
| AC-F02-01 O organizador cria um evento com nome, data e hora de início, local, lotação inteira ≥ 1 e preço em reais > 0, e o evento nasce como rascunho (R01, R02). | UI-CREATE-01 |
| AC-F02-02 A criação é rejeitada quando a lotação é menor que 1, o preço não é maior que zero, falta algum campo ou a data de início não está no futuro — inclusive a data de ontem (R01). | UI-CREATE-02, UI-CREATE-03, UI-CREATE-04, UI-CREATE-05 |
| AC-F02-03 Editar com data de início no passado é rejeitado; uma edição válida (nome, data, local, preço, lotação maior) é aceita (R01, R03). | UI-EDIT-01, UI-EDIT-02 |
| AC-F02-04 Evento em rascunho não aparece na vitrine nem tem página pública; ao publicar, aparece na vitrine (R02). | UI-PUBLISH-01, UI-PUBLISH-02 |
| AC-F02-05 Cada evento tem uma página de gerenciamento com URL própria, acessível pela lista "Meus eventos", onde o organizador edita e publica (R04). | UI-MANAGE-01 |
| AC-F02-06 Na área do organizador, a lista mostra só os eventos do organizador logado, e abrir a página de gerenciamento de um evento de outro organizador não exibe nenhum dado dele (R13). | UI-ACCESS-01, UI-ACCESS-02, UI-ACCESS-03 |
| AC-F02-07 Um evento cancelado não pode ser editado nem republicado (R11). | UI-LOCK-01 |
| X01 (F01→F02) O organizador A, logado pela sessão de F01, cria eventos que ficam atribuídos a ele e aparecem só na sua lista; o participante logado pela sessão de F01 recebe 403 na área do organizador (R13). | UI-ACCESS-01, UI-ACCESS-04 |

## UI
**Modo de verificação:** requisições HTTP com cookie jar às páginas HTML (`application/x-www-form-urlencoded`); asserções sobre status, `Location` e texto do HTML. Datas no formato `AAAA-MM-DDTHH:MM` (horário de Brasília). `<amanhã>` = data de amanhã às 20:00; `<ontem>` = data de ontem às 20:00.

### Create
**Common given:** organizador A logado.

#### `UI-CREATE-01` — cria rascunho
- given: (default)
- when: `POST /organizador/eventos` com `name=Jazz F02`, `startsAt=<mês seguinte>T21:00`, `venue=Porão`, `capacity=2`, `price=100,00`
- then:
  - `302` para `/organizador/eventos/evt_…`
  - a página de gerenciamento mostra "Jazz F02", "Porão", lotação 2, "R$ 100,00" e o status "Rascunho"

#### `UI-CREATE-02` — data de ontem
- when: `POST /organizador/eventos` com `startsAt=<ontem>` e demais campos válidos
- then:
  - `422` com "A data de início precisa estar no futuro"
  - nenhum evento novo na lista "Meus eventos"

#### `UI-CREATE-03` — lotação inválida
- when: `POST /organizador/eventos` com `capacity=0` (e, separadamente, `capacity=2.5`)
- then:
  - `422` com "A lotação precisa ser um número inteiro maior ou igual a 1"

#### `UI-CREATE-04` — preço inválido
- when: `POST /organizador/eventos` com `price=0`
- then:
  - `422` com "O preço precisa ser maior que zero"

#### `UI-CREATE-05` — campos faltando
- when: `POST /organizador/eventos` com `name=` e `venue=` vazios
- then:
  - `422` com "Informe o nome do evento" e "Informe o local"

### Edit
**Common given:** organizador A logado e dono de um evento publicado E (lotação 2, R$ 100,00, data no mês seguinte).

#### `UI-EDIT-01` — data no passado na edição
- when: `POST /organizador/eventos/<E>/editar` com `startsAt=<ontem>` e demais campos atuais
- then:
  - `422` com "A data de início precisa estar no futuro"
  - a página de gerenciamento continua mostrando a data anterior

#### `UI-EDIT-02` — edição válida
- when: `POST /organizador/eventos/<E>/editar` com nome "Jazz Editado", local "Bar Novo", `price=150,00`, `capacity=3` e a mesma data
- then:
  - `302` para `/organizador/eventos/<E>?aviso=salvo`
  - a página mostra "Jazz Editado", "Bar Novo", lotação 3, "R$ 150,00" e "Alterações salvas"

### Publish
**Common given:** organizador A logado e dono de um evento em rascunho D.

#### `UI-PUBLISH-01` — rascunho fora da vitrine
- given: (default)
- when: `GET /` e `GET /eventos/<D>` sem login
- then:
  - a vitrine não contém o nome de D
  - `/eventos/<D>` responde `404` com "Evento não disponível"

#### `UI-PUBLISH-02` — publicar
- when: `POST /organizador/eventos/<D>/publicar`
- then:
  - `302` para a página de gerenciamento, que mostra "Publicado"
  - `GET /` sem login contém o nome de D e o link `/eventos/<D>`
  - `GET /eventos/<D>` responde `200` com nome, local, data e preço

### Manage
#### `UI-MANAGE-01` — URL própria a partir da lista
- given: organizador A logado com dois eventos
- when: `GET /organizador`
- then:
  - a lista mostra "Meus eventos" com cada evento e um link `/organizador/eventos/<id>` distinto por evento
  - cada link responde `200` com o formulário de edição (`/editar`) e, se rascunho, o botão de publicar (`/publicar`)

### Access
#### `UI-ACCESS-01` — lista só os próprios eventos
- given: A e B têm um evento cada ("Evento de A", "Evento de B")
- when: `GET /organizador` como A e depois como B
- then:
  - a lista de A contém "Evento de A" e não contém "Evento de B"
  - a lista de B contém "Evento de B" e não contém "Evento de A"

#### `UI-ACCESS-02` — URL direta de outro organizador
- given: evento E de A (com nome, local e preço conhecidos)
- when: `GET /organizador/eventos/<E>` como B
- then:
  - `404` com "Evento não encontrado"
  - o HTML não contém o nome, o local nem o preço de E

#### `UI-ACCESS-03` — B não opera evento de A
- given: evento E de A
- when: como B, `POST /organizador/eventos/<E>/editar` (nome "Hack") e `POST /organizador/eventos/<E>/publicar`
- then:
  - ambos respondem `404`
  - como A, E continua com o nome original

#### `UI-ACCESS-04` — participante e visitante
- given: evento E de A
- when: `GET /organizador/eventos/<E>` como participante da seed e sem login
- then:
  - participante recebe `403` sem o nome de E
  - visitante recebe `302` para `/entrar…`

### Lock
#### `UI-LOCK-01` — cancelado não edita nem republica
- given: evento E de A com status `cancelled` (estado produzido por F07; antes de F07, aplicado direto no banco: `UPDATE events SET status='cancelled' WHERE id='<E>'`)
- when: `GET /organizador/eventos/<E>`, `POST …/editar` e `POST …/publicar`
- then:
  - a página mostra "Cancelado" e não tem formulário de edição nem botão de publicar
  - `editar` responde `409` com "Evento cancelado não pode ser editado"
  - `publicar` responde `409` com "Evento cancelado não pode ser republicado"
  - E não aparece na vitrine
