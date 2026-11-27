# Contrato: F01 Fundação e Contas

## Pré-requisitos
**Serviços:** produto no ar via `./scripts/up.sh` (com `COMPOSE_PROJECT_NAME`/`CATRACA_PORT` opcionais); `$WEB` = `http://localhost:<porta>`.
**Estado persistente:** contas da seed — `organizador.a@catraca.dev`, `organizador.b@catraca.dev` (organizadores) e `participante@catraca.dev` (participante), todas com senha `catraca123`.
**Configuração:** nenhuma variável obrigatória; modo padrão.
**Dependências externas:** Docker com Compose v2, `curl`, `bash`.

## Quality gates
- **gates** — `./scripts/gates.sh` — typecheck, check-artifacts e testes automatizados passam (exit 0)

## Mapa de cobertura
| Critério do PRD | Itens |
|---|---|
| AC-F01-01 Um visitante cria uma conta de participante informando nome, e-mail e senha e fica logado como participante. | UI-SIGNUP-01 |
| AC-F01-02 O cadastro é rejeitado, com mensagem e sem criar conta, quando o nome está vazio, o e-mail é mal formado ou já existe, ou a senha tem menos de 6 caracteres. | UI-SIGNUP-02, UI-SIGNUP-03, UI-SIGNUP-04, UI-SIGNUP-05 |
| AC-F01-03 As contas da seed (organizador A, organizador B, participante) entram com as credenciais do README; e-mail ou senha errados são rejeitados. | UI-LOGIN-01, UI-LOGIN-02, UI-LOGIN-03 |
| AC-F01-04 Sair encerra a sessão: depois de sair, páginas que exigem login voltam a pedir login. | UI-LOGOUT-01 |
| AC-F01-05 O cadastro nunca cria organizador: toda conta criada pelo produto tem papel participante. | UI-SIGNUP-06 |
| AC-F01-06 Visitante que acessa a área do organizador é levado ao login, e participante recebe acesso negado (403) sem dados de eventos (R13). | UI-GUARD-01, UI-GUARD-02, UI-GUARD-03 |
| AC-F01-07 Em um clone limpo, o comando de subida deixa o produto acessível em `$WEB` com a seed aplicada; derrubar e subir de novo funciona sem erro e a seed continua válida. | E2E-HARNESS-01, E2E-HARNESS-03 |
| AC-F01-08 O comando de derrubar encerra todos os contêineres e portas abertos pela subida, e o comando de gates roda os testes automatizados e termina com sucesso. | E2E-HARNESS-02, E2E-HARNESS-04 |

## UI
**Modo de verificação:** requisições HTTP com cookie jar (`curl -c/-b`) às páginas HTML; asserções sobre status, `Location` e texto do HTML.

### Signup
#### `UI-SIGNUP-01` — cadastro de participante
- given: nenhum usuário com e-mail `novo+<ts>@example.com`
- when: `POST /cadastro` com `name=Ana`, `email=novo+<ts>@example.com`, `password=segredo1`
- then:
  - resposta `302` para `/`
  - `Set-Cookie` com `catraca_sid`
  - `GET /` com o cookie mostra "Ana" e o link "Meus ingressos" (papel participante)

#### `UI-SIGNUP-02` — nome vazio
- given: (nenhum)
- when: `POST /cadastro` com `name=` (vazio), e-mail novo e senha válida
- then:
  - resposta `422` com a mensagem "Informe o nome"
  - login com aquele e-mail falha (conta não criada)

#### `UI-SIGNUP-03` — e-mail mal formado
- when: `POST /cadastro` com `email=nao-e-email`
- then:
  - resposta `422` com a mensagem "E-mail inválido"

#### `UI-SIGNUP-04` — e-mail repetido
- given: a conta da seed `participante@catraca.dev`
- when: `POST /cadastro` com `email=participante@catraca.dev`
- then:
  - resposta `422` com a mensagem "E-mail já cadastrado"

#### `UI-SIGNUP-05` — senha curta
- when: `POST /cadastro` com `password=12345`
- then:
  - resposta `422` com a mensagem "A senha precisa ter pelo menos 6 caracteres"

#### `UI-SIGNUP-06` — cadastro não cria organizador
- given: (nenhum)
- when: `POST /cadastro` com e-mail novo, senha válida e um campo extra `role=organizer`
- then:
  - a conta criada entra no produto como participante: `GET /organizador` com o cookie responde `403`

### Login
#### `UI-LOGIN-01` — organizadores da seed
- when: `POST /entrar` com `organizador.a@catraca.dev` / `catraca123` (e depois o mesmo para `organizador.b@catraca.dev`)
- then:
  - `302` para `/organizador`
  - `GET /organizador` com o cookie responde `200` e mostra "Meus eventos"

#### `UI-LOGIN-02` — participante da seed
- when: `POST /entrar` com `participante@catraca.dev` / `catraca123`
- then:
  - `302` para `/`
  - `GET /` com o cookie mostra "Meus ingressos"

#### `UI-LOGIN-03` — credenciais erradas
- when: `POST /entrar` com `participante@catraca.dev` / `errada`, e com `ninguem@example.com` / `catraca123`
- then:
  - `401` com a mensagem "E-mail ou senha inválidos" nos dois casos
  - sem `Set-Cookie` de sessão

### Logout
#### `UI-LOGOUT-01` — sair encerra a sessão
- given: participante da seed logado
- when: `POST /sair` com o cookie
- then:
  - `302` para `/`
  - com o mesmo cookie, `GET /meus-ingressos` responde `302` para `/entrar…` (a sessão antiga não vale mais)

### Guard
#### `UI-GUARD-01` — visitante na área do organizador
- when: `GET /organizador` sem cookie
- then:
  - `302` com `Location` começando por `/entrar`

#### `UI-GUARD-02` — participante na área do organizador
- given: participante da seed logado
- when: `GET /organizador`
- then:
  - `403` com "Acesso restrito a organizadores"
  - nenhum nome de evento no HTML

#### `UI-GUARD-03` — visitante em página de participante
- when: `GET /meus-ingressos` sem cookie
- then:
  - `302` com `Location` começando por `/entrar`

## E2E
**Modo de verificação:** executar os scripts do harness num shell e observar processos, portas e respostas HTTP.

### Harness
#### `E2E-HARNESS-01` — subida em clone limpo
- given: clone novo do repositório numa pasta vazia, sem volume do projeto
- when: `./scripts/up.sh`
- then:
  - exit code 0
  - `GET $WEB/health` responde `200 {"status":"ok"}`
  - login de `organizador.a@catraca.dev` funciona (seed aplicada sem passo extra)

#### `E2E-HARNESS-02` — derrubar encerra tudo
- given: produto no ar
- when: `./scripts/down.sh`
- then:
  - `docker ps --filter label=com.docker.compose.project=<projeto>` vazio
  - `curl $WEB/health` falha (porta fechada)

#### `E2E-HARNESS-03` — subir de novo
- given: produto derrubado depois de já ter subido uma vez (volume preservado)
- when: `./scripts/up.sh`
- then:
  - exit code 0, sem erro de seed nos logs (`docker compose logs app`)
  - login das três contas da seed continua funcionando

#### `E2E-HARNESS-04` — gates
- when: `./scripts/gates.sh`
- then:
  - exit code 0
  - a saída mostra testes do Vitest executados e aprovados
