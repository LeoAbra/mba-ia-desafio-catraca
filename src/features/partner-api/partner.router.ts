import express, { Router, type NextFunction, type Request, type Response } from 'express';
import type { Pool } from '../../db/pool.js';
import { formatIso } from '../../shared/time.js';
import { listOnSale } from '../events/events.repo.js';
import type { PaymentProcessor } from '../purchases/payments.processor.js';
import { EventNotAvailable, InvalidCard, purchaseTicket, SoldOut } from '../purchases/purchase.service.js';
import { computeSeats, occupiedByEvent } from '../purchases/seats.js';
import { findTicketById } from '../purchases/tickets.repo.js';
import { requireApiKey } from './api-key.js';
import { parsePurchaseBody } from './validation.js';

export interface PartnerDeps {
  pool: Pool;
  payments: PaymentProcessor;
  apiKey: string;
}

/** F04 — API de parceiros (contrato fixo do brief). Montar em /api/partner. */
export function partnerRouter(deps: PartnerDeps): Router {
  const router = Router();
  router.use(requireApiKey(deps.apiKey)); // 1º: chave, antes de ler o corpo
  router.use(express.json());

  // R02/R05: eventos à venda com vagas disponíveis.
  router.get('/events', async (_req, res) => {
    const events = await listOnSale(deps.pool);
    const occupied = await occupiedByEvent(
      deps.pool,
      events.map((e) => e.id),
    );
    res.json(
      events.map((e) => ({
        id: e.id,
        name: e.name,
        startsAt: formatIso(e.startsAt),
        priceCents: e.priceCents,
        availableSeats: computeSeats(e, occupied.get(e.id) ?? 0).available,
      })),
    );
  });

  // R06/R07: mesma compra da vitrine (F03), canal "partner", sem conta de participante.
  router.post('/events/:eventId/purchases', async (req, res) => {
    const body = parsePurchaseBody(req.body);
    if (!body) {
      res.status(422).json({ error: 'invalid_request' });
      return;
    }
    try {
      const ticket = await purchaseTicket(
        { pool: deps.pool, payments: deps.payments },
        { eventId: String(req.params.eventId), cardNumber: body.cardNumber, buyerEmail: body.buyerEmail, channel: 'partner', userId: null },
      );
      res.status(202).json({ ticketId: ticket.id, code: ticket.code, status: ticket.status });
    } catch (err) {
      if (err instanceof InvalidCard) res.status(422).json({ error: 'invalid_request' });
      else if (err instanceof EventNotAvailable) res.status(404).json({ error: 'event_not_available' });
      else if (err instanceof SoldOut) res.status(409).json({ error: 'sold_out' });
      else throw err;
    }
  });

  // R09: ingresso de qualquer canal.
  router.get('/tickets/:ticketId', async (req, res) => {
    const t = await findTicketById(deps.pool, String(req.params.ticketId));
    if (!t) {
      res.status(404).json({ error: 'ticket_not_found' });
      return;
    }
    res.json({ ticketId: t.id, code: t.code, eventId: t.eventId, status: t.status, checkedIn: t.checkedInAt !== null });
  });

  router.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.use((err: Error & { type?: string; status?: number }, req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed' || err.type === 'encoding.unsupported' || err.type === 'entity.too.large') {
      res.status(422).json({ error: 'invalid_request' });
      return;
    }
    console.error(JSON.stringify({ level: 'error', msg: err.message, stack: err.stack, path: req.path }));
    res.status(500).json({ error: 'internal_error' });
  });

  return router;
}
