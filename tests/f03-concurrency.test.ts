import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { purchaseTicket, SoldOut } from '../src/features/purchases/purchase.service.js';
import { createPublishedEvent, loginAs, ORG_A, setupTestEnv, type TestEnv } from './helpers.js';

/**
 * Prova de R07: em várias rodadas, cada uma num evento novo de lotação 5,
 * 30 compras simultâneas resultam em exatamente 5 ingressos e 25 SoldOut,
 * e o banco nunca tem mais ingressos ocupando vaga do que a lotação.
 */
let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});

describe('F03 concorrência (AC-F03-07, R07)', () => {
  it.each([1, 2, 3])('rodada %i: 30 compras simultâneas em lotação 5', async () => {
    const org = await loginAs(env, ORG_A);
    const eventId = await createPublishedEvent(org, { capacity: 5 });
    const deps = { pool: env.pool, payments: env.catraca.ctx.payments };
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) =>
        purchaseTicket(deps, { eventId, cardNumber: '4000000000000001', channel: 'partner', userId: null, buyerEmail: `carga${i}@example.com` }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const soldOut = results.filter((r) => r.status === 'rejected' && r.reason instanceof SoldOut).length;
    expect({ ok, soldOut }).toEqual({ ok: 5, soldOut: 25 });
    const { rows } = await env.pool.query(
      "SELECT count(*)::int AS n FROM tickets WHERE event_id = $1 AND status IN ('pending', 'confirmed')",
      [eventId],
    );
    expect(rows[0].n).toBe(5);
    await env.catraca.ctx.payments.idle();
    const confirmed = await env.pool.query("SELECT count(*)::int AS n FROM tickets WHERE event_id = $1 AND status = 'confirmed'", [eventId]);
    expect(confirmed.rows[0].n).toBe(5);
  });
});
