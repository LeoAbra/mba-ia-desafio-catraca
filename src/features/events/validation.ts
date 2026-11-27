import { parseReais } from '../../shared/money.js';
import { parseLocalDateTime } from '../../shared/time.js';
import type { EventInput } from './types.js';

export interface EventFormValues {
  name: string;
  startsAt: string;
  venue: string;
  capacity: string;
  price: string;
}

export type EventFormResult = { ok: true; value: EventInput } | { ok: false; errors: string[] };

const str = (body: unknown, key: string): string => {
  const v = (body as Record<string, unknown> | undefined)?.[key];
  return typeof v === 'string' ? v : '';
};

export function readEventForm(body: unknown): EventFormValues {
  return {
    name: str(body, 'name'),
    startsAt: str(body, 'startsAt'),
    venue: str(body, 'venue'),
    capacity: str(body, 'capacity'),
    price: str(body, 'price'),
  };
}

/** R01: nome, data futura, local, lotação inteira ≥ 1, preço > 0. Vale para criar e editar. */
export function validateEventForm(form: EventFormValues, now: Date): EventFormResult {
  const errors: string[] = [];
  const name = form.name.trim();
  const venue = form.venue.trim();
  if (!name) errors.push('Informe o nome do evento');

  const startsAt = parseLocalDateTime(form.startsAt);
  if (!startsAt) errors.push('Data de início inválida');
  else if (startsAt.getTime() <= now.getTime()) errors.push('A data de início precisa estar no futuro');

  if (!venue) errors.push('Informe o local');

  const capacityText = form.capacity.trim();
  const capacity = /^\d{1,6}$/.test(capacityText) ? Number(capacityText) : NaN;
  if (!Number.isInteger(capacity) || capacity < 1) {
    errors.push('A lotação precisa ser um número inteiro maior ou igual a 1');
  }

  const priceCents = parseReais(form.price);
  if (priceCents === undefined || priceCents <= 0) errors.push('O preço precisa ser maior que zero');

  if (errors.length || !startsAt || priceCents === undefined) return { ok: false, errors };
  return { ok: true, value: { name, startsAt, venue, capacity, priceCents } };
}
