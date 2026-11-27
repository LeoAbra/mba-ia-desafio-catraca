import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEvent, createPublishedEvent, localDate, loginAs, ORG_A, ORG_B, PARTICIPANT, setupTestEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});
const visitor = () => request(env.catraca.app);

describe('F02 criação (AC-F02-01, AC-F02-02)', () => {
  it('cria rascunho com os dados informados', async () => {
    const a = await loginAs(env, ORG_A);
    const id = await createEvent(a, { name: 'Jazz F02', capacity: 2, price: '100,00' });
    const page = await a.get(`/organizador/eventos/${id}?aviso=criado`);
    expect(page.status).toBe(200);
    for (const text of ['Jazz F02', 'Porão', 'R$ 100,00', 'Rascunho', 'Evento criado como rascunho']) expect(page.text).toContain(text);
  });

  it('rejeita data de ontem sem criar evento', async () => {
    const a = await loginAs(env, ORG_A);
    const before = (await a.get('/organizador')).text;
    const res = await a.post('/organizador/eventos').type('form').send({ name: 'Ontem', startsAt: localDate(-1), venue: 'X', capacity: '2', price: '10' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('A data de início precisa estar no futuro');
    expect((await a.get('/organizador')).text).toBe(before);
  });

  it.each([
    [{ capacity: '0' }, 'A lotação precisa ser um número inteiro maior ou igual a 1'],
    [{ price: '0' }, 'O preço precisa ser maior que zero'],
    [{ name: '', venue: '' }, 'Informe o local'],
  ])('rejeita %o', async (patch, msg) => {
    const a = await loginAs(env, ORG_A);
    const res = await a
      .post('/organizador/eventos')
      .type('form')
      .send({ name: 'N', startsAt: localDate(10), venue: 'V', capacity: '2', price: '10', ...patch });
    expect(res.status).toBe(422);
    expect(res.text).toContain(msg);
  });
});

describe('F02 publicação e vitrine (AC-F02-04, AC-F02-05)', () => {
  it('rascunho fora da vitrine; publicado aparece', async () => {
    const a = await loginAs(env, ORG_A);
    const id = await createEvent(a, { name: 'Rascunho Secreto' });
    expect((await visitor().get('/')).text).not.toContain('Rascunho Secreto');
    const pub = await visitor().get(`/eventos/${id}`);
    expect(pub.status).toBe(404);
    expect(pub.text).toContain('Evento não disponível');

    const res = await a.post(`/organizador/eventos/${id}/publicar`);
    expect(res.headers.location).toBe(`/organizador/eventos/${id}?aviso=publicado`);
    expect((await a.get(`/organizador/eventos/${id}`)).text).toContain('Publicado');
    const showcase = await visitor().get('/');
    expect(showcase.text).toContain('Rascunho Secreto');
    expect(showcase.text).toContain(`/eventos/${id}`);
    expect((await visitor().get(`/eventos/${id}`)).status).toBe(200);
  });

  it('lista "Meus eventos" com link próprio por evento', async () => {
    const a = await loginAs(env, ORG_A);
    const id1 = await createEvent(a, { name: 'Um' });
    const id2 = await createEvent(a, { name: 'Dois' });
    const list = await a.get('/organizador');
    expect(list.text).toContain(`/organizador/eventos/${id1}`);
    expect(list.text).toContain(`/organizador/eventos/${id2}`);
    const page = await a.get(`/organizador/eventos/${id1}`);
    expect(page.text).toContain(`/organizador/eventos/${id1}/editar`);
    expect(page.text).toContain(`/organizador/eventos/${id1}/publicar`);
  });
});

describe('F02 edição (AC-F02-03)', () => {
  it('rejeita data no passado e aceita edição válida', async () => {
    const a = await loginAs(env, ORG_A);
    const startsAt = localDate(30, '21:00');
    const id = await createPublishedEvent(a, { name: 'Editável', startsAt });
    const bad = await a
      .post(`/organizador/eventos/${id}/editar`)
      .type('form')
      .send({ name: 'Editável', startsAt: localDate(-1), venue: 'Porão', capacity: '2', price: '100,00' });
    expect(bad.status).toBe(422);
    expect(bad.text).toContain('A data de início precisa estar no futuro');

    const ok = await a
      .post(`/organizador/eventos/${id}/editar`)
      .type('form')
      .send({ name: 'Jazz Editado', startsAt, venue: 'Bar Novo', capacity: '3', price: '150,00' });
    expect(ok.status).toBe(302);
    expect(ok.headers.location).toBe(`/organizador/eventos/${id}?aviso=salvo`);
    const page = await a.get(String(ok.headers.location));
    for (const text of ['Jazz Editado', 'Bar Novo', 'R$ 150,00', 'Alterações salvas']) expect(page.text).toContain(text);
  });
});

describe('F02 acesso (AC-F02-06, X01)', () => {
  it('cada organizador vê só os seus eventos', async () => {
    const a = await loginAs(env, ORG_A);
    const b = await loginAs(env, ORG_B);
    await createEvent(a, { name: 'Evento de A' });
    await createEvent(b, { name: 'Evento de B' });
    const listA = (await a.get('/organizador')).text;
    const listB = (await b.get('/organizador')).text;
    expect(listA).toContain('Evento de A');
    expect(listA).not.toContain('Evento de B');
    expect(listB).toContain('Evento de B');
    expect(listB).not.toContain('Evento de A');
  });

  it('URL direta de outro organizador não mostra dados nem permite operar', async () => {
    const a = await loginAs(env, ORG_A);
    const b = await loginAs(env, ORG_B);
    const id = await createEvent(a, { name: 'Segredo de A', venue: 'Local Secreto', price: '77,00' });
    const page = await b.get(`/organizador/eventos/${id}`);
    expect(page.status).toBe(404);
    expect(page.text).toContain('Evento não encontrado');
    for (const leaked of ['Segredo de A', 'Local Secreto', '77,00']) expect(page.text).not.toContain(leaked);
    expect((await b.post(`/organizador/eventos/${id}/editar`).type('form').send({ name: 'Hack' })).status).toBe(404);
    expect((await b.post(`/organizador/eventos/${id}/publicar`)).status).toBe(404);
    expect((await a.get(`/organizador/eventos/${id}`)).text).toContain('Segredo de A');
  });

  it('participante 403 e visitante vai ao login', async () => {
    const a = await loginAs(env, ORG_A);
    const id = await createEvent(a, { name: 'Privado' });
    const p = await loginAs(env, PARTICIPANT);
    const res = await p.get(`/organizador/eventos/${id}`);
    expect(res.status).toBe(403);
    expect(res.text).not.toContain('Privado');
    const v = await visitor().get(`/organizador/eventos/${id}`);
    expect(v.status).toBe(302);
    expect(v.headers.location).toMatch(/^\/entrar/);
  });
});

describe('F02 evento cancelado (AC-F02-07)', () => {
  it('não edita nem republica', async () => {
    const a = await loginAs(env, ORG_A);
    const id = await createPublishedEvent(a, { name: 'Vai Cancelar' });
    await env.pool.query("UPDATE events SET status = 'cancelled' WHERE id = $1", [id]);
    const page = await a.get(`/organizador/eventos/${id}`);
    expect(page.text).toContain('Cancelado');
    expect(page.text).not.toContain(`/organizador/eventos/${id}/editar`);
    expect(page.text).not.toContain(`/organizador/eventos/${id}/publicar`);
    const edit = await a
      .post(`/organizador/eventos/${id}/editar`)
      .type('form')
      .send({ name: 'X', startsAt: localDate(10), venue: 'V', capacity: '9', price: '10' });
    expect(edit.status).toBe(409);
    expect(edit.text).toContain('Evento cancelado não pode ser editado');
    const pub = await a.post(`/organizador/eventos/${id}/publicar`);
    expect(pub.status).toBe(409);
    expect(pub.text).toContain('Evento cancelado não pode ser republicado');
    expect((await visitor().get('/')).text).not.toContain('Vai Cancelar');
    const { rows } = await env.pool.query('SELECT name, status FROM events WHERE id = $1', [id]);
    expect(rows[0]).toEqual({ name: 'Vai Cancelar', status: 'cancelled' });
  });
});
