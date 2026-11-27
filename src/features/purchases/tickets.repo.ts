import type { Queryable } from '../../db/pool.js';
import { newId, newTicketCode } from '../../shared/ids.js';
import type { SalesChannel, TicketRecord, TicketStatus } from './types.js';

interface TicketRow {
  id: string;
  event_id: string;
  code: string;
  status: TicketStatus;
  price_cents: number;
  channel: SalesChannel;
  user_id: string | null;
  buyer_email: string;
  created_at: Date;
  checked_in_at: Date | null;
}

export const toTicket = (r: TicketRow): TicketRecord => ({
  id: r.id,
  eventId: r.event_id,
  code: r.code,
  status: r.status,
  priceCents: r.price_cents,
  channel: r.channel,
  userId: r.user_id,
  buyerEmail: r.buyer_email,
  createdAt: r.created_at,
  checkedInAt: r.checked_in_at,
});

export interface NewTicket {
  eventId: string;
  priceCents: number;
  channel: SalesChannel;
  userId: string | null;
  buyerEmail: string;
}

/** Insere com código único; em colisão (improvável: 32^8), sorteia outro sem abortar a transação. */
export async function insertTicket(db: Queryable, input: NewTicket): Promise<TicketRecord> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { rows } = await db.query<TicketRow>(
      `INSERT INTO tickets (id, event_id, code, price_cents, channel, user_id, buyer_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (code) DO NOTHING RETURNING *`,
      [newId('tkt'), input.eventId, newTicketCode(), input.priceCents, input.channel, input.userId, input.buyerEmail],
    );
    if (rows[0]) return toTicket(rows[0]);
  }
  throw new Error('não foi possível gerar um código de ingresso único após 5 tentativas');
}

export async function findTicketById(db: Queryable, id: string): Promise<TicketRecord | undefined> {
  const { rows } = await db.query<TicketRow>('SELECT * FROM tickets WHERE id = $1', [id]);
  return rows[0] ? toTicket(rows[0]) : undefined;
}

export async function findTicketByCode(db: Queryable, code: string): Promise<TicketRecord | undefined> {
  const { rows } = await db.query<TicketRow>('SELECT * FROM tickets WHERE code = $1', [code]);
  return rows[0] ? toTicket(rows[0]) : undefined;
}

export interface UserTicketView extends TicketRecord {
  eventName: string;
  eventStartsAt: Date;
}

export async function listTicketsOfUser(db: Queryable, userId: string): Promise<UserTicketView[]> {
  const { rows } = await db.query<TicketRow & { event_name: string; event_starts_at: Date }>(
    `SELECT t.*, e.name AS event_name, e.starts_at AS event_starts_at
     FROM tickets t JOIN events e ON e.id = t.event_id
     WHERE t.user_id = $1 ORDER BY t.created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({ ...toTicket(r), eventName: r.event_name, eventStartsAt: r.event_starts_at }));
}

export async function insertPayment(db: Queryable, ticketId: string, cardLast4: string): Promise<string> {
  const id = newId('pay');
  await db.query('INSERT INTO payments (id, ticket_id, card_last4) VALUES ($1, $2, $3)', [id, ticketId, cardLast4]);
  return id;
}
