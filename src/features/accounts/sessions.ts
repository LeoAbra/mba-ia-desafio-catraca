import type { NextFunction, Request, Response } from 'express';
import type { Queryable } from '../../db/pool.js';
import { newSessionToken } from '../../shared/ids.js';
import type { Role, SessionUser } from '../../shared/types.js';

export const SESSION_COOKIE = 'catraca_sid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function createSession(db: Queryable, res: Response, userId: string): Promise<void> {
  const token = newSessionToken();
  await db.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [
    token,
    userId,
    new Date(Date.now() + SESSION_TTL_MS),
  ]);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_MS });
}

export async function destroySession(db: Queryable, req: Request, res: Response): Promise<void> {
  if (req.sessionToken) await db.query('DELETE FROM sessions WHERE token = $1', [req.sessionToken]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Carrega req.user a partir do cookie de sessão (quando válido). */
export function sessionMiddleware(db: Queryable) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = readCookie(req, SESSION_COOKIE);
      if (token) {
        const { rows } = await db.query<SessionUser & { role: Role }>(
          `SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = $1 AND s.expires_at > now()`,
          [token],
        );
        if (rows[0]) {
          req.user = rows[0];
          req.sessionToken = token;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
