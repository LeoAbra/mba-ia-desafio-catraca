import { describe, expect, it } from 'vitest';
import { gatewayRule, SimulatedGateway } from '../src/features/purchases/gateway.js';
import { computeSeats } from '../src/features/purchases/seats.js';

describe('gateway simulado (tabela do brief)', () => {
  it.each([
    ['0001', true, 2000, 5000],
    ['0002', false, 2000, 5000],
    ['0003', true, 30000, 40000],
    ['0004', false, 30000, 40000],
    ['9999', false, 2000, 5000],
    ['0000', false, 2000, 5000],
  ])('final %s → aprovado=%s em %s–%s ms', (last4, approved, minMs, maxMs) => {
    expect(gatewayRule(last4)).toEqual({ approved, minMs, maxMs });
  });

  it('sorteia o atraso dentro da faixa e aplica a escala', () => {
    const rule = gatewayRule('0003');
    expect(new SimulatedGateway(1, () => 0).delayFor(rule)).toBe(30000);
    expect(new SimulatedGateway(1, () => 0.999999).delayFor(rule)).toBeLessThanOrEqual(40000);
    expect(new SimulatedGateway(0.01, () => 0.5).delayFor(rule)).toBeCloseTo(350);
  });

  it('responde conforme o final do cartão', async () => {
    const gw = new SimulatedGateway(0);
    const signal = new AbortController().signal;
    expect(await gw.charge({ paymentId: 'p', amountCents: 1, cardToken: '0001' }, signal)).toEqual({ approved: true });
    expect(await gw.charge({ paymentId: 'p', amountCents: 1, cardToken: '0004' }, signal)).toEqual({ approved: false });
  });
});

describe('vagas (R05)', () => {
  it('disponíveis = lotação − ocupadas; zero se cancelado', () => {
    expect(computeSeats({ capacity: 5, status: 'published' }, 2)).toEqual({ capacity: 5, occupied: 2, available: 3 });
    expect(computeSeats({ capacity: 5, status: 'cancelled' }, 2).available).toBe(0);
    expect(computeSeats({ capacity: 2, status: 'published' }, 3).available).toBe(0);
  });
});
