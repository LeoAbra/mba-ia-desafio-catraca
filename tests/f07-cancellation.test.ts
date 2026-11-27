import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { EventNotAvailable, purchaseTicket, SoldOut } from '../src/features/purchases/purchase.service.js';
import { createEvent, createPublishedEvent, localDate, loginAs, ORG_A, ORG_B, PARTICIPANT, setupTestEnv, sleep, type Agent, type TestEnv } from './helpers.js';

let env: TestEnv;
let a: Agent;
const KEY = loadConfig().partnerApiKey;
beforeAll(async () => {
  env = await setupTestEnv();
  a = await loginAs(env, ORG_A);
});
afterAll(async () => {
  await env.close();
});

const api = () => request(env.catraca.app);
const apiBuy = (eventId: string, cardNumber: string) =>
  api().post(`/api/partner/events/${eventId}/purchases`).set('X-Api-Key', KEY).send({ buyerEmail: 'c@example.com', cardNumber });
const apiTicket = async (id: string) => (await api().get(`/api/partner/tickets/${id}`).set('X-Api-Key', KEY)).body;
const cancel = (agent: Agent, id: string) => agent.post(`/organizador/eventos/${id}/cancelar`);
const metric = (htmlText: string, name: string) => new RegExp(`data-metric="${name}"[^>]*>([^<]*)<`).exec(htmlText)?.[1];

