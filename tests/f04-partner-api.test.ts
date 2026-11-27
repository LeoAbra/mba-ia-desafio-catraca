import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { formatIso, parseLocalDateTime } from '../src/shared/time.js';
import {
  createEvent,
  createPublishedEvent,
  localDate,
  loginAs,
  ORG_A,
  PARTICIPANT,
  setupTestEnv,
  waitFor,
  type Agent,
  type TestEnv,
} from './helpers.js';

// Gates rodam com GATEWAY_DELAY_SCALE=0.01: 2–5 s viram 20–50 ms.
let env: TestEnv;
let org: Agent;
const KEY = loadConfig().partnerApiKey;
beforeAll(async () => {
  env = await setupTestEnv();
  org = await loginAs(env, ORG_A);
});
afterAll(async () => {
  await env.close();
});

const api = () => request(env.catraca.app);
const withKey = (r: request.Test) => r.set('X-Api-Key', KEY);
const list = async () => (await withKey(api().get('/api/partner/events'))).body as Array<Record<string, unknown>>;
const seatsOf = async (id: string) => (await list()).find((e) => e.id === id)?.availableSeats;
const GOOD = { buyerEmail: 'ana@example.com', cardNumber: '4000000000000001' };
const purchase = (eventId: string, body: unknown = GOOD) =>
  withKey(api().post(`/api/partner/events/${eventId}/purchases`)).send(body as object);
const rawPurchase = (eventId: string, raw: string) =>
  withKey(api().post(`/api/partner/events/${eventId}/purchases`).set('Content-Type', 'application/json')).send(raw);
const ticketCount = async (eventId: string) =>
  Number((await env.pool.query('SELECT count(*) FROM tickets WHERE event_id = $1', [eventId])).rows[0].count);
const getTicket = (id: string) => withKey(api().get(`/api/partner/tickets/${id}`));

describe('F04 autenticação (AC-F04-01)', () => {
  it('401 nas três rotas, sem chave e com chave errada, sem criar ingresso', async () => {
    const evt = await createPublishedEvent(org);
    const t = (await purchase(evt)).body.ticketId as string;
    const before = await ticketCount(evt);
    const calls: Array<() => request.Test> = [
      () => api().get('/api/partner/events'),
      () => api().post(`/api/partner/events/${evt}/purchases`).send(GOOD),
      () => api().get(`/api/partner/tickets/${t}`),
    ];
    for (const call of calls) {
      for (const r of [await call(), await call().set('X-Api-Key', 'errada'), await call().set('X-Api-Key', '')]) {
        expect(r.status).toBe(401);
        expect(r.body).toEqual({ error: 'unauthorized' });
      }
    }
    expect(await ticketCount(evt)).toBe(before);
  });

  it('401 vale para rota desconhecida e vem antes de ler o corpo malformado', async () => {
    expect((await api().get('/api/partner/qualquer')).status).toBe(401);
    const r = await api().post('/api/partner/events/x/purchases').set('Content-Type', 'application/json').send('{');
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: 'unauthorized' });
  });

  it('rota desconhecida com chave válida: 404 JSON', async () => {
    const r = await withKey(api().get('/api/partner/qualquer'));
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: 'not_found' });
  });
});

describe('F04 listagem (AC-F04-02, X04, X05)', () => {
  it('lista publicados com exatamente 5 chaves; não lista rascunho', async () => {
    const startsAt = localDate(30, '21:00');
    const p = await createPublishedEvent(org, { name: 'Jazz API', startsAt, capacity: 2, price: '100,00' });
    const d = await createEvent(org, { name: 'Rascunho API' });
    const r = await withKey(api().get('/api/partner/events'));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    const found = (r.body as Array<{ id: string }>).find((e) => e.id === p);
    expect(found).toEqual({
      id: p,
      name: 'Jazz API',
      startsAt: formatIso(parseLocalDateTime(startsAt) as Date),
      priceCents: 10000,
      availableSeats: 2,
    });
    expect((found as unknown as { startsAt: string }).startsAt).toBe(`${startsAt}:00-03:00`);
    expect((r.body as Array<{ id: string }>).some((e) => e.id === d)).toBe(false);
  });

  it('availableSeats cai com a compra e volta com a recusa', async () => {
    const p = await createPublishedEvent(org, { capacity: 2 });
    expect(await seatsOf(p)).toBe(2);
    const r = await purchase(p, { buyerEmail: 'ana@example.com', cardNumber: '4000000000000004' });
    expect(r.status).toBe(202);
    expect(await seatsOf(p)).toBe(1);
    await env.catraca.ctx.payments.idle();
    expect(await seatsOf(p)).toBe(2);
  });

  it('evento cancelado sai da listagem e não aceita compra', async () => {
    const p = await createPublishedEvent(org);
    await env.pool.query("UPDATE events SET status = 'cancelled' WHERE id = $1", [p]);
    expect((await list()).some((e) => e.id === p)).toBe(false);
    expect((await purchase(p)).status).toBe(404);
  });
});

