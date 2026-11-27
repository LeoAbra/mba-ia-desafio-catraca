import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { runSeed } from './seed.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const applied = await migrate(pool, config.migrationsDir);
  console.log(JSON.stringify({ level: 'info', msg: 'migrations', applied }));
  await runSeed(pool);
  console.log(JSON.stringify({ level: 'info', msg: 'seed ok' }));

  const catraca = createApp(pool, config);
  await catraca.start();
  const server = catraca.app.listen(config.port, () => {
    console.log(JSON.stringify({ level: 'info', msg: 'listening', port: config.port }));
  });

  const shutdown = (signal: string) => {
    console.log(JSON.stringify({ level: 'info', msg: 'shutdown', signal }));
    server.close(async () => {
      await catraca.close();
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(JSON.stringify({ level: 'fatal', msg: (err as Error).message, stack: (err as Error).stack }));
  process.exit(1);
});
