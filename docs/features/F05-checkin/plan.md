# Plano F05 — Check-in

1. `src/features/checkin/rules.ts` — `CHECKIN_MESSAGES` e `checkinOutcome(ticket | undefined, event)` puro, na ordem do R10.
2. `src/features/checkin/checkin.service.ts` — `checkIn(pool, event, code)`: transação com `FOR UPDATE` no ingresso, grava `checked_in_at` só em "Entrada liberada".
3. `src/features/checkin/checkin.router.ts` — `checkinSection` (order 30) para `managePageSections` e `POST /organizador/eventos/:id/checkin` (requireOrganizer + findOwned).
4. Registrar seção e router em `src/app.ts`.
5. Testes `tests/f05-checkin.test.ts` (unitários + integração).
6. Gates → PR da onda 4 → avaliação independente.
