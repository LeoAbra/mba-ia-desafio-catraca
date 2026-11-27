import request from 'supertest';
import { createApp, type CatracaApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { migrate } from '../src/db/migrate.js';
import { createPool, type Pool } from '../src/db/pool.js';
import { SEED_PASSWORD } from '../src/features/accounts/seed.js';
import { runSeed } from '../src/seed.js';

export const ORG_A = 'organizador.a@catraca.dev';
export const ORG_B = 'organizador.b@catraca.dev';
export const PARTICIPANT = 'participante@catraca.dev';

export interface TestEnv {
  catraca: CatracaApp;
  pool: Pool;
  close(): Promise<void>;
}

/** App real + Postgres real; banco zerado e seed aplicada. */
export async function setupTestEnv(): Promise<TestEnv> {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  await migrate(pool, config.migrationsDir);
  await resetDb(pool);
  await runSeed(pool);
  const catraca = createApp(pool, config);
  await catraca.start();
  return {
    catraca,
    pool,
    close: async () => {
      await catraca.close();
      await pool.end();
    },
  };
}

export async function resetDb(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
  );
  if (rows.length) await pool.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
}

/** Agente HTTP com cookie de sessão do usuário informado. */
export async function loginAs(env: TestEnv, email: string, password = SEED_PASSWORD) {
  const agent = request.agent(env.catraca.app);
  const res = await agent.post('/entrar').type('form').send({ email, password });
  if (res.status !== 302) throw new Error(`login de ${email} falhou: ${res.status}`);
  return agent;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera a condição ficar verdadeira (polling), falhando após timeoutMs. */
export async function waitFor(check: () => Promise<boolean>, timeoutMs = 5000, stepMs = 25): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(stepMs);
  }
  throw new Error(`condição não satisfeita em ${timeoutMs}ms`);
}
