import { Router, type Request } from 'express';
import type { Pool } from '../../db/pool.js';
import type { Extensions, ManagePageSection } from '../../shared/extensions.js';
import { html } from '../../shared/html.js';
import { requireOrganizer } from '../accounts/guards.js';
import * as eventsRepo from '../events/events.repo.js';
import { managePage, notFoundPage } from '../events/pages.js';
import { checkIn } from './checkin.service.js';
import { CHECKIN_MESSAGES, type CheckinOutcome } from './rules.js';

/** Seção "Check-in" da página de gerenciamento (R10). */
export const checkinSection: ManagePageSection = {
  id: 'checkin',
  order: 30,
  async render({ event, state }) {
    const outcome = (state.checkin as { outcome?: CheckinOutcome } | undefined)?.outcome;
    return html`<section id="checkin"><h2>Check-in</h2>
<form method="post" action="/organizador/eventos/${event.id}/checkin" class="stack">
  <label>Código do ingresso <input name="code" autocomplete="off" required></label>
  <button type="submit">Fazer check-in</button>
</form>
${outcome ? html`<p class="msg" role="status" data-checkin="${outcome}">${CHECKIN_MESSAGES[outcome]}</p>` : html``}
</section>`;
  },
};

export function checkinRouter(deps: { pool: Pool; extensions: Extensions }): Router {
  const router = Router();
  router.post('/organizador/eventos/:id/checkin', requireOrganizer, async (req: Request, res) => {
    const organizerId = (req.user as { id: string }).id;
    const event = await eventsRepo.findOwned(deps.pool, organizerId, String(req.params.id ?? ''));
    if (!event) {
      res.status(404).send(notFoundPage(req, 'Evento não encontrado'));
      return;
    }
    const outcome = await checkIn(deps.pool, event, (req.body as Record<string, unknown> | undefined)?.code);
    res.send(await managePage(req, event, deps.extensions, { state: { checkin: { outcome } } }));
  });
  return router;
}
