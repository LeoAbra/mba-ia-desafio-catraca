import type { TicketRecord } from '../purchases/types.js';

/** R10: mensagens exatas exibidas ao organizador. */
export const CHECKIN_MESSAGES = {
  invalid: 'Ingresso inválido para este evento',
  cancelled: 'Evento cancelado',
  notConfirmed: 'Ingresso não confirmado',
  used: 'Ingresso já utilizado',
  granted: 'Entrada liberada',
} as const;

export type CheckinOutcome = keyof typeof CHECKIN_MESSAGES;

export interface CheckinTicket {
  eventId: string;
  status: TicketRecord['status'];
  checkedInAt: Date | null;
}

export interface CheckinEvent {
  id: string;
  status: string;
}

/** R10: a primeira situação verdadeira da lista, na ordem, define o resultado. */
export function checkinOutcome(ticket: CheckinTicket | undefined, event: CheckinEvent): CheckinOutcome {
  if (!ticket || ticket.eventId !== event.id) return 'invalid';
  if (event.status === 'cancelled') return 'cancelled';
  if (ticket.status !== 'confirmed') return 'notConfirmed';
  if (ticket.checkedInAt) return 'used';
  return 'granted';
}

/** Código digitado na porta: sem espaços nas pontas e em maiúsculas. */
export const normalizeCode = (raw: unknown): string => (typeof raw === 'string' ? raw.trim().toUpperCase() : '');
