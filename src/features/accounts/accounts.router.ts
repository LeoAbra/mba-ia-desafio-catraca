import { Router, type Request, type Response } from 'express';
import type { Pool } from '../../db/pool.js';
import { html } from '../../shared/html.js';
import { layout, message } from '../../shared/layout.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { createSession, destroySession } from './sessions.js';
import { findUserByEmail, insertUser } from './users.repo.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 6;

const field = (body: unknown, key: string): string => {
  const value = (body as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value : '';
};

/** Só aceita redirecionamento para caminho interno (evita open redirect). */
function safeNext(next: string): string | undefined {
  return next.startsWith('/') && !next.startsWith('//') ? next : undefined;
}

function signupPage(req: Request, error?: string, values: { name?: string; email?: string } = {}): string {
  return layout(
    'Criar conta',
    req.user,
    html`${message(error, 'erro')}
<form method="post" action="/cadastro" class="stack">
  <label>Nome <input name="name" value="${values.name ?? ''}" required></label>
  <label>E-mail <input name="email" type="email" value="${values.email ?? ''}" required></label>
  <label>Senha <input name="password" type="password" minlength="${MIN_PASSWORD}" required></label>
  <button type="submit">Criar conta</button>
</form>`,
  );
}

function loginPage(req: Request, error?: string, next = ''): string {
  return layout(
    'Entrar',
    req.user,
    html`${message(error, 'erro')}
<form method="post" action="/entrar" class="stack">
  <input type="hidden" name="next" value="${next}">
  <label>E-mail <input name="email" type="email" required></label>
  <label>Senha <input name="password" type="password" required></label>
  <button type="submit">Entrar</button>
</form>
<p>Não tem conta? <a href="/cadastro">Criar conta de participante</a></p>`,
  );
}

export function validateSignup(input: { name: string; email: string; password: string }): string | undefined {
  if (!input.name.trim()) return 'Informe o nome';
  if (!EMAIL_RE.test(input.email.trim())) return 'E-mail inválido';
  if (input.password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres`;
  return undefined;
}

export function accountsRouter(pool: Pool): Router {
  const router = Router();

  router.get('/cadastro', (req, res) => {
    res.send(signupPage(req));
  });

  router.post('/cadastro', async (req: Request, res: Response) => {
    const input = { name: field(req.body, 'name'), email: field(req.body, 'email'), password: field(req.body, 'password') };
    const error = validateSignup(input);
    if (error) {
      res.status(422).send(signupPage(req, error, input));
      return;
    }
    // Papel fixo: o produto nunca cria organizador (AC-F01-05).
    const user = await insertUser(pool, {
      name: input.name.trim(),
      email: input.email.trim(),
      passwordHash: await hashPassword(input.password),
      role: 'participant',
    });
    if (!user) {
      res.status(422).send(signupPage(req, 'E-mail já cadastrado', input));
      return;
    }
    await createSession(pool, res, user.id);
    res.redirect(302, '/');
  });

  router.get('/entrar', (req, res) => {
    res.send(loginPage(req, undefined, typeof req.query.next === 'string' ? req.query.next : ''));
  });

  router.post('/entrar', async (req: Request, res: Response) => {
    const email = field(req.body, 'email').trim();
    const password = field(req.body, 'password');
    const next = field(req.body, 'next');
    const user = await findUserByEmail(pool, email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).send(loginPage(req, 'E-mail ou senha inválidos', next));
      return;
    }
    await createSession(pool, res, user.id);
    const home = user.role === 'organizer' ? '/organizador' : '/';
    res.redirect(302, safeNext(next) ?? home);
  });

  router.post('/sair', async (req: Request, res: Response) => {
    await destroySession(pool, req, res);
    res.redirect(302, '/');
  });

  return router;
}
