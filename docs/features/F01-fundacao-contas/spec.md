# Spec F01 — Fundação e Contas

**PRD:** Seção 6/F01 · Critérios AC-F01-01 … AC-F01-08 · Regras: R13 (parte de acesso por papel)

## Escopo
**Incluído:** harness (Compose, `up`/`down`/`gates`), executor de migrações, seed idempotente, layout HTML, sessão por cookie, cadastro de participante, login, logout, guardas `requireParticipant`/`requireOrganizer`, rota `/health`.
**Não incluído:** eventos (F02), compra (F03) e qualquer tela de organizador além da guarda.

## Decisões técnicas
| Decisão | Escolha | Motivo |
|---|---|---|
| Runtime | Node.js 22 + TypeScript (compilado com `tsc`) | A máquina do avaliador já tem Node; o resto roda em contêiner. |
| HTTP/UI | Express 4 com HTML renderizado no servidor | Sem build de front; telas simples bastam (sem critério de design). Fácil de verificar com `curl`. |
| Banco | PostgreSQL 16 (`pg`) | Transações e `SELECT … FOR UPDATE` resolvem R07 sem infraestrutura extra. |
| Migrações | SQL puro em `db/migrations/NNN_fxx_*.sql`, aplicado no boot sob `pg_advisory_lock` | Sem ORM; ordem determinística; boot concorrente seguro. |
| Senha | `crypto.scrypt` com salt aleatório (`scrypt$<salt>$<hash>`), comparação `timingSafeEqual` | Sem dependência nativa. |
| Sessão | Tabela `sessions` (token aleatório de 32 bytes), cookie `catraca_sid` `HttpOnly; SameSite=Lax; Path=/`, validade 7 dias | Sessão revogável no logout. |
| Seed | `INSERT … ON CONFLICT (email) DO NOTHING` em todo boot | Idempotente: subir de novo não falha nem duplica. |
| Harness | `scripts/up.sh` = `docker compose up -d --build --wait` (healthcheck em `/health`); `down.sh` = `compose down --remove-orphans`; `gates.sh` = Compose efêmero (`docker-compose.gates.yml`) rodando typecheck + check-artifacts + Vitest | Um comando cada, sem passos manuais. Gates não publicam portas. |
| Papel | `users.role` ∈ {`participant`, `organizer`}; cadastro sempre grava `participant` | AC-F01-05. |

## Modelo
```sql
users(id text pk 'usr_…', name text, email citext-like (lower) unique, password_hash text, role text check, created_at)
sessions(token text pk, user_id → users, expires_at timestamptz)
```

## Rotas
| Rota | Comportamento |
|---|---|
| `GET /health` | `200 {"status":"ok"}` |
| `GET/POST /cadastro` | formulário nome/e-mail/senha; sucesso → cria participante, sessão, redireciona `/` |
| `GET/POST /entrar` | login; sucesso → organizador vai para `/organizador`, participante para `/` (ou `next`) |
| `POST /sair` | apaga a sessão e o cookie, redireciona `/` |
| Guarda `requireOrganizer` | sem sessão → `302 /entrar?next=…`; participante → `403` "Acesso restrito a organizadores" |
| Guarda `requireParticipant` | sem sessão → `302 /entrar?next=…`; organizador → `403` |

## Validação do cadastro
Nome não vazio (trim); e-mail `^[^\s@]+@[^\s@]+\.[^\s@]+$`, normalizado para minúsculas, único; senha ≥ 6 caracteres. Erro → `422` com a página e a mensagem.

## Seed
| Conta | E-mail | Senha | Papel |
|---|---|---|---|
| Organizador A | `organizador.a@catraca.dev` | `catraca123` | organizer |
| Organizador B | `organizador.b@catraca.dev` | `catraca123` | organizer |
| Participante | `participante@catraca.dev` | `catraca123` | participant |

## Estratégia de testes
Integração com Supertest sobre `createApp` real contra o Postgres dos gates: cadastro (sucesso e cada rejeição), login das contas da seed, logout, guardas por papel, seed rodando duas vezes.

## Premissas
- A área do organizador (`/organizador`) nasce aqui como página mínima protegida por guarda; F02 a preenche.
