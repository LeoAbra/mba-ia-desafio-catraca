import { withTransaction, type Pool } from '../../db/pool.js';
import { lockById } from '../events/events.repo.js';
import type { PaymentProcessor } from './payments.processor.js';
import { seatsFor } from './seats.js';
import { insertPayment, insertTicket } from './tickets.repo.js';
import type { SalesChannel, TicketRecord } from './types.js';

export class InvalidCard extends Error {
  constructor() {
    super('O número do cartão precisa ter 16 dígitos');
  }
}
export class EventNotAvailable extends Error {
  constructor() {
    super('Evento não disponível');
  }
}
export class SoldOut extends Error {
  constructor() {
    super('Ingressos esgotados');
  }
}

export const CARD_RE = /^\d{16}$/;

export interface PurchaseInput {
  eventId: string;
  cardNumber: string;
  channel: SalesChannel;
  userId: string | null;
  buyerEmail: string;
}

export interface PurchaseDeps {
  pool: Pool;
  payments: PaymentProcessor;
}

/**
 * R06/R07: cria um ingresso pendente que já ocupa vaga, sem esperar o gateway.
 * A linha do evento fica travada (FOR UPDATE) da contagem de vagas até o COMMIT,
 * então compras simultâneas do mesmo evento são serializadas e nunca excedem a lotação.
 */
export async function purchaseTicket(deps: PurchaseDeps, input: PurchaseInput): Promise<TicketRecord> {
  if (!CARD_RE.test(input.cardNumber)) throw new InvalidCard();
  const cardLast4 = input.cardNumber.slice(-4);

  const { ticket, paymentId } = await withTransaction(deps.pool, async (client) => {
    const event = await lockById(client, input.eventId);
    if (!event || event.status !== 'published') throw new EventNotAvailable();
    const seats = await seatsFor(client, event);
    if (seats.available <= 0) throw new SoldOut();
    const created = await insertTicket(client, {
      eventId: event.id,
      priceCents: event.priceCents, // R03: preço vigente no momento da compra
      channel: input.channel,
      userId: input.userId,
      buyerEmail: input.buyerEmail,
    });
    return { ticket: created, paymentId: await insertPayment(client, created.id, cardLast4) };
  });

  // Só depois do COMMIT: a cobrança roda em segundo plano e a resposta não espera por ela.
  deps.payments.dispatch({ paymentId, ticketId: ticket.id, amountCents: ticket.priceCents, cardToken: cardLast4 });
  return ticket;
}
