# Validação final contra a `main`

Fluxo do avaliador rodado depois do último merge, a partir de um **clone limpo do GitHub**, num contêiner Linux (`docker:27-cli` com Docker do host via socket, Node 22, Git 2.47), sem nenhum passo além do comando de subida do README.

| Execução | Commit da `main` | Resultado | Log |
|---|---|---|---|
| Tentativa 1 | `93093c6`/`31c113f` | **falhou** no passo 1: `./scripts/up.sh: Permission denied` (bit de execução perdido no Git; no Windows não aparece) | [log](2026-11-27-tentativa-1-permission-denied.log) |
| Correção | PR [#9](https://github.com/LeoAbra/mba-ia-desafio-catraca/pull/9) restaura o modo `100755` de `up.sh`, `down.sh`, `gates.sh` | — | — |
| Tentativa 2 | `47d85c4` | **87 ✓ · 0 ✗** — passos 1 a 17, incluindo gates (122 testes), derrubar (nenhum contêiner/porta), subir de novo e seed válida | [log](2026-11-27-fluxo-clone-limpo-linux.log) |
| Rajadas extras (R07) | `47d85c4` | 10 rodadas × 30 compras simultâneas em eventos novos de lotação 5: sempre `5 202` e `25 409`; máximo de vagas ocupadas no banco = 5 | [log](2026-11-27-rajadas-extras.log) |

Comando usado (do host com Docker):

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock --add-host=host.docker.internal:host-gateway docker:27-cli sh -c '
  apk add --no-cache bash curl git nodejs coreutils
  git clone https://github.com/LeoAbra/mba-ia-desafio-catraca.git && cd mba-ia-desafio-catraca
  ./scripts/up.sh
  WEB=http://host.docker.internal:3000 ./scripts/evaluator-flow.sh --harness'
```

Num Linux/macOS direto, sem contêiner: `./scripts/up.sh && ./scripts/evaluator-flow.sh --harness`.
