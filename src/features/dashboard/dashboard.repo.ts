import type { Queryable } from '../../db/pool.js';
import type { EventRecord } from '../events/types.js';
import { computeSeats } from '../purchases/seats.js';

export interface EventMetrics {
  confirmed: number;
  pending: number;
  checkins: number;
  available: number;
  revenueCents: number;
  refunded: number;
}

/** R12: uma única consulta agregada sobre os ingressos do evento (vitrine e API contam igual). */
export async function eventMetrics(db: Queryable, event: Pick<EventRecord, 'id' | 'capacity' | 'status'>): Promise<EventMetrics> {
  const { rows } = await db.query<{
    confirmed: number;
    pending: number;
    checkins: number;
    refunded: number;
    revenue: string;
  }>(
    `SELECT count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
            count(*) FILTER (WHERE status = 'pending')::int AS pending,
            count(*) FILTER (WHERE status = 'confirmed' AND checked_in_at IS NOT NULL)::int AS checkins,
            count(*) FILTER (WHERE status = 'refunded')::int AS refunded,
            coalesce(sum(price_cents) FILTER (WHERE status = 'confirmed'), 0)::text AS revenue
     FROM tickets WHERE event_id = $1`,
    [event.id],
  );
  const r = rows[0]!;
  return {
    confirmed: r.confirmed,
    pending: r.pending,
    checkins: r.checkins,
    refunded: r.refunded,
    revenueCents: Number(r.revenue),
    available: computeSeats(event, r.pending + r.confirmed).available, // R05
  };
}