describe('F04 compra (AC-F04-03/04, X05)', () => {
  it('202 com exatamente 3 chaves, rápido, canal partner sem conta, confirma depois', async () => {
    const p = await createPublishedEvent(org, { capacity: 3 });
    const started = Date.now();
    const r = await purchase(p);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(r.status).toBe(202);
    expect(Object.keys(r.body).sort()).toEqual(['code', 'status', 'ticketId']);
    expect(r.body.ticketId).toMatch(/^tkt_/);
    expect(r.body.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(r.body.status).toBe('pending');
    const row = (await env.pool.query('SELECT channel, user_id FROM tickets WHERE id = $1', [r.body.ticketId])).rows[0];
    expect(row).toEqual({ channel: 'partner', user_id: null });
    await waitFor(async () => (await getTicket(r.body.ticketId)).body.status === 'confirmed');
  });

  it('corpo inválido: 422 e nenhum ingresso', async () => {
    const p = await createPublishedEvent(org, { capacity: 3 });
    const bodies: unknown[] = [
      { buyerEmail: 'ana@example.com' },
      { cardNumber: '4000000000000001' },
      { buyerEmail: 'nao-e-email', cardNumber: '4000000000000001' },
      { buyerEmail: 'ana@example.com', cardNumber: '123' },
      { buyerEmail: 'ana@example.com', cardNumber: 4000000000000001 },
      { buyerEmail: 5, cardNumber: '4000000000000001' },
      [],
      'texto',
    ];
    for (const b of bodies) {
      const r = await rawPurchase(p, JSON.stringify(b));
      expect(r.status, JSON.stringify(b)).toBe(422);
      expect(r.body).toEqual({ error: 'invalid_request' });
    }
    const malformed = await rawPurchase(p, '{');
    expect(malformed.status).toBe(422);
    expect(malformed.body).toEqual({ error: 'invalid_request' });
    const noBody = await withKey(api().post(`/api/partner/events/${p}/purchases`));
    expect(noBody.status).toBe(422);
    expect(await ticketCount(p)).toBe(0);
  });

  it('campos extras são ignorados', async () => {
    const p = await createPublishedEvent(org);
    expect((await purchase(p, { ...GOOD, extra: 1 })).status).toBe(202);
  });

  it('404 para evento inexistente e rascunho', async () => {
    const d = await createEvent(org);
    for (const id of ['evt_naoexiste', d]) {
      const r = await purchase(id);
      expect(r.status).toBe(404);
      expect(r.body).toEqual({ error: 'event_not_available' });
    }
  });

  it('409 sem vaga', async () => {
    const s = await createPublishedEvent(org, { capacity: 1 });
    expect((await purchase(s)).status).toBe(202);
    const r = await purchase(s);
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: 'sold_out' });
  });

  it('precedência: chave, depois 422, depois 404, depois 409', async () => {
    const bad = { buyerEmail: 'ana@example.com', cardNumber: '123' };
    expect((await api().post('/api/partner/events/evt_naoexiste/purchases').send(bad)).status).toBe(401);
    const b = await purchase('evt_naoexiste', bad);
    expect([b.status, b.body]).toEqual([422, { error: 'invalid_request' }]);
    const s = await createPublishedEvent(org, { capacity: 1 });
    await purchase(s);
    expect((await purchase(s, bad)).status).toBe(422);
    // rascunho com lotação tomada: 404, não 409
    await env.pool.query("UPDATE events SET status = 'draft' WHERE id = $1", [s]);
    const d = await purchase(s);
    expect([d.status, d.body]).toEqual([404, { error: 'event_not_available' }]);
  });
});

describe('F04 consulta de ingresso (AC-F04-05, X05)', () => {
  it('ingresso da API: exatamente 5 chaves; inexistente 404', async () => {
    const p = await createPublishedEvent(org);
    const bought = await purchase(p);
    const r = await getTicket(bought.body.ticketId);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ticketId: bought.body.ticketId, code: bought.body.code, eventId: p, status: 'pending', checkedIn: false });
    const nf = await getTicket('tkt_naoexiste');
    expect([nf.status, nf.body]).toEqual([404, { error: 'ticket_not_found' }]);
  });

  it('checkedIn reflete checked_in_at', async () => {
    const p = await createPublishedEvent(org);
    const id = (await purchase(p)).body.ticketId as string;
    await env.pool.query('UPDATE tickets SET checked_in_at = now() WHERE id = $1', [id]);
    expect((await getTicket(id)).body.checkedIn).toBe(true);
  });

  it('ingresso comprado na vitrine é consultável', async () => {
    const p = await createPublishedEvent(org);
    const part = await loginAs(env, PARTICIPANT);
    const res = await part.post(`/eventos/${p}/comprar`).type('form').send({ cardNumber: '4000000000000001' });
    expect(res.status).toBe(302);
    const row = (await env.pool.query("SELECT id, code FROM tickets WHERE channel = 'storefront' AND event_id = $1", [p])).rows[0];
    const r = await getTicket(row.id);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ code: row.code, eventId: p });
    expect((await part.get('/meus-ingressos')).text).toContain(row.code);
  });
});

describe('F04 rajada (AC-F04-06, R07)', () => {
  it.each([1, 2])('rodada %i: 30 compras simultâneas em lotação 5 → 5×202 e 25×409', async () => {
    const p = await createPublishedEvent(org, { capacity: 5, price: '10,00' });
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => purchase(p, { buyerEmail: `carga${i}@example.com`, cardNumber: '4000000000000001' })),
    );
    const codes = results.map((r) => r.status);
    expect(codes.filter((c) => c === 202)).toHaveLength(5);
    expect(codes.filter((c) => c === 409)).toHaveLength(25);
    await env.catraca.ctx.payments.idle();
    const rows = (await env.pool.query('SELECT status FROM tickets WHERE event_id = $1', [p])).rows;
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.status === 'confirmed')).toBe(true);
    expect(await seatsOf(p)).toBe(0);
  });
});
