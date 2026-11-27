export type TicketStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'refunded';
export type SalesChannel = 'storefront' | 'partner';

/** Rótulo na interface; o valor (TicketStatus) é o da API. */
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  pending: 'pendente',
  confirmed: 'confirmado',
  declined: 'recusado',
  cancelled: 'cancelado',
  refunded: 'estornado',
};

/** R05: vagas ocupadas = pendentes + confirmados. */
export const OCCUPYING_STATUSES: readonly TicketStatus[] = ['pending', 'confirmed'];

export interface TicketRecord {
  id: string;
  eventId: string;
  code: string;
  status: TicketStatus;
  priceCents: number;
  channel: SalesChannel;
  userId: string | null;
  buyerEmail: string;
  createdAt: Date;
  checkedInAt: Date | null;
}
