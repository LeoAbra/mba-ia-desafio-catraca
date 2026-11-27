# Brief do fundador — Catraca

> Transcrição do enunciado do desafio "Catraca: do brief ao produto em modo agente" (MBA Engenharia de Software com IA — Full Cycle, módulo Desenvolvimento em modo agente). É a fonte de verdade do PRD. As regras têm identificador (R01–R13) para rastreabilidade.

A Catraca vende ingressos para eventos pequenos: shows em bar, workshops, meetups.

## Quem usa

- **Visitante:** sem login, vê a vitrine de eventos.
- **Participante:** cria a própria conta (nome, e-mail e senha), entra, sai, compra ingressos e vê os próprios ingressos.
- **Organizador:** não se cadastra pelo produto; as contas de organizador vêm da seed. Cria e opera os próprios eventos.
- **Parceiro:** sistema externo que vende ingressos pela API de parceiros, autenticado por uma chave.

## Status do ingresso

Na interface aparece o rótulo; na API, o valor.

| Rótulo | Valor na API | Quando se aplica |
|---|---|---|
| pendente | `pending` | compra criada, aguardando a resposta do gateway |
| confirmado | `confirmed` | o gateway aprovou |
| recusado | `declined` | o gateway recusou |
| cancelado | `cancelled` | estava pendente quando o evento foi cancelado |
| estornado | `refunded` | estava confirmado quando o evento foi cancelado |

Ter passado pelo check-in não é um status: é uma informação à parte (na API, o campo `checkedIn`).

## Regras

### Eventos
- **R01.** Um evento tem nome, data e hora de início, local, lotação (inteiro, mínimo 1) e preço (em reais, maior que zero). A data de início precisa estar no futuro, ao criar e ao editar.
- **R02.** Todo evento nasce como rascunho. Só evento publicado e não cancelado aparece na vitrine e na listagem da API de parceiros e aceita compras.
- **R03.** A lotação nunca pode ficar menor que as vagas ocupadas (R05). A alteração de preço vale apenas para as compras feitas depois dela.
- **R04.** Cada evento tem uma página de gerenciamento com endereço (URL) próprio, onde o organizador edita, publica, cancela, faz o check-in e vê o painel.

### Vagas e compra
- **R05.** Vagas ocupadas são os ingressos pendentes mais os confirmados. As vagas disponíveis são a lotação menos as vagas ocupadas; em evento cancelado, são zero.
- **R06.** Cada compra é de um ingresso, feita pelo participante na vitrine ou pelo parceiro na API. A compra nasce pendente, já ocupa vaga e é respondida sem esperar o gateway.
- **R07.** Sem vaga disponível, a compra é recusada: a vitrine exibe `Ingressos esgotados` (no lugar da compra ou como resposta à tentativa) e a API responde `sold_out`. As vagas ocupadas nunca passam da lotação, nem com compras simultâneas.
- **R08.** Quando o gateway aprova, o ingresso fica confirmado. Quando recusa, fica recusado e a vaga é liberada.
- **R09.** Cada ingresso tem um código único, usado no check-in. Em "Meus ingressos", o participante vê o evento, o status e o código de cada ingresso que comprou.

### Check-in
- **R10.** Na página de gerenciamento do evento, o organizador informa o código de um ingresso. A primeira situação verdadeira da lista abaixo, na ordem, define a mensagem exibida. Em evento cancelado, a mensagem `Evento cancelado` pode aparecer no lugar do campo de check-in; se o campo continuar disponível, vale a lista.
  1. O código não existe ou é de outro evento: `Ingresso inválido para este evento`
  2. O evento está cancelado: `Evento cancelado`
  3. O ingresso não está confirmado: `Ingresso não confirmado`
  4. O ingresso já passou pelo check-in: `Ingresso já utilizado`
  5. Nenhuma das anteriores: `Entrada liberada`

### Cancelamento
- **R11.** O organizador pode cancelar um evento publicado, e o cancelamento é irreversível: o evento sai da vitrine e da API, não vende mais e não pode ser editado nem republicado. Em até 10 segundos, os ingressos confirmados passam a estornados e os pendentes a cancelados. Resposta do gateway que chega depois não muda o status de nenhum deles.

### Painel
- **R12.** A página de gerenciamento mostra o painel do evento, contando as vendas da vitrine e da API com as definições abaixo.
  - Confirmados: ingressos confirmados, inclusive os que já passaram pelo check-in
  - Pendentes: ingressos pendentes
  - Check-ins: ingressos confirmados que já passaram pelo check-in
  - Vagas disponíveis: conforme R05
  - Receita: soma do valor pago pelos ingressos confirmados, com o preço vigente no momento de cada compra
  - Estornados: ingressos estornados

### Acesso
- **R13.** Na área do organizador, cada organizador só vê e opera os próprios eventos, inclusive quando acessa diretamente o endereço da página de gerenciamento de um evento de outro organizador. Participante e visitante não acessam a área do organizador.

> Sobre R07: garantir a lotação sob compras simultâneas não é coberto no módulo. Pesquisar como garantir essa regra, e como provar que ela vale, faz parte do desafio.

## Gateway de pagamento simulado

No modo padrão (o do avaliador), o gateway é simulado e responde conforme o final do número do cartão:

| Final | Resposta | Tempo |
|---|---|---|
| `0001` | aprovado | 2–5 s |
| `0002` | recusado | 2–5 s |
| `0003` | aprovado | 30–40 s |
| `0004` | recusado | 30–40 s |
| outro | recusado | 2–5 s |

