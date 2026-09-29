import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE, formatBRL as sharedFormatBRL } from "@tinypet/shared";

const TZ = DEFAULT_TIMEZONE;

export function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // "YYYY-MM-DD" → treat as a local calendar date (avoid off-by-one from UTC parsing)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  const d = parseISO(v);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(v: string | Date | null | undefined, pattern = "dd/MM/yyyy"): string {
  const d = toDate(v);
  if (!d) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return format(d, pattern, { locale: ptBR });
  return formatInTimeZone(d, TZ, pattern, { locale: ptBR });
}
/**
 * Format a calendar-date field (Prisma `@db.Date`, serialized as "YYYY-MM-DDT00:00:00.000Z" or "YYYY-MM-DD"):
 * birthDate, deceasedAt, dueDate, appliedAt, measuredAt… Uses the calendar day as stored — converting the UTC
 * midnight to America/Sao_Paulo would show the previous day.
 */
export function fmtDay(v: string | Date | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(v instanceof Date ? v.toISOString() : String(v));
  // Anything that is not a pure calendar date (real timestamp, e.g. mixed timelines) keeps the São Paulo conversion.
  if (!m) return fmtDate(v, pattern);
  return format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), pattern, { locale: ptBR });
}
export function fmtDateTime(v: string | Date | null | undefined): string {
  return fmtDate(v, "dd/MM/yyyy 'às' HH:mm");
}
export function fmtTime(v: string | Date | null | undefined): string {
  return fmtDate(v, "HH:mm");
}
export function fmtDayLong(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  if (isYesterday(d)) return "Ontem";
  return formatInTimeZone(d, TZ, "EEEE, d 'de' MMMM", { locale: ptBR });
}
export function fmtRelative(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  return formatDistanceToNowStrict(d, { locale: ptBR, addSuffix: true });
}
/** Local calendar date as YYYY-MM-DD (Sao Paulo). */
export function todayISO(d = new Date()): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}
export function dayKey(v: string | Date): string {
  const d = toDate(v);
  return d ? formatInTimeZone(d, TZ, "yyyy-MM-dd") : "";
}
export const formatBRL = sharedFormatBRL;

export function fmtWeight(g: number | null | undefined): string {
  if (g == null) return "—";
  if (g < 1000) return `${g} g`;
  return `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
}
export function fmtKm(km: number | null | undefined): string {
  if (km == null) return "—";
  return `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}
export function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? ` ${m}min` : ""}` : `${m} min`;
}
export function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** "+5541999990000" → "(41) 99999-0000" (non-BR / unknown formats are returned as-is). */
export function fmtPhone(v: string | null | undefined): string {
  if (!v) return "";
  let d = v.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}
