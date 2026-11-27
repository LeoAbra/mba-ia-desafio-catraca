import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../src/seed.js';
import { loginAs, ORG_A, ORG_B, PARTICIPANT, setupTestEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});

const signup = (body: Record<string, string>) => request(env.catraca.app).post('/cadastro').type('form').send(body);

describe('F01 cadastro (AC-F01-01, AC-F01-02, AC-F01-05)', () => {
  it('cria participante logado', async () => {
    const agent = request.agent(env.catraca.app);
    const res = await agent.post('/cadastro').type('form').send({ name: 'Ana', email: 'Ana@Example.com', password: 'segredo1' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    expect(String(res.headers['set-cookie'])).toContain('catraca_sid=');
    const home = await agent.get('/');
    expect(home.text).toContain('Ana');
    expect(home.text).toContain('Meus ingressos');
  });

  it.each([
    [{ name: '', email: 'x1@example.com', password: 'segredo1' }, 'Informe o nome'],
    [{ name: 'X', email: 'nao-e-email', password: 'segredo1' }, 'E-mail inválido'],
    [{ name: 'X', email: PARTICIPANT, password: 'segredo1' }, 'E-mail já cadastrado'],
    [{ name: 'X', email: 'x2@example.com', password: '12345' }, 'A senha precisa ter pelo menos 6 caracteres'],
  ])('rejeita cadastro inválido %#', async (body, msg) => {
    const res = await signup(body);
    expect(res.status).toBe(422);
    expect(res.text).toContain(msg);
    const login = await request(env.catraca.app).post('/entrar').type('form').send({ email: body.email, password: body.password });
    if (body.email !== PARTICIPANT) expect(login.status).toBe(401);
  });

  it('ignora role=organizer no cadastro', async () => {
    const agent = request.agent(env.catraca.app);
    await agent.post('/cadastro').type('form').send({ name: 'Eve', email: 'eve@example.com', password: 'segredo1', role: 'organizer' });
    const res = await agent.get('/organizador');
    expect(res.status).toBe(403);
    const { rows } = await env.pool.query("SELECT role FROM users WHERE email = 'eve@example.com'");
    expect(rows[0].role).toBe('participant');
  });
});

describe('F01 login/logout (AC-F01-03, AC-F01-04)', () => {
  it.each([ORG_A, ORG_B])('organizador %s entra e vai para a área do organizador', async (email) => {
    const res = await request(env.catraca.app).post('/entrar').type('form').send({ email, password: 'catraca123' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/organizador');
  });

  it('participante da seed entra', async () => {
    const agent = await loginAs(env, PARTICIPANT);
    const home = await agent.get('/');
    expect(home.text).toContain('Meus ingressos');
  });

  it('rejeita credenciais erradas', async () => {
    for (const body of [
      { email: PARTICIPANT, password: 'errada' },
      { email: 'ninguem@example.com', password: 'catraca123' },
    ]) {
      const res = await request(env.catraca.app).post('/entrar').type('form').send(body);
      expect(res.status).toBe(401);
      expect(res.text).toContain('E-mail ou senha inválidos');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('sair invalida a sessão no servidor', async () => {
    const agent = await loginAs(env, PARTICIPANT);
    const { rows: before } = await env.pool.query('SELECT count(*)::int AS n FROM sessions');
    const out = await agent.post('/sair');
    expect(out.status).toBe(302);
    const { rows: after } = await env.pool.query('SELECT count(*)::int AS n FROM sessions');
    expect(after[0].n).toBe(before[0].n - 1);
  });

  it('cookie antigo não vale depois de sair', async () => {
    const login = await request(env.catraca.app).post('/entrar').type('form').send({ email: PARTICIPANT, password: 'catraca123' });
    const cookie = String(login.headers['set-cookie']).split(';')[0] ?? '';
    await request(env.catraca.app).post('/sair').set('Cookie', cookie);
    const res = await request(env.catraca.app).get('/organizador').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/entrar/);
  });
});

describe('F01 guardas (AC-F01-06)', () => {
  it('visitante vai para o login', async () => {
    const res = await request(env.catraca.app).get('/organizador');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/entrar\?next=/);
  });

  it('participante recebe 403', async () => {
    const agent = await loginAs(env, PARTICIPANT);
    const res = await agent.get('/organizador');
    expect(res.status).toBe(403);
    expect(res.text).toContain('Acesso restrito a organizadores');
  });

  it('organizador acessa', async () => {
    const agent = await loginAs(env, ORG_A);
    const res = await agent.get('/organizador');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Meus eventos');
  });
});

describe('F01 seed (AC-F01-07)', () => {
  it('é idempotente', async () => {
    await runSeed(env.pool);
    await runSeed(env.pool);
    const { rows } = await env.pool.query("SELECT count(*)::int AS n FROM users WHERE email LIKE '%@catraca.dev'");
    expect(rows[0].n).toBe(3);
  });
});
