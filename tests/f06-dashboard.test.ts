import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { purchaseTicket } from '../src/features/purchases/purchase.service.js';
import { formatReais } from '../src/shared/money.js';
import {
  createPublishedEvent,
  localDate,
  loginAs,
  ORG_A,
  ORG_B,
  PARTICIPANT,
  setupTestEnv,
  waitFor,
  type Agent,
  type TestEnv,
} from './helpers.js';

// Gates rodam com GATEWAY_DELAY_SCALE=0.01.
let env: TestEnv;
let org: Agent;
beforeAll(async () => {
  env = await setupTestEnv();
  org = await loginAs(env, ORG_A);
});
afterAll(async () => {
  await env.close();
});

const METRICS = ['confirmed', 'pending', 'checkins', 'available', 'revenue', 'refunded'] as const;
type Metrics = Record<(typeof METRICS)[number], string>;

async function panel(agent: Agent, eventId: string): Promise<Metrics> {
  const res = await agent.get(`/organizador/eventos/${eventId}`);
  expect(res.status).toBe(200);
  const out = {} as Metrics;
  for (const k of METRICS) {
    const m = new RegExp(`<td data-metric="${k}">([^<]*)</td>`).exec(res.text);
    expect(m, `métrica ${k}`).not.toBeNull();
    out[k] = m![1]!;
  }
  return out;
}

async function userId(email: string): Promise<string> {
  return (await env.pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])).rows[0]!.id;
}

async function buyAs(eventId: string, card: string, channel: 'storefront' | 'partner' = 'storefront') {
  const uid = channel === 'storefront' ? await userId(PARTICIPANT) : null;
  return purchaseTicket(
    { pool: env.pool, payments: env.catraca.ctx.payments },
    { eventId, cardNumber: card, channel, userId: uid, buyerEmail: PARTICIPANT },
  );
}

/** Confere o painel contra o banco (definições do R12 recalculadas à parte). */
async function expectMatchesDb(eventId: string, capacity: number) {
  const { rows } = await env.pool.query<{ status: string; checked_in_at: Date | null; price_cents: number }>(
    'SELECT status, checked_in_at, price_cents FROM tickets WHERE event_id = $1',
    [eventId],
  );
  const conf = rows.filter((t) => t.status === 'confirmed');
  const pend = rows.filter((t) => t.status === 'pending');
  const p = await panel(org, eventId);
  expect(p.confirmed).toBe(String(conf.length));
  expect(p.pending).toBe(String(pend.length));
  expect(p.checkins).toBe(String(conf.filter((t) => t.checked_in_at).length));
  expect(p.refunded).toBe(String(rows.filter((t) => t.status === 'refunded').length));
  expect(p.revenue).toBe(formatReais(conf.reduce((s, t) => s + t.price_cents, 0)));
  expect(p.available).toBe(String(Math.max(0, capacity - conf.length - pend.length)));
}

