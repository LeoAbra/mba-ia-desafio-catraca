# Plano F02 — Gestão de Eventos

1. Migração `002_f02_events.sql` (tabela `events`, índices por organizador e por status).
2. `src/shared/time.ts` (parse `datetime-local` em `-03:00`, ISO com offset, exibição) e `src/shared/money.ts` (reais ↔ centavos, `R$ 1.234,56`), com testes unitários.
3. `src/features/events/types.ts` (EventRecord, EventStatus) e `src/shared/extensions.ts` com `managePageSections`, `eventPageSections`, `capacityGuards`.
4. `src/features/events/validation.ts` — `parseEventForm(body, now)`.
5. `src/features/events/events.repo.ts` — insert, listByOrganizer, findOwned, lockOwned, update, publish, listOnSale, findOnSale.
6. `src/features/events/pages.ts` — vitrine, página pública, lista, formulário, página de gerenciamento (renderiza seções de extensão).
7. `src/features/events/events.router.ts` — rotas públicas e da área do organizador; registrar em `src/app.ts` (remove os placeholders de F01).
8. Testes `tests/f02-events.test.ts`.
9. Gates verdes → PR → avaliação independente.
