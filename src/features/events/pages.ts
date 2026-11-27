import type { Request } from 'express';
import type { Extensions } from '../../shared/extensions.js';
import { html, type SafeHtml } from '../../shared/html.js';
import { layout, message } from '../../shared/layout.js';
import { formatReais, formatReaisInput } from '../../shared/money.js';
import { formatDisplay, formatInput } from '../../shared/time.js';
import { EVENT_STATUS_LABEL, type EventRecord } from './types.js';
import type { EventFormValues } from './validation.js';

/** Avisos pós-ação: chave fixa → texto fixo (nada vindo do usuário vai para a página). */
export const NOTICES: Record<string, string> = {
  criado: 'Evento criado como rascunho',
  salvo: 'Alterações salvas',
  publicado: 'Evento publicado',
  cancelado: 'Evento cancelado',
};

const errorList = (errors: string[]): SafeHtml =>
  errors.length ? html`<div class="msg erro" role="alert"><ul>${errors.map((e) => html`<li>${e}</li>`)}</ul></div>` : html``;

export function formValuesOf(event: EventRecord): EventFormValues {
  return {
    name: event.name,
    startsAt: formatInput(event.startsAt),
    venue: event.venue,
    capacity: String(event.capacity),
    price: formatReaisInput(event.priceCents),
  };
}

function eventFields(v: EventFormValues): SafeHtml {
  return html`
  <label>Nome <input name="name" value="${v.name}" required></label>
  <label>Data e hora de início (horário de Brasília) <input name="startsAt" type="datetime-local" value="${v.startsAt}" required></label>
  <label>Local <input name="venue" value="${v.venue}" required></label>
  <label>Lotação <input name="capacity" type="number" min="1" step="1" value="${v.capacity}" required></label>
  <label>Preço (R$) <input name="price" inputmode="decimal" placeholder="100,00" value="${v.price}" required></label>`;
}

export function showcasePage(req: Request, events: EventRecord[]): string {
  const body = events.length
    ? html`<table>
<thead><tr><th>Evento</th><th>Quando</th><th>Local</th><th>Preço</th></tr></thead>
<tbody>${events.map(
        (e) =>
          html`<tr><td><a href="/eventos/${e.id}">${e.name}</a></td><td>${formatDisplay(e.startsAt)}</td><td>${e.venue}</td><td>${formatReais(e.priceCents)}</td></tr>`,
      )}</tbody></table>`
    : html`<p>Nenhum evento à venda no momento.</p>`;
  return layout('Vitrine', req.user, body);
}

export async function publicEventPage(
  req: Request,
  event: EventRecord,
  extensions: Extensions,
  state: Record<string, unknown> = {},
): Promise<string> {
  const sections = [...extensions.eventPageSections].sort((a, b) => a.order - b.order);
  const rendered = await Promise.all(sections.map((s) => s.render({ req, event, state })));
  return layout(
    event.name,
    req.user,
    html`<p><strong>Quando:</strong> ${formatDisplay(event.startsAt)}<br>
<strong>Local:</strong> ${event.venue}<br>
<strong>Preço:</strong> ${formatReais(event.priceCents)}</p>
${rendered}`,
  );
}

export function myEventsPage(req: Request, events: EventRecord[]): string {
  const body = html`<p><a href="/organizador/eventos/novo">+ Criar evento</a></p>
${
  events.length
    ? html`<table>
<thead><tr><th>Evento</th><th>Quando</th><th>Status</th></tr></thead>
<tbody>${events.map(
        (e) =>
          html`<tr><td><a href="/organizador/eventos/${e.id}">${e.name}</a></td><td>${formatDisplay(e.startsAt)}</td><td>${EVENT_STATUS_LABEL[e.status]}</td></tr>`,
      )}</tbody></table>`
    : html`<p>Você ainda não tem eventos.</p>`
}`;
  return layout('Meus eventos', req.user, body);
}

const EMPTY_FORM: EventFormValues = { name: '', startsAt: '', venue: '', capacity: '', price: '' };

export function newEventPage(req: Request, values: EventFormValues = EMPTY_FORM, errors: string[] = []): string {
  return layout(
    'Criar evento',
    req.user,
    html`${errorList(errors)}
<form method="post" action="/organizador/eventos" class="stack">${eventFields(values)}
  <button type="submit">Criar rascunho</button>
</form>`,
  );
}

export interface ManagePageOptions {
  notice?: string;
  errors?: string[];
  formValues?: EventFormValues;
  /** Estado de ações de outras features (check-in etc.). */
  state?: Record<string, unknown>;
}

/** Página de gerenciamento (R04): dados, edição, publicação e as seções das outras features. */
export async function managePage(
  req: Request,
  event: EventRecord,
  extensions: Extensions,
  options: ManagePageOptions = {},
): Promise<string> {
  const cancelled = event.status === 'cancelled';
  const details = html`<section id="detalhes">
<p><strong>Status:</strong> ${EVENT_STATUS_LABEL[event.status]}<br>
<strong>Quando:</strong> ${formatDisplay(event.startsAt)}<br>
<strong>Local:</strong> ${event.venue}<br>
<strong>Lotação:</strong> ${event.capacity}<br>
<strong>Preço:</strong> ${formatReais(event.priceCents)}</p>
${event.status === 'published' ? html`<p>Página pública: <a href="/eventos/${event.id}">/eventos/${event.id}</a></p>` : html``}
</section>`;

  const edit = cancelled
    ? html`<section id="edicao"><p class="msg">Evento cancelado — não pode ser editado nem republicado.</p></section>`
    : html`<section id="edicao"><h2>Editar evento</h2>${errorList(options.errors ?? [])}
<form method="post" action="/organizador/eventos/${event.id}/editar" class="stack">${eventFields(options.formValues ?? formValuesOf(event))}
  <button type="submit">Salvar alterações</button>
</form></section>`;

  const publish =
    event.status === 'draft'
      ? html`<section id="publicacao"><form method="post" action="/organizador/eventos/${event.id}/publicar">
  <button type="submit">Publicar evento</button></form></section>`
      : html``;

  const sections = [...extensions.managePageSections].sort((a, b) => a.order - b.order);
  const extra = await Promise.all(sections.map((s) => s.render({ req, event, state: options.state ?? {} })));

  return layout(
    event.name,
    req.user,
    html`${message(options.notice, 'ok')}${details}${publish}${extra}${edit}
<p><a href="/organizador">← Meus eventos</a></p>`,
  );
}

export function notFoundPage(req: Request, text: string): string {
  return layout(text, req.user, html`<p>${text}.</p>`);
}
