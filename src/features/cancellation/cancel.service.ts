import { withTransaction, type Pool } from '../../db/pool.js';
import { lockOwned } from '../events/events.repo.js';
import type { EventRecord } from '../events/types.js';

export type CancelResult =
  | { kind: 'cancelled'; event: EventRecord; refunded: number; cancelled: number }
  | { kind: 'not-found' }
  | { kind: 'not-published'; event: EventRecord }
  | { kind: 'already-cancelled'; event: EventRecord };

/**
 * R11: cancela um evento publicado do organizador, de forma irreversível, e migra os
 * ingressos na mesma transação: confirmados → estornados, pendentes → cancelados.
 *
 * - A linha do evento fica travada (FOR UPDATE), a mesma que a compra trava: nenhuma
 *   compra entra depois do cancelamento.
 * - Um único UPDATE com CASE: se o gateway confirmar um ingresso enquanto o cancelamento
 *   espera o lock da linha, o Postgres reavalia a versão nova e a transforma em refunded.
 * - Respostas tardias do gateway não mudam nada porque o PaymentProcessor (F03) só
 *   atualiza ingresso ainda 'pending'.
 */
export async function cancelEvent(pool: Pool, organizerId: string, eventId: string): Promise<CancelResult> {
  return withTransaction(pool, async (client) => {
    const event = await lockOwned(client, organizerId, eventId);
    if (!event) return { kind: 'not-found' };
    if (event.status === 'cancelled') return { kind: 'already-cancelled', event };
    if (event.status !== 'published') return { kind: 'not-published', event };

    await client.query("UPDATE events SET status = 'cancelled', cancelled_at = now() WHERE id = $1", [event.id]);
    const { rows } = await client.query<{ status: string; n: number }>(
      `WITH moved AS (
         UPDATE tickets
            SET status = CASE WHEN status = 'confirmed' THEN 'refunded' ELSE 'cancelled' END,
                updated_at = now()
          WHERE event_id = $1 AND status IN ('pending', 'confirmed')
          RETURNING status)
       SELECT status, count(*)::int AS n FROM moved GROUP BY status`,
      [event.id],
    );
    const count = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
    return { kind: 'cancelled', event: { ...event, status: 'cancelled' }, refunded: count('refunded'), cancelled: count('cancelled') };
  });
}
