/**
 * Pontos de extensão entre features. Uma feature fornecedora declara o ponto;
 * as consumidoras se registram em src/app.ts. Mantém as features desacopladas
 * (cada uma no seu diretório) e as integrações explícitas num único lugar.
 */
export interface Extensions {
  /** Preenchido pelas features a partir da F02. */
  [key: string]: unknown;
}

export function createExtensions(): Extensions {
  return {};
}
