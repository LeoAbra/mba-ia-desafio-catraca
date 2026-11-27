# Contrato: F03 Compra e Gateway

## Pré-requisitos
**Serviços:** produto no ar via `./scripts/up.sh` em modo padrão (gateway simulado com os tempos do brief); `$WEB` = `http://localhost:<porta>`.
**Estado persistente:** contas da seed (organizador A, participante `participante@catraca.dev`, senha `catraca123`); participantes novos criados por `POST /cadastro` quando o item pede.
**Configuração:** `GATEWAY_DELAY_SCALE` não definido (padrão 1).
**Dependências externas:** `curl`, `bash`, `xargs`, `docker compose exec` (consulta somente leitura ao banco quando o item pede).

## Quality gates
- **gates** — `./scripts/gates.sh` — typecheck, check-artifacts e testes (incluindo `tests/f03-concurrency.test.ts`) passam

## Mapa de cobertura
| Critério do PRD | Itens |
|---|---|
| AC-F03-01 O participante logado compra um ingresso na página pública do evento; a compra nasce pendente, já ocupa vaga e é respondida sem esperar o gateway (R05, R06). | UI-BUY-01 |
| AC-F03-02 Com o cartão final `0001`, o ingresso fica confirmado em até 5 segundos (R08). | UI-BUY-02 |
| AC-F03-03 Com cartões final `0002`, `0004` ou outro final, o ingresso fica recusado e a vaga é liberada (R05, R08). | UI-BUY-03, UI-BUY-04 |
| AC-F03-04 Os finais `0003` e `0004` só respondem entre 30 e 40 segundos, e até lá o ingresso fica pendente ocupando vaga (R05, R06). | UI-BUY-04, UI-BUY-05 |
| AC-F03-05 Número de cartão que não tem exatamente 16 dígitos é rejeitado antes de criar o ingresso. | UI-BUY-06 |
| AC-F03-06 Sem vaga disponível, a página do evento exibe `Ingressos esgotados` no lugar da compra, e uma tentativa de compra é recusada com `Ingressos esgotados` (R07). | UI-SOLDOUT-01, UI-SOLDOUT-02 |
| AC-F03-07 Com compras simultâneas, as vagas ocupadas nunca passam da lotação (R07). | UI-SOLDOUT-03, GATE-CONCURRENCY-01 |
| AC-F03-08 Em "Meus ingressos", o participante vê o evento, o status (rótulo) e o código único de 8 caracteres de cada ingresso que comprou, e só os seus (R09). | UI-TICKETS-01, UI-TICKETS-02 |
| AC-F03-09 Reduzir a lotação para menos que as vagas ocupadas é rejeitado (R03). | UI-CAPACITY-01 |
| AC-F03-10 Cada ingresso guarda o preço vigente no momento da compra; mudar o preço não altera ingressos já comprados (R03). | UI-PRICE-01 |
| AC-F03-11 Visitante não compra: a página pública pede login; só participante compra. | UI-BUY-07 |
| X02 (F01→F03) Um participante criado pelo cadastro da UI (F01) compra na vitrine e vê o ingresso em "Meus ingressos"; outro participante não vê esse ingresso (R09). | UI-TICKETS-02 |
| X03 (F02→F03) Só evento publicado em F02 aceita compra (rascunho responde como indisponível); a edição de preço em F02 vale só para compras posteriores; a redução de lotação em F02 abaixo das vagas ocupadas de F03 é rejeitada e o aumento é aceito (R02, R03). | UI-BUY-08, UI-PRICE-01, UI-CAPACITY-01 |

## UI
**Modo de verificação:** HTTP com cookie jar às páginas HTML. "Meus ingressos" é `GET /meus-ingressos`. A compra é `POST /eventos/<id>/comprar` com `cardNumber=<16 dígitos>`. Eventos são criados e publicados pelo organizador A via F02. Tempos medidos a partir da resposta da compra.

### Buy
**Common given:** evento publicado E (lotação 2, R$ 100,00) do organizador A; participante P recém-cadastrado e logado.

#### `UI-BUY-01` — compra nasce pendente e ocupa vaga
- given: (default)
- when: `POST /eventos/<E>/comprar` com `cardNumber=4000000000000001`
- then:
  - `302` para `/meus-ingressos?aviso=compra` em menos de 1 segundo
  - `GET /meus-ingressos` imediatamente depois mostra o ingresso com status "pendente"
  - `GET /eventos/<E>` mostra "Vagas disponíveis: 1"

#### `UI-BUY-02` — final 0001 confirma em até 5 s
- given: o ingresso de UI-BUY-01
- when: `GET /meus-ingressos` 5 segundos depois da compra
- then:
  - o ingresso aparece com status "confirmado"

