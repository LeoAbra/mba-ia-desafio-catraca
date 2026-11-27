import path from 'node:path';

export interface Config {
  port: number;
  databaseUrl: string;
  partnerApiKey: string;
  /** Multiplica os tempos do gateway simulado. 1 = tempos do brief (modo padrão). */
  gatewayDelayScale: number;
  migrationsDir: string;
}

// Único ponto do código que lê process.env.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não definido (esperado: postgres://user:pass@host:5432/db)');
  const scale = Number(env.GATEWAY_DELAY_SCALE ?? '1');
  if (!Number.isFinite(scale) || scale < 0) {
    throw new Error(`GATEWAY_DELAY_SCALE inválido: "${env.GATEWAY_DELAY_SCALE}" (esperado número >= 0)`);
  }
  return {
    port: Number(env.PORT ?? '3000'),
    databaseUrl,
    partnerApiKey: env.PARTNER_API_KEY ?? 'catraca-parceiro-2026',
    gatewayDelayScale: scale,
    migrationsDir: env.MIGRATIONS_DIR ?? path.resolve('db/migrations'),
  };
}
