# Plano F04 — API de Parceiros

1. `src/features/partner-api/api-key.ts` — middleware de chave (`timingSafeEqual`), responde `401 {"error":"unauthorized"}`.
2. `src/features/partner-api/validation.ts` — `parsePurchaseBody(body)` → `{buyerEmail, cardNumber}` ou `undefined`.
3. `src/features/partner-api/partner.router.ts` — as três rotas; `express.json()` depois da chave; handler de erro de JSON → 422; fallback 404 JSON.
4. Registrar em `src/app.ts` (`app.use('/api/partner', partnerRouter(...))`) antes do 404 HTML.
5. Testes `tests/f04-partner-api.test.ts` (incluindo a rajada HTTP 2 × 30).
6. Gates → PR da onda 4 → avaliação independente.
