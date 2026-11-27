export interface ChargeRequest {
  paymentId: string;
  amountCents: number;
  /** Token do cartão. No gateway simulado, os 4 últimos dígitos (o sistema não guarda o número completo). */
  cardToken: string;
}

export interface ChargeResult {
  approved: boolean;
}

export interface PaymentGateway {
  charge(request: ChargeRequest, signal: AbortSignal): Promise<ChargeResult>;
}

export interface GatewayRule {
  approved: boolean;
  minMs: number;
  maxMs: number;
}

const FAST = { minMs: 2000, maxMs: 5000 };
const SLOW = { minMs: 30000, maxMs: 40000 };

/** Tabela do brief, pelo final do cartão. */
export function gatewayRule(last4: string): GatewayRule {
  switch (last4) {
    case '0001':
      return { approved: true, ...FAST };
    case '0002':
      return { approved: false, ...FAST };
    case '0003':
      return { approved: true, ...SLOW };
    case '0004':
      return { approved: false, ...SLOW };
    default:
      return { approved: false, ...FAST };
  }
}

export class AbortedError extends Error {
  constructor() {
    super('cobrança interrompida');
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError());
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortedError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Gateway simulado (modo padrão). `scale` multiplica os tempos: 1 no produto,
 * menor só no ambiente de testes.
 */
export class SimulatedGateway implements PaymentGateway {
  constructor(
    private readonly scale: number,
    private readonly random: () => number = Math.random,
  ) {}

  delayFor(rule: GatewayRule): number {
    return (rule.minMs + this.random() * (rule.maxMs - rule.minMs)) * this.scale;
  }

  async charge(request: ChargeRequest, signal: AbortSignal): Promise<ChargeResult> {
    const rule = gatewayRule(request.cardToken);
    await sleep(this.delayFor(rule), signal);
    return { approved: rule.approved };
  }
}
