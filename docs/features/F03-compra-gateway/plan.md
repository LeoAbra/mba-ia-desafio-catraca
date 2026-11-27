# Plano F03 — Compra e Gateway

1. Migração `003_f03_tickets.sql` (`tickets`, `payments`, índices).
2. `src/features/purchases/gateway.ts` — `PaymentGateway`, `gatewayRule(last4)`, `SimulatedGateway` (escala configurável, cancelável por `AbortSignal`).
3. `src/features/purchases/tickets.repo.ts` — inserir ingresso (retry de código), buscar por id/código, listar por usuário, contagem de ocupadas.
4. `src/features/purchases/seats.ts` — `seatsFor`, `occupiedByEvent` (R05).
5. `src/features/purchases/purchase.service.ts` — `purchaseTicket` com `FOR UPDATE` no evento (R06/R07) e erros tipados.
6. `src/features/purchases/payments.processor.ts` — dispatch pós-commit, `applyResult` condicional a `pending`, `resumePending` no boot.
7. `src/features/purchases/purchases.router.ts` + seção da página pública + "Meus ingressos"; guarda de lotação (R03).
8. Composição em `src/app.ts`: processador em `ctx.services`, `onStart` (retomar), `onClose` (abortar).
9. Testes: `tests/f03-unit.test.ts`, `tests/f03-purchases.test.ts`, `tests/f03-concurrency.test.ts`.
10. Gates → PR → avaliação independente.
