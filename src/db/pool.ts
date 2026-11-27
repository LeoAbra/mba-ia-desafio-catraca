import pg from 'pg';

export type Pool = pg.Pool;
export type DbClient = pg.PoolClient;
/** Algo que executa SQL: o pool ou um client dentro de transação. */
export type Queryable = Pick<pg.Pool, 'query'>;

export function createPool(databaseUrl: string): Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 20 });
}

export async function withTransaction<T>(pool: Pool, fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
