import type { Queryable } from './db/pool.js';
import { seedAccounts } from './features/accounts/seed.js';

/** Seed idempotente executada em todo boot: 2 organizadores e 1 participante. */
export async function runSeed(db: Queryable): Promise<void> {
  await seedAccounts(db);
}
