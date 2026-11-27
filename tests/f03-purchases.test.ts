import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { purchaseTicket } from '../src/features/purchases/purchase.service.js';
import {
  createEvent,
  createPublishedEvent,
  localDate,
  loginAs,
  ORG_A,
  PARTICIPANT,
  setupTestEnv,
  sleep,
  waitFor,
  type Agent,
  type TestEnv,
} from './helpers.js';

// Gates rodam com GATEWAY_DELAY_SCALE=0.01: 2–5 s viram 20–50 ms; 30–40 s viram 300–400 ms.
let env: TestEnv;
let org: Agent;
beforeAll(async () => {
  env = await setupTestEnv();
  org = await loginAs(env, ORG_A);
});
afterAll(async () => {
  await env.close();
});

let n = 0;
async function newParticipant(): Promise<Agent> {
  const agent = request.agent(env.catraca.app);
  n += 1;
  const res = await agent.post('/cadastro').type('form').send({ name: `P${n}`, email: `p${n}-${Date.now()}@example.com`, password: 'segredo1' });
  expect(res.status).toBe(302);
  return agent;
}
const buy = (agent: Agent, eventId: string, cardNumber: string) =>
  agent.post(`/eventos/${eventId}/comprar`).type('form').send({ cardNumber });
const ticketsOf = async (eventId: string) =>
  (await env.pool.query('SELECT id, status, price_cents, code FROM tickets WHERE event_id = $1 ORDER BY created_at', [eventId])).rows;
const statusOf = async (eventId: string) => (await ticketsOf(eventId)).map((t) => t.status);

describe('F03 compra pela vitrine (AC-F03-01..05, X02)', () => {
  it('nasce pendente, ocupa vaga e confirma com 0001', async () => {
    const id = await createPublishedEvent(org, { capacity: 2, name: 'Jazz' });
    const p = await newParticipant();
    const started = Date.now();
    const res = await buy(p, id, '4000000000000001');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/meus-ingressos?aviso=compra');
    expect(Date.now() - started).toBeLessThan(1000);
    expect(await statusOf(id)).toEqual(['pending']);
    expect((await p.get('/meus-ingressos')).text).toContain('pendente');
    expect((await p.get(`/eventos/${id}`)).text).toContain('Vagas disponíveis:</strong> 1');
    await env.catraca.ctx.payments.idle();
    const mine = await p.get('/meus-ingressos');
    expect(mine.text).toContain('confirmado');
    expect(mine.text).toContain('Jazz');
    expect(mine.text).toMatch(/<code>[A-Z0-9]{8}<\/code>/);
  });

  it.each(['4000000000000002', '4000000000000009', '4000000000000004'])('cartão %s recusa e libera a vaga', async (card) => {
    const id = await createPublishedEvent(org, { capacity: 1 });
    const p = await newParticipant();
    await buy(p, id, card);
    expect((await p.get(`/eventos/${id}`)).text).toContain('Ingressos esgotados');
    await env.catraca.ctx.payments.idle();
    expect(await statusOf(id)).toEqual(['declined']);
    expect((await p.get('/meus-ingressos')).text).toContain('recusado');
    expect((await p.get(`/eventos/${id}`)).text).toContain('Vagas disponíveis:</strong> 1');
  });

  it('0003 fica pendente na faixa lenta e confirma', async () => {
    const id = await createPublishedEvent(org, { capacity: 3 });
    const p = await newParticipant();
    await buy(p, id, '4000000000000003');
    await sleep(150); // < 300 ms (30 s × 0,01)
    expect(await statusOf(id)).toEqual(['pending']);
    await waitFor(async () => (await statusOf(id))[0] === 'confirmed', 2000);
  });

  it.each(['123', '40000000000000011', '400000000000000a', ''])('cartão "%s" é rejeitado sem criar ingresso', async (card) => {
    const id = await createPublishedEvent(org, { capacity: 2 });
    const p = await newParticipant();
    const res = await buy(p, id, card);
    expect(res.status).toBe(422);
    expect(res.text).toContain('O número do cartão precisa ter 16 dígitos');
    expect(await ticketsOf(id)).toEqual([]);
  });

  it('visitante e organizador não compram; rascunho não vende (AC-F03-11, X03)', async () => {
    const id = await createPublishedEvent(org, { capacity: 2 });
    const page = await request(env.catraca.app).get(`/eventos/${id}`);
    expect(page.text).toContain('Entre para comprar');
    expect(page.text).not.toContain('name="cardNumber"');
    const anon = await request(env.catraca.app).post(`/eventos/${id}/comprar`).type('form').send({ cardNumber: '4000000000000001' });
    expect(anon.status).toBe(302);
    expect(anon.headers.location).toMatch(/^\/entrar/);
    expect((await buy(org, id, '4000000000000001')).status).toBe(403);

    const draft = await createEvent(org, { capacity: 2 });
    const res = await buy(await newParticipant(), draft, '4000000000000001');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Evento não disponível');
    expect(await ticketsOf(draft)).toEqual([]);
  });

  it('"Meus ingressos" mostra só os do participante (X02)', async () => {
    const id = await createPublishedEvent(org, { capacity: 5, name: 'Privado P' });
    const p = await newParticipant();
    await buy(p, id, '4000000000000001');
    const [ticket] = await ticketsOf(id);
    expect((await p.get('/meus-ingressos')).text).toContain(ticket.code);
    const seed = await loginAs(env, PARTICIPANT);
    expect((await seed.get('/meus-ingressos')).text).not.toContain(ticket.code);
  });
});