#### `UI-BUY-03` — final 0002 recusa e libera a vaga
- given: (default)
- when: `POST /eventos/<E>/comprar` com `cardNumber=4000000000000002` e, 6 segundos depois, `GET /meus-ingressos` e `GET /eventos/<E>`
- then:
  - o ingresso aparece com status "recusado"
  - "Vagas disponíveis: 2" (a vaga foi liberada)
  - o mesmo vale para um final qualquer (ex.: `4000000000000009`)

#### `UI-BUY-04` — final 0004 fica pendente 30–40 s e recusa
- when: `POST /eventos/<E>/comprar` com `cardNumber=4000000000000004`
- then:
  - aos 25 s o ingresso ainda está "pendente" e a página do evento mostra uma vaga a menos
  - aos 45 s o ingresso está "recusado" e a vaga voltou

#### `UI-BUY-05` — final 0003 fica pendente 30–40 s e confirma
- when: `POST /eventos/<E>/comprar` com `cardNumber=4000000000000003`
- then:
  - aos 25 s o ingresso ainda está "pendente"
  - aos 45 s está "confirmado"

#### `UI-BUY-06` — cartão inválido não cria ingresso
- when: `POST /eventos/<E>/comprar` com `cardNumber=123` (e, separadamente, 17 dígitos e 16 caracteres com letra)
- then:
  - `422` com "O número do cartão precisa ter 16 dígitos"
  - "Meus ingressos" não ganha nenhum ingresso novo e as vagas do evento não mudam

#### `UI-BUY-07` — visitante e organizador não compram
- when: `GET /eventos/<E>` sem login; `POST /eventos/<E>/comprar` sem login; `POST /eventos/<E>/comprar` como organizador A
- then:
  - a página sem login mostra "Entre para comprar" e não mostra o formulário do cartão
  - o POST sem login responde `302` para `/entrar…`
  - o POST do organizador responde `403`

#### `UI-BUY-08` — rascunho não vende
- given: evento D em rascunho do organizador A
- when: `POST /eventos/<D>/comprar` como participante, com cartão válido
- then:
  - `404` com "Evento não disponível"
  - nenhum ingresso criado

### Sold out
#### `UI-SOLDOUT-01` — página esgotada
- given: evento publicado S (lotação 1) com um ingresso pendente ou confirmado
- when: `GET /eventos/<S>` como participante
- then:
  - a página mostra `Ingressos esgotados`
  - a página não contém o formulário de compra (`cardNumber`)

#### `UI-SOLDOUT-02` — tentativa esgotada
- given: o evento S de UI-SOLDOUT-01
- when: `POST /eventos/<S>/comprar` com `cardNumber=4000000000000001`
- then:
  - `409` com `Ingressos esgotados`
  - o evento continua com 1 ingresso ocupando vaga

#### `UI-SOLDOUT-03` — compras simultâneas na vitrine
- given: evento publicado C (lotação 3) e participante logado (cookie jar)
- when: 12 `POST /eventos/<C>/comprar` simultâneos (`xargs -P 12`) com `cardNumber=4000000000000001`
- then:
  - exatamente 3 respostas `302` e 9 respostas `409`
  - consulta ao banco: `SELECT count(*) FROM tickets WHERE event_id='<C>' AND status IN ('pending','confirmed')` = 3

### Tickets
#### `UI-TICKETS-01` — conteúdo de "Meus ingressos"
- given: participante P com um ingresso confirmado em E
- when: `GET /meus-ingressos`
- then:
  - a linha mostra o nome de E, o status "confirmado" e um código de 8 caracteres `[A-Z0-9]{8}`
  - códigos de ingressos diferentes são distintos

#### `UI-TICKETS-02` — só os próprios ingressos
- given: P (cadastrado pela UI) com ingresso em E; participante da seed sem ingressos em E
- when: `GET /meus-ingressos` como participante da seed
- then:
  - o código do ingresso de P não aparece

### Capacity
#### `UI-CAPACITY-01` — lotação × vagas ocupadas
- given: evento publicado E (lotação 2) com 2 ingressos ocupando vaga (pendentes ou confirmados)
- when: organizador A envia `POST /organizador/eventos/<E>/editar` com `capacity=1`; depois com `capacity=3`
- then:
  - `capacity=1` → `422` com "A lotação não pode ficar menor que as vagas ocupadas (2)"
  - `capacity=3` → `302` com "Alterações salvas"; a página do evento mostra "Vagas disponíveis: 1"

### Price
#### `UI-PRICE-01` — preço vigente por compra
- given: evento publicado E a R$ 100,00 com um ingresso confirmado T1
- when: organizador A muda o preço para R$ 150,00 e o participante compra T2
- then:
  - consulta ao banco: `price_cents` de T1 = 10000 e de T2 = 15000

## Gate
### Concurrency
#### `GATE-CONCURRENCY-01` — teste automatizado de rajada
- when: `./scripts/gates.sh`
- then:
  - a saída mostra `tests/f03-concurrency.test.ts` aprovado (3 rodadas × 30 compras simultâneas em lotação 5 → 5 sucessos e 25 esgotados cada)
