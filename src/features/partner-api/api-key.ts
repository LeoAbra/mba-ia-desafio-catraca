import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

function sameKey(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual exige o mesmo tamanho; comparar com a própria chave mantém o tempo constante.
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** AC-F04-01: qualquer rota sob /api/partner exige X-Api-Key, antes de ler o corpo. */
export function requireApiKey(expected: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const given = req.header('x-api-key');
    if (typeof given !== 'string' || !sameKey(given, expected)) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  };
}
