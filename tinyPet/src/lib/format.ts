import { format, parseISO, isValid, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "@tinypet/shared";

export const TZ = DEFAULT_TIMEZONE;

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? (v.length === 10 ? parseISO(`${v}T12:00:00`) : parseISO(v)) : v;
  return isValid(d) ? d : null;
}

/** dd/MM/yyyy in America/Sao_Paulo. Date-only strings (yyyy-MM-dd) are shown as-is. */
export function fmtDate(v: string | Date | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (pattern === "dd/MM/yyyy" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
  const d = toDate(v);
  return d ? formatInTimeZone(d, TZ, pattern, { locale: ptBR }) : "—";
}
export function fmtDateTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? formatInTimeZone(d, TZ, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";
}
export function fmtTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? formatInTimeZone(d, TZ, "HH:mm", { locale: ptBR }) : "—";
}
export function fmtLong(v: string | Date | null | undefined, pattern = "EEEE, d 'de' MMMM"): string {
  const d = toDate(v);
  return d ? formatInTimeZone(d, TZ, pattern, { locale: ptBR }) : "—";
}
export function fmtRelativeDays(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "—";
  const diff = differenceInCalendarDays(toZonedTime(new Date(), TZ), toZonedTime(d, TZ));
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff === -1) return "amanhã";
  return diff > 0 ? `há ${diff} dias` : `em ${-diff} dias`;
}
/** Days late (positive) for a date-only due date. */
export function daysLate(dueDate: string): number {
  const due = toDate(dueDate);
  if (!due) return 0;
  return Math.max(0, differenceInCalendarDays(toZonedTime(new Date(), TZ), due));
}

/** ISO date (yyyy-MM-dd) of "today" in São Paulo. */
export function todayISO(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}
/** Converts a `datetime-local` value (interpreted in São Paulo) to UTC ISO. */
export function localToISO(local: string): string {
  if (!local) return "";
  return fromZonedTime(local, TZ).toISOString();
}
/** Converts a UTC ISO string to a `datetime-local` value in São Paulo. */
export function isoToLocal(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm") : "";
}
/** yyyy-MM-dd of an ISO instant in São Paulo. */
export function isoToDateKey(iso: string | Date): string {
  const d = toDate(iso);
  return d ? formatInTimeZone(d, TZ, "yyyy-MM-dd") : "";
}
/** Minutes since midnight (São Paulo) of an ISO instant. */
export function isoToMinutes(iso: string | Date): number {
  const d = toDate(iso);
  if (!d) return 0;
  const z = toZonedTime(d, TZ);
  return z.getHours() * 60 + z.getMinutes();
}
/** Start of a São Paulo calendar day as UTC ISO. */
export function dayStartISO(dateKey: string): string {
  return fromZonedTime(`${dateKey}T00:00:00`, TZ).toISOString();
}
export function dayEndISO(dateKey: string): string {
  return fromZonedTime(`${dateKey}T23:59:59`, TZ).toISOString();
}
export function addDaysKey(dateKey: string, days: number): string {
  const d = parseISO(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}
export function fmtDateKey(dateKey: string, pattern = "dd/MM"): string {
  const d = parseISO(`${dateKey}T12:00:00`);
  return isValid(d) ? format(d, pattern, { locale: ptBR }) : dateKey;
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}
export function fmtPhone(v: string | null | undefined): string {
  if (!v) return "";
  const d = v.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}
export function fmtAddress(a: { street?: string | null; number?: string | null; district?: string | null; city?: string | null; state?: string | null } | null | undefined): string {
  if (!a) return "";
  return [`${a.street ?? ""}${a.number ? `, ${a.number}` : ""}`, a.district, a.city && a.state ? `${a.city}/${a.state}` : a.city].filter(Boolean).join(" · ");
}
export function whatsappLink(phone: string, text?: string) {
  const d = phone.replace(/\D/g, "");
  const n = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function fmtKm(km: number | string | null | undefined): string {
  const n = num(km);
  return n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(n < 10 ? 1 : 0).replace(".", ",")} km`;
}
export function initials(name: string | null | undefined): string {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}
export function fmtMinutes(min: number | null | undefined): string {
  const m = Math.round(num(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

/** yyyy-MM-dd (São Paulo) of a date; defaults to today. */
export function toDateKey(v: string | Date = new Date()): string {
  return isoToDateKey(v) || todayISO();
}
/** Single-line address text. */
export function addressLine(a: { street?: string | null; number?: string | null; complement?: string | null; district?: string | null; city?: string | null; state?: string | null; zipCode?: string | null } | null | undefined): string {
  if (!a) return "";
  return [`${a.street ?? ""}${a.number ? `, ${a.number}` : ""}${a.complement ? ` – ${a.complement}` : ""}`, a.district, a.city && a.state ? `${a.city} - ${a.state}` : a.city].filter(Boolean).join(", ");
}

/** Weight in grams → "4,2 kg" (or "850 g" below 1 kg). */
export function fmtWeight(grams: number | string | null | undefined): string {
  const g = num(grams);
  if (!g) return "—";
  return g < 1000 ? `${Math.round(g)} g` : `${(g / 1000).toFixed(g < 10000 ? 2 : 1).replace(".", ",")} kg`;
}

/**
 * Formats a CALENDAR date (`@db.Date` columns: birth date, due dates, measuredAt, appliedAt…). Prisma serializes them as
 * UTC midnight; converting to America/Sao_Paulo would show the previous day, so they are formatted in UTC.
 * Use `fmtDate` for real instants (appointments, createdAt…).
 */
export function fmtDay(v: string | Date | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!v) return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) v = `${v}T00:00:00.000Z`;
  const d = toDate(v);
  return d ? formatInTimeZone(d, "UTC", pattern, { locale: ptBR }) : "—";
}