O número do cartão tem 16 dígitos (ex.: `4000000000000001`); fora disso, a compra é rejeitada antes de criar o ingresso.

## API de parceiros (contrato fixo)

Toda rota exige o cabeçalho `X-Api-Key` com a chave de parceiro documentada no README; sem ele, ou com chave inválida, a resposta é `401` com `{"error":"unauthorized"}`. Os IDs são strings.

`GET /api/partner/events` → `200` com os eventos à venda (publicados e não cancelados), `availableSeats` = vagas disponíveis de R05:
```json
[{ "id": "evt_8f2k", "name": "Jazz no Porão", "startsAt": "2026-12-05T21:00:00-03:00", "priceCents": 10000, "availableSeats": 2 }]
```

`POST /api/partner/events/{eventId}/purchases` com `{ "buyerEmail": "ana@example.com", "cardNumber": "4000000000000001" }` → `202`:
```json
{ "ticketId": "tkt_51xq", "code": "K7Q2M9XA", "status": "pending" }
```
Depois da chave, erros nesta ordem: corpo inválido (campo faltando, e-mail mal formado ou cartão sem 16 dígitos) → `422 {"error":"invalid_request"}`; evento inexistente, em rascunho ou cancelado → `404 {"error":"event_not_available"}`; sem vaga → `409 {"error":"sold_out"}`.

`GET /api/partner/tickets/{ticketId}` (de qualquer canal) → `200`:
```json
{ "ticketId": "tkt_51xq", "code": "K7Q2M9XA", "eventId": "evt_8f2k", "status": "confirmed", "checkedIn": false }
```
Ingresso inexistente → `404 {"error":"ticket_not_found"}`. Compras pela API não ficam vinculadas a contas de participante, mas valem para lotação, painel, check-in e cancelamento exatamente como as da vitrine.

## Fora de escopo
- Deploy e qualquer ambiente além do local.
- Gateway de pagamento real, e-mail e notificações.
- App mobile e qualidade visual (nenhum critério de design).
- Cadastro de organizador pelo produto.
- Mais de um ingresso por compra, mapa de assentos, cancelamento ou transferência de ingresso pelo participante.
- Atualização em tempo real (recarregar a página basta).
- Fuso horário (o fluxo usa datas com pelo menos um dia de folga).

## Restrições
- Máquina do avaliador: Linux ou macOS, Docker, Git e Node.js LTS. Qualquer runtime além do Node roda em contêiner.
- O modo padrão usa o gateway simulado, sem chave real. O atraso pode ser configurável no ambiente de testes, desde que o modo padrão siga a tabela.

## Fluxo do avaliador (resumo)
`$WEB`/`$API` = endereços do README; `$KEY` = chave de parceiro; contas org A, org B e participante vêm da seed.

1. Clone limpo + comando de subida → produto acessível com seed.
2. Org A cria E1 (lotação 2, R$ 100,00, mês seguinte) sem publicar: fora da vitrine e da API.
3. Criar evento com data de ontem é rejeitado.
4. Publicar E1: aparece na vitrine e na API com `availableSeats` 2 e `priceCents` 10000.
5. Participante novo (cadastro pela UI) compra E1 na vitrine com `4000000000000001`: "Meus ingressos" mostra pendente e, em ≤ 5 s, confirmado. Código C1.
6. Compra pela API com `4000000000000004` → `202 pending` (T2/C2); listagem mostra `availableSeats` 0.
7. Antes de 30 s: compra API com `...0001` → `409 sold_out`; vitrine mostra `Ingressos esgotados` ao participante.
8. Após 45 s: T2 `declined`, `availableSeats` 1. Compra API `...0001` (T3) → `confirmed` em ≤ 5 s.
9. Reduzir lotação para 1: rejeitado. Preço R$ 150,00 e lotação 3: aceito. Compra API `...0001` (T4). Painel: Confirmados 3, Pendentes 0, Check-ins 0, Vagas 0, Receita R$ 350,00, Estornados 0.
10. Check-in: C1 → `Entrada liberada`; C1 → `Ingresso já utilizado`; C2 → `Ingresso não confirmado`; `ZZZZZZZZ` → `Ingresso inválido para este evento`. Painel Check-ins 1.
11. Org B não vê E1 na lista nem pelo endereço direto. B cria/publica E2 (lotação 1, R$ 20,00), compra pela API (C3). Participante da seed e visitante também não veem E1 pelo endereço. A: C3 no check-in de E1 → `Ingresso inválido para este evento`.
12. A cria/publica E3 (lotação 5, R$ 50,00); compra API `...0003` (T5) e `...0001` (T6/C6); T6 confirmado; antes de 30 s da T5, cancela E3.
13. E3 sai da vitrine e da API; compra API → `404 event_not_available`. Em ≤ 10 s: T6 `refunded`, T5 `cancelled`. Página não permite editar.
14. Após 45 s da T5: T5 continua `cancelled`. Check-in C6 → `Evento cancelado`. Painel E3: 0, 0, 0, 0, R$ 0,00, Estornados 1.
15. E4 (lotação 5, R$ 10,00): 30 compras simultâneas → exatamente 5 × `202` e 25 × `409`; em ≤ 10 s painel Confirmados 5, Vagas 0. Repetir com E5.
16. Sem chave/chave errada nas três rotas → `401 unauthorized`; `cardNumber "123"` → `422 invalid_request`; ticket inexistente → `404 ticket_not_found`.
17. Gates passam; derrubar fecha portas e contêineres; subir de novo funciona e a seed continua válida.
18. Artefatos conferidos pelo mapa do README; relatório nunca alterado aparece em um único commit.
