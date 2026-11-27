import { withTransaction, type Pool } from '../../db/pool.js';
import type { EventRecord } from '../events/types.js';
import { checkinOutcome, normalizeCode, type CheckinOutcome } from './rules.js';

interface Row {
  event_id: string;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'refunded';
  checked_in_at: Date | null;
}

/**
 * R10: aplica a regra com o ingresso travado (FOR UPDATE); só "Entrada liberada" grava
 * o check-in, então dois check-ins simultâneos do mesmo código liberam no máximo um.
 */
export async function checkIn(pool: Pool, event: EventRecord, rawCode: unknown): Promise<CheckinOutcome> {
  const code = normalizeCode(rawCode);
  return withTransaction(pool, async (client) => {
    const { rows } = await client.query<Row>('SELECT event_id, status, checked_in_at FROM tickets WHERE code = $1 FOR UPDATE', [code]);
    const row = rows[0];
    const ticket = row ? { eventId: row.event_id, status: row.status, checkedInAt: row.checked_in_at } : undefined;
    const outcome = checkinOutcome(ticket, event);
    if (outcome === 'granted') {
      await client.query('UPDATE tickets SET checked_in_at = now() WHERE code = $1', [code]);
    }
    return outcome;
  });
}
