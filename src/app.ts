import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { Config } from './config.js';
import type { Pool } from './db/pool.js';
import { accountsRouter } from './features/accounts/accounts.router.js';
import { requireOrganizer } from './features/accounts/guards.js';
import { sessionMiddleware } from './features/accounts/sessions.js';
import { createExtensions, type Extensions } from './shared/extensions.js';
import { html } from './shared/html.js';
import { layout } from './shared/layout.js';

export interface AppContext {
  pool: Pool;
  config: Config;
  extensions: Extensions;
  /** Tarefas após o boot (ex.: retomar pagamentos pendentes). */
  onStart: Array<() => Promise<void>>;
  /** Tarefas de encerramento (ex.: processadores em segundo plano). */
  onClose: Array<() => Promise<void>>;
}

export interface CatracaApp {
  app: Express;
  ctx: AppContext;
  start(): Promise<void>;
  close(): Promise<void>;
}

/** Raiz de composição: único lugar que liga as features entre si. */
export function createApp(pool: Pool, config: Config): CatracaApp {
  const ctx: AppContext = { pool, config, extensions: createExtensions(), onStart: [], onClose: [] };
  const app = express();
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(sessionMiddleware(pool));
  app.use(accountsRouter(pool));

  // Vitrine e área do organizador mínimas; F02 substitui.
  app.get('/', (req, res) => {
    res.send(layout('Vitrine', req.user, html`<p>Nenhum evento à venda no momento.</p>`));
  });
  app.get('/organizador', requireOrganizer, (req, res) => {
    res.send(layout('Meus eventos', req.user, html`<p>Você ainda não tem eventos.</p>`));
  });

  app.use((req: Request, res: Response) => {
    res.status(404).send(layout('Página não encontrada', req.user, html`<p>Página não encontrada.</p>`));
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({ level: 'error', msg: err.message, stack: err.stack, path: req.path }));
    res.status(500).send(layout('Erro', req.user, html`<p>Erro inesperado.</p>`));
  });

  return {
    app,
    ctx,
    start: async () => {
      for (const task of ctx.onStart) await task();
    },
    close: async () => {
      for (const task of ctx.onClose) await task();
    },
  };
}
