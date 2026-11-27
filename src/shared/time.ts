/** Horário de Brasília (sem horário de verão desde 2019): offset fixo -03:00. */
const OFFSET_MINUTES = -180;
const OFFSET_TEXT = '-03:00';
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Converte "AAAA-MM-DDTHH:MM" (horário de Brasília) em Date; undefined se inválido. */
export function parseLocalDateTime(input: string): Date | undefined {
  const m = LOCAL_RE.exec(input.trim());
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s] = m.map(Number) as [number, number, number, number, number, number, number];
  const utcMs = Date.UTC(y, mo - 1, d, h, mi, Number.isNaN(s) ? 0 : s) - OFFSET_MINUTES * 60_000;
  const date = new Date(utcMs);
  // Rejeita datas que "transbordam" (ex.: 2026-02-31).
  const back = toLocalParts(date);
  if (back.year !== y || back.month !== mo || back.day !== d || back.hour !== h || back.minute !== mi) return undefined;
  return date;
}

function toLocalParts(date: Date) {
  const local = new Date(date.getTime() + OFFSET_MINUTES * 60_000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
  };
}

/** ISO 8601 com offset de Brasília, ex.: 2026-12-05T21:00:00-03:00 (contrato da API de parceiros). */
export function formatIso(date: Date): string {
  const p = toLocalParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${OFFSET_TEXT}`;
}

/** Valor para <input type="datetime-local">. */
export function formatInput(date: Date): string {
  const p = toLocalParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Exibição: 05/12/2026 21:00. */
export function formatDisplay(date: Date): string {
  const p = toLocalParts(date);
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}
