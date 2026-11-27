import { describe, expect, it } from 'vitest';
import { validateEventForm } from '../src/features/events/validation.js';
import { formatReais, parseReais } from '../src/shared/money.js';
import { formatIso, parseLocalDateTime } from '../src/shared/time.js';

describe('dinheiro', () => {
  it.each([
    ['100', 10000],
    ['100,00', 10000],
    ['150.5', 15050],
    ['R$ 20,00', 2000],
    ['0', 0],
  ])('parseReais(%s) = %s', (input, cents) => expect(parseReais(input)).toBe(cents));
  it.each(['', 'abc', '-5', '1,234', '10,'])('parseReais(%s) inválido', (input) => expect(parseReais(input)).toBeUndefined());
  it('formata', () => {
    expect(formatReais(35000)).toBe('R$ 350,00');
    expect(formatReais(123456)).toBe('R$ 1.234,56');
    expect(formatReais(0)).toBe('R$ 0,00');
  });
});

describe('datas (Brasília -03:00)', () => {
  it('ida e volta em ISO', () => {
    const d = parseLocalDateTime('2026-12-05T21:00');
    expect(d?.toISOString()).toBe('2026-12-06T00:00:00.000Z');
    expect(formatIso(d!)).toBe('2026-12-05T21:00:00-03:00');
  });
  it('rejeita datas inválidas', () => {
    expect(parseLocalDateTime('2026-02-31T10:00')).toBeUndefined();
    expect(parseLocalDateTime('amanhã')).toBeUndefined();
  });
});

describe('validateEventForm (R01)', () => {
  const now = new Date('2026-11-27T12:00:00Z');
  const base = { name: 'Show', startsAt: '2026-12-20T21:00', venue: 'Bar', capacity: '5', price: '50,00' };
  it('aceita formulário válido', () => {
    const r = validateEventForm(base, now);
    expect(r.ok && r.value).toMatchObject({ capacity: 5, priceCents: 5000 });
  });
  it.each([
    [{ capacity: '0' }, 'A lotação precisa ser um número inteiro maior ou igual a 1'],
    [{ capacity: '2.5' }, 'A lotação precisa ser um número inteiro maior ou igual a 1'],
    [{ price: '0' }, 'O preço precisa ser maior que zero'],
    [{ price: 'x' }, 'O preço precisa ser maior que zero'],
    [{ startsAt: '2026-11-26T20:00' }, 'A data de início precisa estar no futuro'],
    [{ startsAt: '' }, 'Data de início inválida'],
    [{ name: '  ' }, 'Informe o nome do evento'],
    [{ venue: '' }, 'Informe o local'],
  ])('rejeita %o', (patch, msg) => {
    const r = validateEventForm({ ...base, ...patch }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain(msg);
  });
});
