import { withTransaction, type Pool } from '../../db/pool.js';
import { AbortedError, type PaymentGateway } from './gateway.js';

export interface PaymentJob {
  paymentId: string;
  ticketId: string;
  amountCents: number;
  cardToken: string;
}

const log = (level: string, msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ level, msg, ...extra }));

/**
 * Executa as cobranças em segundo plano e aplica a resposta do gateway.
 * R08: aprovado → confirmado; recusado → recusado (libera a vaga).
 * R11: a resposta só é aplicada a ingresso ainda pendente; se o evento foi
 * cancelado antes, o ingresso já está cancelled/refunded e nada muda.
 */
export class PaymentProcessor {
  private readonly inflight = new Set<Promise<void>>();
  private readonly abort = new AbortController();

  constructor(
    private readonly pool: Pool,
    private readonly gateway: PaymentGateway,
  ) {}

  dispatch(job: PaymentJob): void {
    if (this.abort.signal.aborted) return;
    const run = this.process(job).finally(() => this.inflight.delete(run));
    this.inflight.add(run);
  }

  private async process(job: PaymentJob): Promise<void> {
    try {
      const result = await this.gateway.charge(
        { paymentId: job.paymentId, amountCents: job.amountCents, cardToken: job.cardToken },
        this.abort.signal,
      );
      await this.applyResult(job.paymentId, result.approved);
    } catch (err) {
      // Interrompida no desligamento: o pagamento segue 'processing' e é retomado no próximo boot.
      if (err instanceof AbortedError) return;
      log('error', 'payment processing failed', { paymentId: job.paymentId, error: (err as Error).message });
    }
  }

  /** Aplica a resposta do gateway. Devolve o novo status do ingresso, ou undefined se nada mudou. */
  async applyResult(paymentId: string, approved: boolean): Promise<'confirmed' | 'declined' | undefined> {
    return withTransaction(this.pool, async (client) => {
      const payment = await client.query<{ ticket_id: string }>(
        `UPDATE payments SET status = $2, responded_at = now()
         WHERE id = $1 AND status = 'processing' RETURNING ticket_id`,
        [paymentId, approved ? 'approved' : 'declined'],
      );
      const ticketId = payment.rows[0]?.ticket_id;
      if (!ticketId) return undefined;
      const next = approved ? 'confirmed' : 'declined';
      const ticket = await client.query(
        "UPDATE tickets SET status = $2, updated_at = now() WHERE id = $1 AND status = 'pending'",
        [ticketId, next],
      );
      if (ticket.rowCount !== 1) {
        log('info', 'late gateway response ignored', { paymentId, ticketId, approved });
        return undefined;
      }
      return next;
    });
  }

  /** No boot: redispara cobranças que ficaram pendentes (processo reiniciado no meio). */
  async resumePending(): Promise<number> {
    const { rows } = await this.pool.query<{ id: string; ticket_id: string; card_last4: string; price_cents: number }>(
      `SELECT p.id, p.ticket_id, p.card_last4, t.price_cents
       FROM payments p JOIN tickets t ON t.id = p.ticket_id WHERE p.status = 'processing'`,
    );
    for (const r of rows) {
      this.dispatch({ paymentId: r.id, ticketId: r.ticket_id, amountCents: r.price_cents, cardToken: r.card_last4 });
    }
    if (rows.length) log('info', 'resumed pending payments', { count: rows.length });
    return rows.length;
  }

  /** Espera todas as cobranças em andamento (usado nos testes). */
  async idle(): Promise<void> {
    while (this.inflight.size) await Promise.allSettled([...this.inflight]);
  }

  async close(): Promise<void> {
    this.abort.abort();
    await this.idle();
  }
}
