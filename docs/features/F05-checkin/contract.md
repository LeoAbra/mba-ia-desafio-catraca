# Contrato: F05 Check-in

## Pré-requisitos
**Serviços:** produto no ar via `./scripts/up.sh` em modo padrão; `$WEB` = `http://localhost:<porta>`.
**Estado persistente:** organizadores A e B e participante da seed (senha `catraca123`). Eventos criados/publicados pela UI (F02); ingressos comprados na vitrine (F03) com os cartões indicados; códigos lidos em "Meus ingressos" ou no banco (`SELECT code, status FROM tickets WHERE event_id='<id>'`).
**Configuração:** modo padrão.
**Dependências externas:** `curl`, `bash`, `docker compose exec` (consulta ao banco e, onde indicado, preparo de estado).

## Quality gates
- **gates** — `./scripts/gates.sh` — typecheck, check-artifacts e testes (incluindo `tests/f05-checkin.test.ts`) passam

## Mapa de cobertura
| Critério do PRD | Itens |
|---|---|
| AC-F05-01 Código inexistente ou de ingresso de outro evento exibe `Ingresso inválido para este evento` (R10.1). | UI-CHECKIN-01, UI-CHECKIN-02 |
| AC-F05-02 Código válido de evento cancelado exibe `Evento cancelado` (R10.2). | UI-CHECKIN-06 |
| AC-F05-03 Ingresso pendente, recusado, cancelado ou estornado exibe `Ingresso não confirmado` (R10.3). | UI-CHECKIN-03 |
| AC-F05-04 Ingresso confirmado que já passou pelo check-in exibe `Ingresso já utilizado` (R10.4). | UI-CHECKIN-05 |
| AC-F05-05 Ingresso confirmado sem check-in exibe `Entrada liberada` e passa a constar como check-in feito (R10.5). | UI-CHECKIN-04 |
| AC-F05-06 Só o organizador dono do evento faz check-in nele; outro organizador não consegue (R04, R13). | UI-CHECKIN-07 |
| X06 (F02→F05) O check-in roda na página de gerenciamento de F02 do evento dono; um ingresso válido de outro evento (inclusive de outro organizador) resulta em `Ingresso inválido para este evento` (R10, R13). | UI-CHECKIN-02, UI-CHECKIN-07 |
| X07 (F03→F05) Ingresso confirmado pelo gateway de F03 (vitrine ou API) resulta em `Entrada liberada`; ingresso pendente ou recusado por F03 resulta em `Ingresso não confirmado`; o check-in aparece como `checkedIn: true` na API de F04 quando F04 está presente (R08, R10). | UI-CHECKIN-03, UI-CHECKIN-04 |

## UI
**Modo de verificação:** HTTP com cookie jar. A página de gerenciamento é `GET /organizador/eventos/<id>` e tem um formulário que envia `POST /organizador/eventos/<id>/checkin` com o campo `code`. A mensagem aparece no HTML da resposta.

### Check-in
**Common given:** organizador A logado e dono do evento publicado E1 (lotação 5); participante comprou em E1 na vitrine: C1 com `4000000000000001` (confirmado após ≤ 5 s) e C2 com `4000000000000004` (pendente nos primeiros 30 s, recusado depois); organizador B tem o evento publicado E2 com um ingresso confirmado C3.

#### `UI-CHECKIN-01` — código inexistente
- when: check-in em E1 com `code=ZZZZZZZZ`
- then:
  - `200` e a página mostra `Ingresso inválido para este evento`

#### `UI-CHECKIN-02` — ingresso de outro evento
- when: check-in em E1 com `code=<C3>` (ingresso confirmado de E2, de B)
- then:
  - a página mostra `Ingresso inválido para este evento`
  - C3 continua sem check-in (`checked_in_at` nulo)

#### `UI-CHECKIN-03` — não confirmado
- when: check-in em E1 com `code=<C2>` enquanto pendente; e de novo depois que C2 ficou recusado
- then:
  - as duas respostas mostram `Ingresso não confirmado`
  - C2 continua sem check-in

#### `UI-CHECKIN-04` — entrada liberada
- when: check-in em E1 com `code=<C1>` (confirmado), digitado em minúsculas
- then:
  - a página mostra `Entrada liberada`
  - no banco, `checked_in_at` de C1 não é nulo

#### `UI-CHECKIN-05` — já utilizado
- given: C1 já passou pelo check-in (UI-CHECKIN-04)
- when: check-in em E1 com `code=<C1>`
- then:
  - a página mostra `Ingresso já utilizado`

#### `UI-CHECKIN-06` — evento cancelado
- given: evento publicado E3 de A com um ingresso confirmado C6; E3 com status `cancelled` (estado produzido por F07; antes de F07, aplicado no banco com `UPDATE events SET status='cancelled' WHERE id='<E3>'`)
- when: check-in em E3 com `code=<C6>`; e com `code=ZZZZZZZZ`
- then:
  - `<C6>` → `Evento cancelado`
  - `ZZZZZZZZ` → `Ingresso inválido para este evento` (o item 1 da lista vem antes)

#### `UI-CHECKIN-07` — só o dono
- when: organizador B envia `POST /organizador/eventos/<E1>/checkin` com `code=<C1 ou outro confirmado de E1>`; participante da seed envia o mesmo
- then:
  - B recebe `404` "Evento não encontrado", sem nome de E1
  - participante recebe `403`
  - o ingresso usado não ganha check-in por essas tentativas