describe('F06 painel do evento', () => {
  it('UI-DASH-01: confirmado, pendente e recusado', async () => {
    const id = await createPublishedEvent(org, { capacity: 4, price: '100,00' });
    await buyAs(id, '4000000000000001');
    await buyAs(id, '4000000000000002');
    await buyAs(id, '4000000000000003'); // faixa lenta: continua pendente (300–400 ms)
    await waitFor(async () => {
      const r = await env.pool.query("SELECT 1 FROM tickets WHERE event_id = $1 AND status IN ('confirmed','declined')", [id]);
      return r.rowCount === 2;
    });
    expect(await panel(org, id)).toEqual({
      confirmed: '1',
      pending: '1',
      checkins: '0',
      available: '2',
      revenue: 'R$ 100,00',
      refunded: '0',
    });
    await expectMatchesDb(id, 4);
    await env.catraca.ctx.payments.idle();
  });

  it('painel vazio: tudo zero e todas as vagas', async () => {
    const id = await createPublishedEvent(org, { capacity: 7 });
    expect(await panel(org, id)).toEqual({
      confirmed: '0',
      pending: '0',
      checkins: '0',
      available: '7',
      revenue: 'R$ 0,00',
      refunded: '0',
    });
  });

  it('UI-DASH-02: check-in e estornados', async () => {
    const id = await createPublishedEvent(org, { capacity: 5 });
    for (let i = 0; i < 3; i++) await buyAs(id, '4000000000000001');
    await env.catraca.ctx.payments.idle();
    const { rows } = await env.pool.query<{ id: string }>('SELECT id FROM tickets WHERE event_id = $1 ORDER BY created_at', [id]);
    await env.pool.query('UPDATE tickets SET checked_in_at = now() WHERE id = $1', [rows[0]!.id]);
    await env.pool.query("UPDATE tickets SET status = 'refunded' WHERE id = $1", [rows[1]!.id]);
    expect(await panel(org, id)).toMatchObject({
      confirmed: '2',
      checkins: '1',
      refunded: '1',
      revenue: 'R$ 200,00',
      available: '3',
    });
    await expectMatchesDb(id, 5);
  });

  it('check-in em ingresso não confirmado não conta', async () => {
    const id = await createPublishedEvent(org, { capacity: 2 });
    await buyAs(id, '4000000000000001');
    await env.catraca.ctx.payments.idle();
    await env.pool.query("UPDATE tickets SET status = 'refunded', checked_in_at = now() WHERE event_id = $1", [id]);
    expect(await panel(org, id)).toMatchObject({ confirmed: '0', checkins: '0', refunded: '1', revenue: 'R$ 0,00' });
  });

  it('UI-DASH-03: receita usa o preço de cada compra', async () => {
    const startsAt = localDate(30, '21:00');
    const id = await createPublishedEvent(org, { capacity: 3, price: '100,00', startsAt });
    await buyAs(id, '4000000000000001');
    await buyAs(id, '4000000000000001');
    await env.catraca.ctx.payments.idle();
    const edit = await org
      .post(`/organizador/eventos/${id}/editar`)
      .type('form')
      .send({ name: 'Evento Teste', startsAt, venue: 'Porão', capacity: '3', price: '150,00' });
    expect(edit.status).toBe(302);
    await buyAs(id, '4000000000000001');
    await env.catraca.ctx.payments.idle();
    expect(await panel(org, id)).toMatchObject({ revenue: 'R$ 350,00', confirmed: '3', available: '0' });
    await expectMatchesDb(id, 3);
  });

  it('UI-DASH-04: evento cancelado tem vagas 0', async () => {
    const id = await createPublishedEvent(org, { capacity: 5 });
    await buyAs(id, '4000000000000003');
    await env.pool.query("UPDATE events SET status = 'cancelled' WHERE id = $1", [id]);
    const p = await panel(org, id);
    expect(p.available).toBe('0');
    expect(p.pending).toBe('1');
    await env.catraca.ctx.payments.idle();
  });

  it('UI-DASH-05: vitrine e canal parceiro contam igual', async () => {
    const id = await createPublishedEvent(org, { capacity: 5 });
    await buyAs(id, '4000000000000001', 'storefront');
    await buyAs(id, '4000000000000001', 'partner');
    await env.catraca.ctx.payments.idle();
    expect(await panel(org, id)).toMatchObject({ confirmed: '2', revenue: 'R$ 200,00', available: '3' });
    const channels = (await env.pool.query('SELECT channel FROM tickets WHERE event_id = $1 ORDER BY channel', [id])).rows.map((r) => r.channel);
    expect(channels).toEqual(['partner', 'storefront']);
  });

  it('UI-DASH-06: só o dono vê o painel', async () => {
    const id = await createPublishedEvent(org, { capacity: 2 });
    await buyAs(id, '4000000000000001');
    await env.catraca.ctx.payments.idle();
    expect((await panel(org, id)).confirmed).toBe('1');

    const b = await loginAs(env, ORG_B);
    const rb = await b.get(`/organizador/eventos/${id}`);
    expect(rb.status).toBe(404);
    expect(rb.text).not.toContain('Painel');
    expect(rb.text).not.toContain('data-metric');

    const part = await loginAs(env, PARTICIPANT);
    expect((await part.get(`/organizador/eventos/${id}`)).status).toBe(403);

    const anon = await request(env.catraca.app).get(`/organizador/eventos/${id}`);
    expect(anon.status).toBe(302);
    expect(anon.headers.location).toMatch(/^\/entrar/);
  });
});
