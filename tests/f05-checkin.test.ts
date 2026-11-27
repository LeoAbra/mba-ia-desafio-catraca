import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkinOutcome, CHECKIN_MESSAGES, normalizeCode } from '../src/features/checkin/rules.js';
import { createPublishedEvent, loginAs, ORG_A, ORG_B, PARTICIPANT, setupTestEnv, waitFor, type Agent, type TestEnv } from './helpers.js';

let env: TestEnv;
let orgA: Agent;
let orgB: Agent;
beforeAll(async () => {
  env = await setupTestEnv();
  orgA = await loginAs(env, ORG_A);
  orgB = await loginAs(env, ORG_B);
});
afterAll(async () => {
  await env.close();
});

type Status = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'refunded';
const ev = { id: 'e1', status: 'published' };
const tk = (o: Partial<{ eventId: string; status: Status; checkedInAt: Date | null }> = {}) => ({
  eventId: 'e1',
  status: 'confirmed' as Status,
  checkedInAt: null as Date | null,
  ...o,
});

describe('F05 regra R10 (unitário)', () => {
  it('código inexistente ou de outro evento: inválido, mesmo com evento cancelado', () => {
    expect(checkinOutcome(undefined, ev)).toBe('invalid');
    expect(checkinOutcome(tk({ eventId: 'e2' }), ev)).toBe('invalid');
    expect(checkinOutcome(undefined, { id: 'e1', status: 'cancelled' })).toBe('invalid');
    expect(checkinOutcome(tk({ eventId: 'e2', status: 'pending' }), { id: 'e1', status: 'cancelled' })).toBe('invalid');
  });
  it('evento cancelado vence status do ingresso e check-in', () => {
    const c = { id: 'e1', status: 'cancelled' };
    expect(checkinOutcome(tk(), c)).toBe('cancelled');
    expect(checkinOutcome(tk({ status: 'pending' }), c)).toBe('cancelled');
    expect(checkinOutcome(tk({ checkedInAt: new Date() }), c)).toBe('cancelled');
  });
  it.each(['pending', 'declined', 'cancelled', 'refunded'] as const)('%s: não confirmado (vence já utilizado)', (status) => {
    expect(checkinOutcome(tk({ status }), ev)).toBe('notConfirmed');
    expect(checkinOutcome(tk({ status, checkedInAt: new Date() }), ev)).toBe('notConfirmed');
  });
  it('confirmado: usado ou liberado', () => {
    expect(checkinOutcome(tk({ checkedInAt: new Date() }), ev)).toBe('used');
    expect(checkinOutcome(tk(), ev)).toBe('granted');
  });
  it('mensagens exatas e normalização', () => {
    expect(Object.values(CHECKIN_MESSAGES)).toEqual([
      'Ingresso inválido para este evento',
      'Evento cancelado',
      'Ingresso não confirmado',
      'Ingresso já utilizado',
      'Entrada liberada',
    ]);
    expect(normalizeCode('  ab12cd34 ')).toBe('AB12CD34');
    expect(normalizeCode(undefined)).toBe('');
  });
});

let n = 0;
async function buyTicket(eventId: string, card: string): Promise<string> {
  const p = request.agent(env.catraca.app);
  n += 1;
  await p.post('/cadastro').type('form').send({ name: `C${n}`, email: `c${n}-${Date.now()}@example.com`, password: 'segredo1' });
  await p.post(`/eventos/${eventId}/comprar`).type('form').send({ cardNumber: card });
  const { rows } = await env.pool.query('SELECT code FROM tickets WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1', [eventId]);
  return rows[0].code as string;
}
const confirmedTicket = async (eventId: string) => {
  const code = await buyTicket(eventId, '4000000000000001');
  await env.catraca.ctx.payments.idle();
  return code;
};
const checkin = (agent: Agent, eventId: string, code: string) =>
  agent.post(`/organizador/eventos/${eventId}/checkin`).type('form').send({ code });
const msgOf = (text: string) => /<p class="msg" role="status" data-checkin="[a-zA-Z]+">([^<]*)<\/p>/.exec(text)?.[1];
const checkedIn = async (code: string) =>
  (await env.pool.query('SELECT checked_in_at FROM tickets WHERE code = $1', [code])).rows[0].checked_in_at !== null;