describe('F07 ação de cancelar (AC-F07-01, AC-F07-02, X10)', () => {
  it('dono cancela publicado; página fica sem edição/publicação/cancelamento', async () => {
    const id = await createPublishedEvent(a, { name: 'Cancelável' });
    expect((await a.get(`/organizador/eventos/${id}`)).text).toContain(`/organizador/eventos/${id}/cancelar`);
    const res = await cancel(a, id);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/organizador/eventos/${id}?aviso=cancelado`);
    const page = await a.get(`/organizador/eventos/${id}`);
    expect(page.text).toContain('Cancelado');
    for (const action of ['editar', 'publicar', 'cancelar']) expect(page.text).not.toContain(`/organizador/eventos/${id}/${action}`);
    const edit = await a.post(`/organizador/eventos/${id}/editar`).type('form').send({ name: 'X', startsAt: localDate(10), venue: 'V', capacity: '9', price: '10' });
    expect(edit.status).toBe(409);
    expect((await a.post(`/organizador/eventos/${id}/publicar`)).status).toBe(409);
    const again = await cancel(a, id);
    expect(again.status).toBe(409);
    expect(again.text).toContain('Evento já cancelado');
  });

  it('rascunho não cancela; outro organizador e participante não cancelam', async () => {
    const draft = await createEvent(a);
    const res = await cancel(a, draft);
    expect(res.status).toBe(409);
    expect(res.text).toContain('Só evento publicado pode ser cancelado');

    const id = await createPublishedEvent(a, { name: 'De A' });
    const b = await loginAs(env, ORG_B);
    const byB = await cancel(b, id);
    expect(byB.status).toBe(404);
    expect(byB.text).not.toContain('De A');
    expect((await cancel(await loginAs(env, PARTICIPANT), id)).status).toBe(403);
    const { rows } = await env.pool.query('SELECT status FROM events WHERE id = $1', [draft]);
    expect(rows[0].status).toBe('draft');
    expect((await env.pool.query('SELECT status FROM events WHERE id = $1', [id])).rows[0].status).toBe('published');
  });
});

describe('F07 efeitos (AC-F07-03..05, X11–X14)', () => {
  it('migra ingressos, ignora resposta tardia e reflete em vitrine, API, check-in e painel', async () => {
    const id = await createPublishedEvent(a, { name: 'Show E3', capacity: 5, price: '50,00' });
    const t5 = (await apiBuy(id, '4000000000000003')).body; // lento: 300–400 ms nos gates
    const t6 = (await apiBuy(id, '4000000000000001')).body;
    const t7 = (await apiBuy(id, '4000000000000002')).body; // recusado: deve continuar recusado
    await sleep(120); // 0001/0002 já responderam (20–50 ms); 0003 ainda não
    expect((await apiTicket(t6.ticketId)).status).toBe('confirmed');
    expect((await apiTicket(t5.ticketId)).status).toBe('pending');

    expect((await cancel(a, id)).status).toBe(302);
    expect((await apiTicket(t6.ticketId)).status).toBe('refunded');
    expect((await apiTicket(t5.ticketId)).status).toBe('cancelled');
    expect((await apiTicket(t7.ticketId)).status).toBe('declined');

    // Vitrine, página pública e API (X10, X12)
    expect((await api().get('/')).text).not.toContain('Show E3');
    expect((await api().get(`/eventos/${id}`)).status).toBe(404);
    const list = await api().get('/api/partner/events').set('X-Api-Key', KEY);
    expect(list.body.some((e: { id: string }) => e.id === id)).toBe(false);
    const buy = await apiBuy(id, '4000000000000001');
    expect(buy.status).toBe(404);
    expect(buy.body).toEqual({ error: 'event_not_available' });
    const p = await loginAs(env, PARTICIPANT);
    expect((await p.post(`/eventos/${id}/comprar`).type('form').send({ cardNumber: '4000000000000001' })).status).toBe(404);

    // Resposta tardia do gateway (AC-F07-05)
    await env.catraca.ctx.payments.idle();
    expect((await apiTicket(t5.ticketId)).status).toBe('cancelled');
    const pay = await env.pool.query('SELECT status, responded_at FROM payments WHERE ticket_id = $1', [t5.ticketId]);
    expect(pay.rows[0].status).toBe('approved');
    expect(pay.rows[0].responded_at).not.toBeNull();

    // Check-in (X13)
    const checkin = await a.post(`/organizador/eventos/${id}/checkin`).type('form').send({ code: t6.code });
    expect(checkin.text).toContain('Evento cancelado');

    // Painel (X14)
    const page = (await a.get(`/organizador/eventos/${id}`)).text;
    expect(metric(page, 'confirmed')).toBe('0');
    expect(metric(page, 'pending')).toBe('0');
    expect(metric(page, 'checkins')).toBe('0');
    expect(metric(page, 'available')).toBe('0');
    expect(metric(page, 'revenue')).toBe('R$ 0,00');
    expect(metric(page, 'refunded')).toBe('1');
  });

  it('cancelamento no meio de uma rajada nunca deixa ingresso ativo no evento cancelado', async () => {
    for (let round = 0; round < 3; round++) {
      const id = await createPublishedEvent(a, { capacity: 20 });
      const deps = { pool: env.pool, payments: env.catraca.ctx.payments };
      const buys = Array.from({ length: 30 }, (_, i) =>
        purchaseTicket(deps, { eventId: id, cardNumber: '4000000000000001', channel: 'partner', userId: null, buyerEmail: `r${i}@example.com` }),
      );
      const cancelling = sleep(5).then(() => cancel(a, id));
      const results = await Promise.allSettled([...buys, cancelling]);
      expect((results.at(-1) as PromiseFulfilledResult<{ status: number }>).value.status).toBe(302);
      for (const r of results.slice(0, -1)) {
        // Recusa legítima: esgotou antes do cancelamento ou o evento já estava cancelado.
        if (r.status === 'rejected') expect(r.reason instanceof SoldOut || r.reason instanceof EventNotAvailable).toBe(true);
      }
      await env.catraca.ctx.payments.idle();
      const { rows } = await env.pool.query(
        "SELECT count(*)::int AS n FROM tickets WHERE event_id = $1 AND status IN ('pending', 'confirmed')",
        [id],
      );
      expect(rows[0].n).toBe(0);
    }
  });
});
