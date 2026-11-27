import { CARD_RE } from '../purchases/purchase.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PartnerPurchaseBody {
  buyerEmail: string;
  cardNumber: string;
}

/** AC-F04-04: corpo inválido → undefined (campos extras são ignorados). */
export function parsePurchaseBody(body: unknown): PartnerPurchaseBody | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  const { buyerEmail, cardNumber } = body as Record<string, unknown>;
  if (typeof buyerEmail !== 'string' || !EMAIL_RE.test(buyerEmail)) return undefined;
  if (typeof cardNumber !== 'string' || !CARD_RE.test(cardNumber)) return undefined;
  return { buyerEmail, cardNumber };
}
