import { Router, type Request, type Response } from 'express';
import { withTransaction, type Pool } from '../../db/pool.js';
import type { Extensions } from '../../shared/extensions.js';
import { requireOrganizer } from '../accounts/guards.js';
import * as repo from './events.repo.js';
import { managePage, myEventsPage, newEventPage, notFoundPage, NOTICES, publicEventPage, showcasePage } from './pages.js';
import type { EventRecord } from './types.js';
import { readEventForm, validateEventForm } from './validation.js';

const EVENT_NOT_FOUND = 'Evento não encontrado';
const EVENT_NOT_AVAILABLE = 'Evento não disponível';

const param = (req: Request, name: string): string => String(req.params[name] ?? '');
const orgId = (req: Request): string => (req.user as { id: string }).id;

export interface EventsRouterDeps {
  pool: Pool;
  extensions: Extensions;
  now?: () => Date;
}

/** Busca o evento do organizador logado ou responde 404 sem dados (R13). */
async function ownedOr404(deps: EventsRouterDeps, req: Request, res: Response): Promise<EventRecord | undefined> {
  const event = await repo.findOwned(deps.pool, orgId(req), param(req, 'id'));
  if (!event) res.status(404).send(notFoundPage(req, EVENT_NOT_FOUND));
  return event;
}

export function eventsRouter(deps: EventsRouterDeps): Router {
  const router = Router();
  const now = deps.now ?? (() => new Date());

  // ---- Público -------------------------------------------------------------
  router.get('/', async (req, res) => {
    res.send(showcasePage(req, await repo.listOnSale(deps.pool)));
  });

  router.get('/eventos/:id', async (req, res) => {
    const event = await repo.findOnSale(deps.pool, param(req, 'id'));
    if (!event) {
      res.status(404).send(notFoundPage(req, EVENT_NOT_AVAILABLE));
      return;
    }
    res.send(await publicEventPage(req, event, deps.extensions));
  });

  // ---- Área do organizador (R13) ------------------------------------------
  router.use('/organizador', requireOrganizer);

  router.get('/organizador', async (req, res) => {
    res.send(myEventsPage(req, await repo.listByOrganizer(deps.pool, orgId(req))));
  });

  router.get('/organizador/eventos/novo', (req, res) => {
    res.send(newEventPage(req));
  });

  router.post('/organizador/eventos', async (req, res) => {
    const form = readEventForm(req.body);
    const result = validateEventForm(form, now());
    if (!result.ok) {
      res.status(422).send(newEventPage(req, form, result.errors));
      return;
    }
    const event = await repo.insertEvent(deps.pool, orgId(req), result.value);
    res.redirect(302, `/organizador/eventos/${event.id}?aviso=criado`);
  });

  router.get('/organizador/eventos/:id', async (req, res) => {
    const event = await ownedOr404(deps, req, res);
    if (!event) return;
    const notice = typeof req.query.aviso === 'string' ? NOTICES[req.query.aviso] : undefined;
    res.send(await managePage(req, event, deps.extensions, { notice }));
  });

  router.post('/organizador/eventos/:id/editar', async (req, res) => {
    const form = readEventForm(req.body);
    // Transação com o evento travado: os guards (ex.: vagas ocupadas, F03) leem um estado estável.
    const outcome = await withTransaction(deps.pool, async (client) => {
      const event = await repo.lockOwned(client, orgId(req), param(req, 'id'));
      if (!event) return { kind: 'not-found' as const };
      if (event.status === 'cancelled') return { kind: 'cancelled' as const, event };
      const result = validateEventForm(form, now());
      if (!result.ok) return { kind: 'invalid' as const, event, errors: result.errors };
      for (const guard of deps.extensions.capacityGuards) {
        const error = await guard(client, event, result.value);
        if (error) return { kind: 'invalid' as const, event, errors: [error] };
      }
      await repo.updateEvent(client, event.id, result.value);
      return { kind: 'saved' as const, event };
    });

    if (outcome.kind === 'not-found') {
      res.status(404).send(notFoundPage(req, EVENT_NOT_FOUND));
      return;
    }
    if (outcome.kind === 'cancelled') {
      res.status(409).send(await managePage(req, outcome.event, deps.extensions, { errors: [], notice: 'Evento cancelado não pode ser editado' }));
      return;
    }
    if (outcome.kind === 'invalid') {
      res.status(422).send(await managePage(req, outcome.event, deps.extensions, { errors: outcome.errors, formValues: form }));
      return;
    }
    res.redirect(302, `/organizador/eventos/${outcome.event.id}?aviso=salvo`);
  });

  router.post('/organizador/eventos/:id/publicar', async (req, res) => {
    const event = await ownedOr404(deps, req, res);
    if (!event) return;
    if (event.status === 'cancelled') {
      res.status(409).send(await managePage(req, event, deps.extensions, { notice: 'Evento cancelado não pode ser republicado' }));
      return;
    }
    await repo.publishEvent(deps.pool, event.id);
    res.redirect(302, `/organizador/eventos/${event.id}?aviso=publicado`);
  });

  return router;
}
