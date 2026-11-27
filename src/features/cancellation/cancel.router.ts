import { Router } from 'express';
import type { Pool } from '../../db/pool.js';
import type { Extensions, ManagePageSection } from '../../shared/extensions.js';
import { html } from '../../shared/html.js';
import { requireOrganizer } from '../accounts/guards.js';
import { managePage, notFoundPage } from '../events/pages.js';
import { cancelEvent } from './cancel.service.js';

export const cancelSection: ManagePageSection = {
  id: 'cancellation',
  order: 50,
  async render({ event }) {
    if (event.status === 'cancelled') {
      return html`<section id="cancelamento"><h2>Cancelamento</h2><p class="msg">Evento cancelado. Ingressos confirmados foram estornados e pendentes, cancelados.</p></section>`;
    }
    if (event.status !== 'published') return html``;
    return html`<section id="cancelamento"><h2>Cancelamento</h2>
<p>Cancelar é irreversível: o evento sai da vitrine e da API, ingressos confirmados são estornados e pendentes, cancelados.</p>
<form method="post" action="/organizador/eventos/${event.id}/cancelar"><button type="submit">Cancelar evento</button></form></section>`;
  },
};

export function cancelRouter(deps: { pool: Pool; extensions: Extensions }): Router {
  const router = Router();
  router.post('/organizador/eventos/:id/cancelar', requireOrganizer, async (req, res) => {
    const result = await cancelEvent(deps.pool, req.user!.id, String(req.params.id));
    switch (result.kind) {
      case 'not-found':
        res.status(404).send(notFoundPage(req, 'Evento não encontrado'));
        return;
      case 'not-published':
        res.status(409).send(await managePage(req, result.event, deps.extensions, { notice: 'Só evento publicado pode ser cancelado' }));
        return;
      case 'already-cancelled':
        res.status(409).send(await managePage(req, result.event, deps.extensions, { notice: 'Evento já cancelado' }));
        return;
      case 'cancelled':
        console.log(JSON.stringify({ level: 'info', msg: 'event cancelled', eventId: result.event.id, refunded: result.refunded, cancelled: result.cancelled }));
        res.redirect(302, `/organizador/eventos/${result.event.id}?aviso=cancelado`);
    }
  });
  return router;
}
