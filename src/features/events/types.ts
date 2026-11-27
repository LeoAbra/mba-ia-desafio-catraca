export type EventStatus = 'draft' | 'published' | 'cancelled';

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  cancelled: 'Cancelado',
};

export interface EventRecord {
  id: string;
  organizerId: string;
  name: string;
  startsAt: Date;
  venue: string;
  capacity: number;
  priceCents: number;
  status: EventStatus;
  createdAt: Date;
}

export interface EventInput {
  name: string;
  startsAt: Date;
  venue: string;
  capacity: number;
  priceCents: number;
}
