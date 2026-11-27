# Plano F07 — Cancelamento de Evento

1. `src/features/cancellation/cancel.service.ts` — `cancelEvent(pool, organizerId, eventId)` com `FOR UPDATE` e o `UPDATE … CASE` único; resultados tipados (`cancelled`, `not-found`, `not-published`, `already-cancelled`).
2. `src/features/cancellation/cancel.router.ts` — seção (order 50) e `POST /organizador/eventos/:id/cancelar`.
3. Registrar em `src/app.ts`; aviso `cancelado` já existe em `NOTICES` (F02).
4. Testes `tests/f07-cancellation.test.ts` (inclui integração com F04, F05, F06 e corrida cancelamento × compras).
5. Gates → PR → avaliação independente → Fluxo do avaliador completo na `main`.
