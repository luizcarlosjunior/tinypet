import type { LifeStage } from "./constants";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function onlyDigits(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function isValidCPF(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i]!, 10) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]!, 10) && calc(10) === parseInt(d[10]!, 10);
}

export function isValidCNPJ(cnpj: string): boolean {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i]!, 10) * weights[i]!;
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12]!, 10) && calc(13) === parseInt(d[13]!, 10);
}

/** Normalizes a Brazilian phone to E.164 (+55...). */
export function toE164BR(phone: string): string {
  const d = onlyDigits(phone);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  return phone.startsWith("+") ? phone : `+${d}`;
}

export function ageInMonths(birthDate: Date | string | null | undefined, approxAgeMonths?: number | null, now = new Date()): number | null {
  if (birthDate) {
    const b = new Date(birthDate);
    return (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  }
  if (approxAgeMonths != null) return approxAgeMonths;
  return null;
}

export function formatAge(months: number | null): string {
  if (months == null) return "idade desconhecida";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} ${y === 1 ? "ano" : "anos"} e ${m} ${m === 1 ? "mês" : "meses"}` : `${y} ${y === 1 ? "ano" : "anos"}`;
}

/** Default life-stage rules (months). Admin can override via LifeStageRule. */
export const DEFAULT_LIFE_STAGE_RULES: Record<string, { puppyUntil: number; seniorFrom: number }> = {
  "dog:SMALL": { puppyUntil: 12, seniorFrom: 120 },
  "dog:MEDIUM": { puppyUntil: 12, seniorFrom: 96 },
  "dog:LARGE": { puppyUntil: 18, seniorFrom: 72 },
  "dog:GIANT": { puppyUntil: 18, seniorFrom: 72 },
  dog: { puppyUntil: 12, seniorFrom: 96 },
  cat: { puppyUntil: 12, seniorFrom: 132 },
  default: { puppyUntil: 12, seniorFrom: 96 },
};

export function lifeStageFor(
  months: number | null,
  speciesKey: string,
  size?: string | null,
  rules: Record<string, { puppyUntil: number; seniorFrom: number }> = DEFAULT_LIFE_STAGE_RULES,
): LifeStage | null {
  if (months == null) return null;
  const rule = rules[`${speciesKey}:${size ?? ""}`] ?? rules[speciesKey] ?? rules.default!;
  if (months < rule.puppyUntil) return "PUPPY";
  if (months >= rule.seniorFrom) return "SENIOR";
  return "ADULT";
}

export function formatBRL(value: number | string | null | undefined): string {
  if (value == null) return "Sob consulta";
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function mapsLinks(lat?: number | null, lng?: number | null, addressText?: string) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(addressText ?? "");
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
    waze: lat != null && lng != null ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : `https://waze.com/ul?q=${dest}&navigate=yes`,
    apple: lat != null && lng != null ? `https://maps.apple.com/?daddr=${lat},${lng}` : `https://maps.apple.com/?daddr=${dest}`,
  };
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}