describe('F05 check-in pela rota (AC-F05-01..06, X06, X07)', () => {
  it('a página de gerenciamento tem a seção Check-in com o formulário', async () => {
    const id = await createPublishedEvent(orgA, { capacity: 5 });
    const page = await orgA.get(`/organizador/eventos/${id}`);
    expect(page.text).toContain('<section id="checkin">');
    expect(page.text).toContain(`action="/organizador/eventos/${id}/checkin"`);
    expect(page.text).toContain('name="code"');
  });

  it('as cinco mensagens, na ordem do R10', async () => {
    const e1 = await createPublishedEvent(orgA, { capacity: 5 });
    const e2 = await createPublishedEvent(orgB, { capacity: 5 });
    const c1 = await confirmedTicket(e1);
    const c3 = await confirmedTicket(e2);
    const c2 = await buyTicket(e1, '4000000000000004'); // pendente, depois recusado

    let res = await checkin(orgA, e1, 'ZZZZZZZZ');
    expect(res.status).toBe(200);
    expect(msgOf(res.text)).toBe('Ingresso inválido para este evento');

    res = await checkin(orgA, e1, c3);
    expect(msgOf(res.text)).toBe('Ingresso inválido para este evento');
    expect(await checkedIn(c3)).toBe(false);

    res = await checkin(orgA, e1, c2);
    expect(msgOf(res.text)).toBe('Ingresso não confirmado');
    await waitFor(async () => (await env.pool.query('SELECT status FROM tickets WHERE code=$1', [c2])).rows[0].status === 'declined', 3000);
    res = await checkin(orgA, e1, c2);
    expect(msgOf(res.text)).toBe('Ingresso não confirmado');
    expect(await checkedIn(c2)).toBe(false);

    res = await checkin(orgA, e1, c1.toLowerCase());
    expect(msgOf(res.text)).toBe('Entrada liberada');
    expect(res.text).toContain('<section id="checkin">');
    expect(await checkedIn(c1)).toBe(true);

    res = await checkin(orgA, e1, ` ${c1} `);
    expect(msgOf(res.text)).toBe('Ingresso já utilizado');
  });

  it('evento cancelado: campo continua e vale a lista', async () => {
    const e3 = await createPublishedEvent(orgA, { capacity: 5 });
    const c6 = await confirmedTicket(e3);
    await env.pool.query("UPDATE events SET status='cancelled' WHERE id=$1", [e3]);
    let res = await checkin(orgA, e3, c6);
    expect(msgOf(res.text)).toBe('Evento cancelado');
    expect(await checkedIn(c6)).toBe(false);
    res = await checkin(orgA, e3, 'ZZZZZZZZ');
    expect(msgOf(res.text)).toBe('Ingresso inválido para este evento');
  });

  it('só o dono: outro organizador 404 sem dados, participante 403, visitante redirecionado', async () => {
    const e1 = await createPublishedEvent(orgA, { name: 'Segredo Dono', capacity: 5 });
    const c = await confirmedTicket(e1);
    const res = await checkin(orgB, e1, c);
    expect(res.status).toBe(404);
    expect(res.text).toContain('Evento não encontrado');
    expect(res.text).not.toContain('Segredo Dono');
    const part = await loginAs(env, PARTICIPANT);
    expect((await checkin(part, e1, c)).status).toBe(403);
    const anon = await request(env.catraca.app).post(`/organizador/eventos/${e1}/checkin`).type('form').send({ code: c });
    expect(anon.status).toBe(302);
    expect(await checkedIn(c)).toBe(false);
  });

  it('check-ins simultâneos do mesmo código: exatamente um libera', async () => {
    const e1 = await createPublishedEvent(orgA, { capacity: 5 });
    const c = await confirmedTicket(e1);
    const results = await Promise.all(Array.from({ length: 6 }, () => checkin(orgA, e1, c)));
    const msgs = results.map((r) => msgOf(r.text));
    expect(msgs.filter((m) => m === 'Entrada liberada')).toHaveLength(1);
    expect(msgs.filter((m) => m === 'Ingresso já utilizado')).toHaveLength(5);
  });
});
