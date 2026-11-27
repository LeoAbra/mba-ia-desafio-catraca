import { html } from '../../shared/html.js';
import type { ManagePageSection } from '../../shared/extensions.js';
import { formatReais } from '../../shared/money.js';
import { eventMetrics } from './dashboard.repo.js';
import type { Queryable } from '../../db/pool.js';

/** F06 — painel do evento na página de gerenciamento (R12). */
export function dashboardSection(db: Queryable): ManagePageSection {
  return {
    id: 'painel',
    order: 20,
    async render({ event }) {
      const m = await eventMetrics(db, event);
      const rows: Array<[string, string, string]> = [
        ['Confirmados', 'confirmed', String(m.confirmed)],
        ['Pendentes', 'pending', String(m.pending)],
        ['Check-ins', 'checkins', String(m.checkins)],
        ['Vagas disponíveis', 'available', String(m.available)],
        ['Receita', 'revenue', formatReais(m.revenueCents)],
        ['Estornados', 'refunded', String(m.refunded)],
      ];
      return html`<section id="painel"><h2>Painel</h2>
<table><tbody>${rows.map(([label, key, value]) => html`<tr><th scope="row">${label}</th><td data-metric="${key}">${value}</td></tr>`)}</tbody></table>
</section>`;
    },
  };
}