describe('F03 esgotado (AC-F03-06)', () => {
  it('página mostra "Ingressos esgotados" sem formulário e a tentativa é recusada', async () => {
    const id = await createPublishedEvent(org, { capacity: 1 });
    await buy(await newParticipant(), id, '4000000000000003');
    const p = await newParticipant();
    const page = await p.get(`/eventos/${id}`);
    expect(page.text).toContain('Ingressos esgotados');
    expect(page.text).not.toContain('name="cardNumber"');
    const res = await buy(p, id, '4000000000000001');
    expect(res.status).toBe(409);
    expect(res.text).toContain('Ingressos esgotados');
    expect((await ticketsOf(id)).length).toBe(1);
  });
});

describe('F03 lotação e preço (AC-F03-09, AC-F03-10, X03)', () => {
  it('rejeita reduzir abaixo das ocupadas e aceita aumentar', async () => {
    const startsAt = localDate(30, '21:00');
    const id = await createPublishedEvent(org, { capacity: 2, startsAt });
    const p = await newParticipant();
    await buy(p, id, '4000000000000001');
    await buy(p, id, '4000000000000003');
    const form = { name: 'Evento Teste', startsAt, venue: 'Porão', price: '100,00' };
    const low = await org.post(`/organizador/eventos/${id}/editar`).type('form').send({ ...form, capacity: '1' });
    expect(low.status).toBe(422);
    expect(low.text).toContain('A lotação não pode ficar menor que as vagas ocupadas (2)');
    const up = await org.post(`/organizador/eventos/${id}/editar`).type('form').send({ ...form, capacity: '3' });
    expect(up.status).toBe(302);
    expect((await p.get(`/eventos/${id}`)).text).toContain('Vagas disponíveis:</strong> 1');
  });

  it('cada ingresso guarda o preço vigente na compra', async () => {
    const startsAt = localDate(30, '21:00');
    const id = await createPublishedEvent(org, { capacity: 5, startsAt, price: '100,00' });
    const p = await newParticipant();
    await buy(p, id, '4000000000000001');
    await org.post(`/organizador/eventos/${id}/editar`).type('form').send({ name: 'Evento Teste', startsAt, venue: 'Porão', capacity: '5', price: '150,00' });
    await buy(p, id, '4000000000000001');
    expect((await ticketsOf(id)).map((t) => t.price_cents)).toEqual([10000, 15000]);
  });
});

describe('F03 resposta do gateway só vale para pendente (base de R11)', () => {
  it('não altera ingresso que deixou de ser pendente', async () => {
    const id = await createPublishedEvent(org, { capacity: 2 });
    const ticket = await purchaseTicket(
      { pool: env.pool, payments: env.catraca.ctx.payments },
      { eventId: id, cardNumber: '4000000000000003', channel: 'partner', userId: null, buyerEmail: 'x@example.com' },
    );
    await env.pool.query("UPDATE tickets SET status = 'cancelled' WHERE id = $1", [ticket.id]);
    await env.catraca.ctx.payments.idle();
    expect(await statusOf(id)).toEqual(['cancelled']);
    const { rows } = await env.pool.query('SELECT status FROM payments WHERE ticket_id = $1', [ticket.id]);
    expect(rows[0].status).toBe('approved');
  });

  it('retoma no boot pagamentos que ficaram processando', async () => {
    const id = await createPublishedEvent(org, { capacity: 2 });
    const p = await newParticipant();
    await buy(p, id, '4000000000000001');
    await env.catraca.ctx.payments.idle();
    // Simula um pagamento que ficou "processing" com o processo reiniciado no meio.
    await env.pool.query("UPDATE tickets SET status = 'pending' WHERE event_id = $1", [id]);
    await env.pool.query("UPDATE payments SET status = 'processing', responded_at = NULL WHERE ticket_id IN (SELECT id FROM tickets WHERE event_id = $1)", [id]);
    expect(await env.catraca.ctx.payments.resumePending()).toBeGreaterThanOrEqual(1);
    await env.catraca.ctx.payments.idle();
    expect(await statusOf(id)).toEqual(['confirmed']);
  });
});
