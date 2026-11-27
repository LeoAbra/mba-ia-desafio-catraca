import type { Queryable } from '../../db/pool.js';
import type { EventRecord } from '../events/types.js';

export interface Seats {
  capacity: number;
  occupied: number;
  available: number;
}

/** Vagas ocupadas (pendentes + confirmados) por evento. Eventos sem ingressos ficam com 0. */
export async function occupiedByEvent(db: Queryable, eventIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>(eventIds.map((id) => [id, 0]));
  if (!eventIds.length) return result;
  const { rows } = await db.query<{ event_id: string; n: number }>(
    `SELECT event_id, count(*)::int AS n FROM tickets
     WHERE event_id = ANY($1) AND status IN ('pending', 'confirmed') GROUP BY event_id`,
    [eventIds],
  );
  for (const r of rows) result.set(r.event_id, r.n);
  return result;
}

/** R05: disponíveis = lotação − ocupadas; zero em evento cancelado. */
export function computeSeats(event: Pick<EventRecord, 'capacity' | 'status'>, occupied: number): Seats {
  const available = event.status === 'cancelled' ? 0 : Math.max(0, event.capacity - occupied);
  return { capacity: event.capacity, occupied, available };
}

export async function seatsFor(db: Queryable, event: EventRecord): Promise<Seats> {
  const occupied = (await occupiedByEvent(db, [event.id])).get(event.id) ?? 0;
  return computeSeats(event, occupied);
}
