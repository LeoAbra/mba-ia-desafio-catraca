import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { Config } from './config.js';
import type { Pool } from './db/pool.js';
import { accountsRouter } from './features/accounts/accounts.router.js';
import { sessionMiddleware } from './features/accounts/sessions.js';
import { cancelRouter, cancelSection } from './features/cancellation/cancel.router.js';
import { checkinRouter, checkinSection } from './features/checkin/checkin.router.js';
import { dashboardSection } from './features/dashboard/dashboard.section.js';
import { eventsRouter } from './features/events/events.router.js';
import { partnerRouter } from './features/partner-api/partner.router.js';
import { SimulatedGateway } from './features/purchases/gateway.js';
import { PaymentProcessor } from './features/purchases/payments.processor.js';
import { capacityGuard, purchaseSection, purchasesRouter } from './features/purchases/purchases.router.js';
import { createExtensions, type Extensions } from './shared/extensions.js';
import { html } from './shared/html.js';
import { layout } from './shared/layout.js';

export interface AppContext {
  pool: Pool;
  config: Config;
  extensions: Extensions;
  /** F03: cobranças em segundo plano (gateway simulado no modo padrão). */
  payments: PaymentProcessor;
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
  const payments = new PaymentProcessor(pool, new SimulatedGateway(config.gatewayDelayScale));
  const ctx: AppContext = { pool, config, extensions: createExtensions(), payments, onStart: [], onClose: [] };
  ctx.onStart.push(async () => {
    await payments.resumePending();
  });
  ctx.onClose.push(() => payments.close());
  const app = express();
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(sessionMiddleware(pool));
  app.use(accountsRouter(pool));

  // F02 — vitrine, página pública e área do organizador (extensões preenchidas pelas features seguintes).
  app.use(eventsRouter({ pool, extensions: ctx.extensions }));

  // F03 — compra na vitrine, Meus ingressos e guarda de lotação (R03, R05–R09).
  ctx.extensions.eventPageSections.push(purchaseSection(pool));
  ctx.extensions.capacityGuards.push(capacityGuard);
  app.use(purchasesRouter({ pool, payments, extensions: ctx.extensions }));

  // F04 — API de parceiros em /api/partner (JSON; antes do 404 HTML).
  app.use('/api/partner', partnerRouter({ pool, payments, apiKey: config.partnerApiKey }));

  // F05 — check-in na página de gerenciamento (R10).
  ctx.extensions.managePageSections.push(checkinSection);
  app.use(checkinRouter({ pool, extensions: ctx.extensions }));

  // F06 — painel do evento na página de gerenciamento (R12).
  ctx.extensions.managePageSections.push(dashboardSection(pool));

  // F07 — cancelamento irreversível com migração atômica dos ingressos (R11).
  ctx.extensions.managePageSections.push(cancelSection);
  app.use(cancelRouter({ pool, extensions: ctx.extensions }));

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
