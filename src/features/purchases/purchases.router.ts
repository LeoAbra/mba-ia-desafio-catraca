import { Router, type Request } from 'express';
import type { Pool } from '../../db/pool.js';
import type { CapacityGuard, EventPageSection, Extensions } from '../../shared/extensions.js';
import { html } from '../../shared/html.js';
import { layout, message } from '../../shared/layout.js';
import { formatDisplay } from '../../shared/time.js';
import { requireParticipant } from '../accounts/guards.js';
import { findOnSale } from '../events/events.repo.js';
import { publicEventPage } from '../events/pages.js';
import type { PaymentProcessor } from './payments.processor.js';
import { EventNotAvailable, InvalidCard, purchaseTicket, SoldOut } from './purchase.service.js';
import { occupiedByEvent, seatsFor } from './seats.js';
import { listTicketsOfUser } from './tickets.repo.js';
import { TICKET_STATUS_LABEL } from './types.js';

export const SOLD_OUT_TEXT = 'Ingressos esgotados';

export interface PurchasesDeps {
  pool: Pool;
  payments: PaymentProcessor;
  extensions: Extensions;
}

/** Seção da página pública do evento: vagas e formulário de compra (ou "Ingressos esgotados"). */
export function purchaseSection(pool: Pool): EventPageSection {
  return {
    id: 'purchase',
    order: 10,
    async render({ req, event, state }) {
      const seats = await seatsFor(pool, event);
      const error = typeof state.purchaseError === 'string' ? state.purchaseError : undefined;
      const seatsLine = html`<p><strong>Vagas disponíveis:</strong> ${seats.available}</p>`;
      if (seats.available <= 0) {
        return html`<section id="compra">${seatsLine}<p class="msg erro" role="status">${SOLD_OUT_TEXT}</p></section>`;
      }
      if (!req.user) {
        return html`<section id="compra">${seatsLine}<p><a href="/entrar?next=/eventos/${event.id}">Entre para comprar</a></p></section>`;
      }
      if (req.user.role !== 'participant') {
        return html`<section id="compra">${seatsLine}<p>Organizadores não compram ingressos.</p></section>`;
      }
      return html`<section id="compra">${seatsLine}${message(error, 'erro')}
<form method="post" action="/eventos/${event.id}/comprar" class="stack">
  <label>Número do cartão (16 dígitos) <input name="cardNumber" inputmode="numeric" maxlength="16" required></label>
  <button type="submit">Comprar ingresso</button>
</form></section>`;
    },
  };
}

/** R03: a lotação não pode ficar menor que as vagas ocupadas. Roda com o evento travado. */
export const capacityGuard: CapacityGuard = async (client, event, next) => {
  const occupied = (await occupiedByEvent(client, [event.id])).get(event.id) ?? 0;
  if (next.capacity < occupied) return `A lotação não pode ficar menor que as vagas ocupadas (${occupied})`;
  return undefined;
};

const NOTICES: Record<string, string> = { compra: 'Compra registrada. O status muda quando o pagamento for processado — recarregue a página.' };

function myTicketsPage(req: Request, tickets: Awaited<ReturnType<typeof listTicketsOfUser>>, notice?: string): string {
  const body = tickets.length
    ? html`<table>
<thead><tr><th>Evento</th><th>Quando</th><th>Status</th><th>Código</th></tr></thead>
<tbody>${tickets.map(
        (t) =>
          html`<tr><td>${t.eventName}</td><td>${formatDisplay(t.eventStartsAt)}</td><td data-status="${t.status}">${TICKET_STATUS_LABEL[t.status]}</td><td><code>${t.code}</code></td></tr>`,
      )}</tbody></table>`
    : html`<p>Você ainda não tem ingressos.</p>`;
  return layout('Meus ingressos', req.user, html`${message(notice, 'ok')}${body}`);
}

export function purchasesRouter(deps: PurchasesDeps): Router {
  const router = Router();

  router.post('/eventos/:id/comprar', requireParticipant, async (req, res) => {
    const eventId = String(req.params.id);
    const cardNumber = typeof req.body?.cardNumber === 'string' ? req.body.cardNumber.trim() : '';
    const user = req.user!;
    try {
      await purchaseTicket(deps, { eventId, cardNumber, channel: 'storefront', userId: user.id, buyerEmail: user.email });
      res.redirect(302, '/meus-ingressos?aviso=compra');
    } catch (err) {
      const status = err instanceof InvalidCard ? 422 : err instanceof SoldOut ? 409 : err instanceof EventNotAvailable ? 404 : 0;
      if (!status) throw err;
      const event = status === 404 ? undefined : await findOnSale(deps.pool, eventId);
      if (!event) {
        res.status(404).send(layout('Evento não disponível', req.user, html`<p>Evento não disponível.</p>`));
        return;
      }
      res.status(status).send(await publicEventPage(req, event, deps.extensions, { purchaseError: (err as Error).message }));
    }
  });

  router.get('/meus-ingressos', requireParticipant, async (req, res) => {
    const notice = typeof req.query.aviso === 'string' ? NOTICES[req.query.aviso] : undefined;
    res.send(myTicketsPage(req, await listTicketsOfUser(deps.pool, req.user!.id), notice));
  });

  return router;
}
