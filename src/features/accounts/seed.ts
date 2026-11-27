import type { Queryable } from '../../db/pool.js';
import type { Role } from '../../shared/types.js';
import { hashPassword } from './passwords.js';
import { insertUser } from './users.repo.js';

export const SEED_PASSWORD = 'catraca123';

export const SEED_ACCOUNTS: ReadonlyArray<{ name: string; email: string; role: Role }> = [
  { name: 'Organizador A', email: 'organizador.a@catraca.dev', role: 'organizer' },
  { name: 'Organizador B', email: 'organizador.b@catraca.dev', role: 'organizer' },
  { name: 'Participante Seed', email: 'participante@catraca.dev', role: 'participant' },
];

/** Idempotente: contas existentes são mantidas (ON CONFLICT DO NOTHING). */
export async function seedAccounts(db: Queryable): Promise<void> {
  for (const account of SEED_ACCOUNTS) {
    await insertUser(db, { ...account, passwordHash: await hashPassword(SEED_PASSWORD) });
  }
}
