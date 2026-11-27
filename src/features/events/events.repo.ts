import type { Queryable } from '../../db/pool.js';
import { newId } from '../../shared/ids.js';
import type { EventInput, EventRecord, EventStatus } from './types.js';

interface EventRow {
  id: string;
  organizer_id: string;
  name: string;
  starts_at: Date;
  venue: string;
  capacity: number;
  price_cents: number;
  status: EventStatus;
  created_at: Date;
}

const toRecord = (r: EventRow): EventRecord => ({
  id: r.id,
  organizerId: r.organizer_id,
  name: r.name,
  startsAt: r.starts_at,
  venue: r.venue,
  capacity: r.capacity,
  priceCents: r.price_cents,
  status: r.status,
  createdAt: r.created_at,
});

const one = (rows: EventRow[]) => (rows[0] ? toRecord(rows[0]) : undefined);

export async function insertEvent(db: Queryable, organizerId: string, input: EventInput): Promise<EventRecord> {
  const { rows } = await db.query<EventRow>(
    `INSERT INTO events (id, organizer_id, name, starts_at, venue, capacity, price_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [newId('evt'), organizerId, input.name, input.startsAt, input.venue, input.capacity, input.priceCents],
  );
  return toRecord(rows[0] as EventRow);
}

export async function listByOrganizer(db: Queryable, organizerId: string): Promise<EventRecord[]> {
  const { rows } = await db.query<EventRow>('SELECT * FROM events WHERE organizer_id = $1 ORDER BY starts_at, created_at', [
    organizerId,
  ]);
  return rows.map(toRecord);
}

/** R13: só devolve o evento se pertencer ao organizador. */
export async function findOwned(db: Queryable, organizerId: string, eventId: string): Promise<EventRecord | undefined> {
  const { rows } = await db.query<EventRow>('SELECT * FROM events WHERE id = $1 AND organizer_id = $2', [eventId, organizerId]);
  return one(rows);
}

/** Igual a findOwned, travando a linha até o fim da transação. */
export async function lockOwned(db: Queryable, organizerId: string, eventId: string): Promise<EventRecord | undefined> {
  const { rows } = await db.query<EventRow>('SELECT * FROM events WHERE id = $1 AND organizer_id = $2 FOR UPDATE', [
    eventId,
    organizerId,
  ]);
  return one(rows);
}

/** Trava o evento pelo id (usado pela compra para serializar a alocação de vagas). */
export async function lockById(db: Queryable, eventId: string): Promise<EventRecord | undefined> {
  const { rows } = await db.query<EventRow>('SELECT * FROM events WHERE id = $1 FOR UPDATE', [eventId]);
  return one(rows);
}

export async function findById(db: Queryable, eventId: string): Promise<EventRecord | undefined> {
  const { rows } = await db.query<EventRow>('SELECT * FROM events WHERE id = $1', [eventId]);
  return one(rows);
}

export async function updateEvent(db: Queryable, eventId: string, input: EventInput): Promise<void> {
  await db.query(
    `UPDATE events SET name = $2, starts_at = $3, venue = $4, capacity = $5, price_cents = $6
     WHERE id = $1 AND status <> 'cancelled'`,
    [eventId, input.name, input.startsAt, input.venue, input.capacity, input.priceCents],
  );
}

export async function publishEvent(db: Queryable, eventId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    "UPDATE events SET status = 'published', published_at = now() WHERE id = $1 AND status = 'draft'",
    [eventId],
  );
  return rowCount === 1;
}

/** R02: à venda = publicado e não cancelado. */
export async function listOnSale(db: Queryable): Promise<EventRecord[]> {
  const { rows } = await db.query<EventRow>("SELECT * FROM events WHERE status = 'published' ORDER BY starts_at, created_at");
  return rows.map(toRecord);
}

export async function findOnSale(db: Queryable, eventId: string): Promise<EventRecord | undefined> {
  const { rows } = await db.query<EventRow>("SELECT * FROM events WHERE id = $1 AND status = 'published'", [eventId]);
  return one(rows);
}
