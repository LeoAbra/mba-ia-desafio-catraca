import { randomBytes, randomInt } from 'node:crypto';

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomString(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** Id com prefixo legível, ex.: evt_k3m9q2xa7b. */
export function newId(prefix: 'usr' | 'evt' | 'tkt' | 'pay'): string {
  return `${prefix}_${randomString(ID_ALPHABET, 10)}`;
}

/** Código de ingresso: 8 caracteres, maiúsculas e dígitos sem ambíguos (0/O, 1/I). */
export const TICKET_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newTicketCode(): string {
  return randomString(TICKET_CODE_ALPHABET, 8);
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
