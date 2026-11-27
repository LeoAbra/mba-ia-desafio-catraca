import type { Queryable } from '../../db/pool.js';
import { newId } from '../../shared/ids.js';
import type { Role, SessionUser } from '../../shared/types.js';

export interface UserRecord extends SessionUser {
  passwordHash: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  password_hash: string;
}

const toRecord = (r: UserRow): UserRecord => ({ id: r.id, name: r.name, email: r.email, role: r.role, passwordHash: r.password_hash });

export async function findUserByEmail(db: Queryable, email: string): Promise<UserRecord | undefined> {
  const { rows } = await db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

/** Insere o usuário; devolve undefined se o e-mail já existir. */
export async function insertUser(
  db: Queryable,
  input: { name: string; email: string; passwordHash: string; role: Role },
): Promise<SessionUser | undefined> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING RETURNING *`,
    [newId('usr'), input.name, input.email.toLowerCase(), input.passwordHash, input.role],
  );
  if (!rows[0]) return undefined;
  const { passwordHash: _ignored, ...user } = toRecord(rows[0]);
  return user;
}
