const REAIS_RE = /^(\d{1,7})(?:[.,](\d{1,2}))?$/;

/** "100", "100,00", "150.5" → centavos. undefined se não for um valor em reais válido. */
export function parseReais(input: string): number | undefined {
  const m = REAIS_RE.exec(input.trim().replace(/^R\$\s*/i, ''));
  if (!m) return undefined;
  const cents = (m[2] ?? '').padEnd(2, '0');
  return Number(m[1]) * 100 + Number(cents);
}

/** 35000 → "R$ 350,00"; 123456 → "R$ 1.234,56". */
export function formatReais(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${reais},${String(abs % 100).padStart(2, '0')}`;
}

/** Valor para o campo de preço do formulário: 15000 → "150,00". */
export function formatReaisInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}
