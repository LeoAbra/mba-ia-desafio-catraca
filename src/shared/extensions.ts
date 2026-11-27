import type { Request } from 'express';
import type { DbClient } from '../db/pool.js';
import type { EventInput, EventRecord } from '../features/events/types.js';
import type { SafeHtml } from './html.js';

/**
 * Pontos de extensão entre features. A feature fornecedora (F02) declara o ponto;
 * as consumidoras se registram em src/app.ts. Mantém cada feature no seu diretório
 * e as integrações explícitas num único lugar.
 */

export interface ManagePageContext {
  req: Request;
  event: EventRecord;
  /** Estado de uma ação recém-executada, por seção (ex.: { checkin: { message } }). */
  state: Record<string, unknown>;
}

export interface ManagePageSection {
  id: string;
  /** Ordem na página (menor primeiro). F02 usa 10–20. */
  order: number;
  render(ctx: ManagePageContext): Promise<SafeHtml>;
}

export interface EventPageContext {
  req: Request;
  event: EventRecord;
  state: Record<string, unknown>;
}

export interface EventPageSection {
  id: string;
  order: number;
  render(ctx: EventPageContext): Promise<SafeHtml>;
}

/**
 * Chamado na edição, dentro da transação que travou o evento (FOR UPDATE).
 * Devolve uma mensagem de erro para rejeitar a alteração.
 */
export type CapacityGuard = (client: DbClient, event: EventRecord, next: EventInput) => Promise<string | undefined>;

export interface Extensions {
  managePageSections: ManagePageSection[];
  eventPageSections: EventPageSection[];
  capacityGuards: CapacityGuard[];
}

export function createExtensions(): Extensions {
  return { managePageSections: [], eventPageSections: [], capacityGuards: [] };
}
