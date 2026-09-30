import { PET_SOCIAL_NETWORKS, type LifeStage, type PetSocialNetwork, type PetSocialNetworkKey } from "./constants";

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

/**
 * Returns `url` only if it is an absolute http(s) URL (or `mailto:`/`tel:` when allowed); otherwise `undefined`.
 * Use at every sink that renders a user/partner-provided URL (href, src, window.open, Linking.openURL).
 */
export function safeHref(url?: string | null, opts?: { allowMailto?: boolean; allowTel?: boolean }): string | undefined {
  if (typeof url !== "string") return undefined;
  const v = url.trim();
  if (!v || v.length > 2048) return undefined;
  // Reject control chars / whitespace inside the URL (browsers strip some of them, enabling "java\tscript:")
  if (/[\u0000-\u001F\u007F\s]/.test(v)) return undefined;
  let p: string;
  try {
    p = new URL(v).protocol;
  } catch {
    return undefined;
  }
  if (p === "https:" || p === "http:") return v;
  if (p === "mailto:" && opts?.allowMailto) return v;
  if (p === "tel:" && opts?.allowTel) return v;
  return undefined;
}

/** Accepted upload MIME types → storage key extension. The only source of file extensions for stored objects. */
export const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4", // the only accepted video: client-transcoded MP4 (VIDEO_OUTPUT); MOV/WebM/etc. are source-only
  "application/pdf": "pdf",
} as const;
export type AllowedMime = keyof typeof MIME_EXTENSIONS;

export function extensionForMime(mime: string): string | null {
  return Object.prototype.hasOwnProperty.call(MIME_EXTENSIONS, mime) ? MIME_EXTENSIONS[mime as AllowedMime] : null;
}

const HEIC_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs"];
const HEIF_BRANDS = ["mif1", "msf1", "mif2", ...HEIC_BRANDS];
const MP4_BRANDS = ["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "iso8", "iso9", "mp41", "mp42", "mp71", "avc1", "dash", "M4V ", "M4A ", "f4v ", "mmp4", "3gp4", "3gp5", "3gp6", "3g2a", "MSNV", "XAVC"];
const MOV_BRANDS = ["qt  "];

function ascii(b: Uint8Array, start: number, len: number): string {
  let s = "";
  for (let i = start; i < start + len && i < b.length; i++) s += String.fromCharCode(b[i]!);
  return s;
}

/** Brands (major + compatible) of an ISO-BMFF `ftyp` box at offset 0, or null. */
function ftypBrands(b: Uint8Array): string[] | null {
  if (b.length < 12 || ascii(b, 4, 4) !== "ftyp") return null;
  const size = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
  const end = Math.min(b.length, size >= 16 && size <= 4096 ? size : 16);
  const brands = [ascii(b, 8, 4)];
  for (let i = 16; i + 4 <= end; i += 4) brands.push(ascii(b, i, 4));
  return brands;
}

/**
 * Checks whether `bytes` (the first bytes of a file are enough; ≥ 64 recommended) really are of the declared `mime`.
 * JPEG FF D8 FF · PNG 89 50 4E 47 0D 0A 1A 0A · WebP RIFF....WEBP · HEIC/HEIF/MP4/MOV `ftyp` box with brands · PDF `%PDF-`.
 */
export function bytesMatchMime(bytes: Uint8Array, mime: string): boolean {
  const b = bytes;
  switch (mime) {
    case "image/jpeg":
      return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png":
      return b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
    case "image/webp":
      return b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP";
    case "image/gif":
      return b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a");
    case "application/pdf":
      return ascii(b, 0, 5) === "%PDF-";
    case "image/heic": {
      const br = ftypBrands(b);
      return !!br && br.some((x) => HEIC_BRANDS.includes(x));
    }
    case "image/heif": {
      const br = ftypBrands(b);
      return !!br && br.some((x) => HEIF_BRANDS.includes(x));
    }
    case "video/mp4": {
      const br = ftypBrands(b);
      return !!br && !HEIF_BRANDS.includes(br[0]!) && !MOV_BRANDS.includes(br[0]!) && br.some((x) => MP4_BRANDS.includes(x));
    }
    case "video/quicktime": {
      const br = ftypBrands(b);
      // Old QuickTime files may start with a moov/mdat/wide/free box instead of ftyp
      if (!br) return b.length >= 8 && ["moov", "mdat", "wide", "free", "skip", "pnot"].includes(ascii(b, 4, 4));
      return br.some((x) => MOV_BRANDS.includes(x));
    }
    default:
      return false;
  }
}

/** Normalizes a URL typed by a user: trims and prefixes `https://` when no scheme is given ("instagram.com/x" → "https://instagram.com/x"). */
export function withHttps(input: string | null | undefined): string {
  const v = (input ?? "").trim();
  if (!v) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[^:/]+\.[^:/]+:\d/.test(v)) return v; // has a scheme (not "host.tld:port")
  return `https://${v.replace(/^\/+/, "")}`;
}

/** Removes spaces, dots and dashes people type while reading a chip number. Letters are kept (and then rejected). */
export function normalizeMicrochip(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s.\-]/g, "");
}

export type MicrochipProblem = "EMPTY" | "NOT_NUMERIC" | "LENGTH" | "TEST_PREFIX";

/** pt-BR message for each invalid-chip case. */
export const MICROCHIP_PROBLEM_MESSAGE: Record<MicrochipProblem, string> = {
  EMPTY: "Informe o número do microchip",
  NOT_NUMERIC: "O microchip tem só números (sem letras ou caracteres especiais)",
  LENGTH: "O microchip deve ter 15 dígitos",
  TEST_PREFIX: "Números iniciados em 900 são reservados para testes de fábrica e podem se repetir em outros animais",
};

/** Why a chip number is invalid (ISO 11784/11785: 15 digits, numeric only; 900… are factory/test chips), or null. */
export function microchipProblem(value: string | null | undefined): MicrochipProblem | null {
  const v = normalizeMicrochip(value);
  if (!v) return "EMPTY";
  if (!/^\d+$/.test(v)) return "NOT_NUMERIC";
  if (v.length !== 15) return "LENGTH";
  if (v.startsWith("900")) return "TEST_PREFIX";
  return null;
}

/** ISO 11784/11785 microchip: exactly 15 digits, not starting with 900 (test chips). */
export function isValidMicrochip(value: string | null | undefined): boolean {
  return microchipProblem(value) === null;
}

/** Main ICAR manufacturer codes (900–998) with their brands, shown next to the number. */
export const MICROCHIP_MANUFACTURERS: Record<string, { name: string; brands: string }> = {
  "933": { name: "Avid Identification Systems", brands: "Avid FriendChip" },
  "941": { name: "Datamars / Felixcan", brands: "Petlink, Datamars, Felixcan" },
  "953": { name: "Allflex / Merck Animal Health (MSD)", brands: "Allflex, HomeAgain, Destron Fearing" },
  "956": { name: "Trovan Ltd.", brands: "Trovan" },
  "972": { name: "Planet ID GmbH", brands: "Planet-ID" },
  "977": { name: "Virbac", brands: "BackHome" },
  "981": { name: "Datamars (código secundário)", brands: "Datamars Microchips" },
  "982": { name: "Allflex", brands: "Identificação pecuária e pets" },
  "985": { name: "Destron Fearing / Digital Angel", brands: "Lifechip, HomeAgain" },
  "990": { name: "RealTrace", brands: "Petscan, RealTrace" },
  "991": { name: "FDX-B Generic / ICAR Approved", brands: "Diversas marcas sob licença" },
};
/** Country codes (ISO 3166 numeric) shown next to the number. */
export const MICROCHIP_COUNTRIES: Record<string, string> = {
  "032": "Argentina",
  "076": "Brasil",
  "124": "Canadá",
  "250": "França",
  "276": "Alemanha",
  "620": "Portugal",
  "724": "Espanha",
  "840": "Estados Unidos",
  "858": "Uruguai",
};

/** Splits a valid 15-digit number: 3-digit manufacturer/country code + 12-digit unique serial. */
export function microchipParts(value: string | null | undefined): { code: string; serial: string; kind: "COUNTRY" | "MANUFACTURER"; label: string } | null {
  const v = normalizeMicrochip(value);
  if (!/^\d{15}$/.test(v)) return null;
  const code = v.slice(0, 3);
  const n = Number(code);
  const kind = n >= 900 ? "MANUFACTURER" : "COUNTRY";
  const m = MICROCHIP_MANUFACTURERS[code];
  const label = kind === "COUNTRY" ? (MICROCHIP_COUNTRIES[code] ? `País: ${MICROCHIP_COUNTRIES[code]}` : "Código de país") : m ? `Fabricante: ${m.name} (${m.brands})` : "Código de fabricante";
  return { code, serial: v.slice(3), kind, label };
}

// ───────── usernames (@handle) ─────────
/** 3–30 chars, lowercase letters/digits/`.`/`_`, starting and ending with a letter or digit, no `..`. */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$/;
export const RESERVED_USERNAMES = ["admin", "tinypet", "suporte", "support", "root", "api", "www", "blog", "parceiro", "tutor", "null", "undefined"] as const;
export type UsernameProblem = "INVALID" | "RESERVED";

/** Lowercases, trims and strips a leading "@". */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

/** null when `username` (already normalized) is acceptable; otherwise why not. */
export function usernameProblem(username: string): UsernameProblem | null {
  if (!USERNAME_RE.test(username) || username.includes("..")) return "INVALID";
  if ((RESERVED_USERNAMES as readonly string[]).includes(username)) return "RESERVED";
  return null;
}

export const USERNAME_HINT = "3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado (sem começar/terminar com . ou _ e sem ..).";

export function petSocialNetwork(key: PetSocialNetworkKey): PetSocialNetwork {
  return PET_SOCIAL_NETWORKS.find((n) => n.key === key)!;
}

const stripWww = (host: string) => host.toLowerCase().replace(/^www\./, "");

/**
 * Extracts the username from what the user typed for a pet social network: "@rex", "rex" or a profile URL
 * ("https://www.instagram.com/rex/?igsh=…", "tiktok.com/@rex"). Returns the lowercased username without "@",
 * or a pt-BR error message. Only the username is stored; `petSocialProfileUrl()` rebuilds the link.
 */
export function parsePetSocialUsername(key: PetSocialNetworkKey, input: string): { ok: true; username: string } | { ok: false; message: string } {
  const net = petSocialNetwork(key);
  const raw = input.trim();
  if (!raw) return { ok: false, message: `Informe o usuário do ${net.label}` };
  let candidate = raw;
  // A URL has a scheme or a path; "rex.dog" alone is a username (Instagram allows dots).
  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^[^\s/@]+\.[^\s/]+\//.test(raw);
  if (looksLikeUrl) {
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return { ok: false, message: "Link inválido" };
    }
    const host = stripWww(url.hostname);
    if (net.shortHosts?.includes(host)) return { ok: false, message: `Links curtos não são aceitos. Cole o link do perfil do ${net.label} ou o @usuário` };
    if (!net.hosts.includes(host)) {
      const other = PET_SOCIAL_NETWORKS.find((n) => n.hosts.includes(host) || n.shortHosts?.includes(host));
      return { ok: false, message: other ? `Este link é do ${other.label}, não do ${net.label}` : `Este link não é do ${net.label}` };
    }
    const first = decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] ?? "");
    if (!first) return { ok: false, message: `O link não tem o usuário do ${net.label}` };
    if (net.reserved.includes(first.toLowerCase())) return { ok: false, message: `Cole o link do perfil do ${net.label}, não de uma publicação ou página` };
    if (net.atInPath && !first.startsWith("@")) return { ok: false, message: `Cole o link do perfil do ${net.label} (com @ no endereço)` };
    candidate = first;
  }
  const username = candidate.replace(/^@/, "").toLowerCase();
  if (!net.pattern.test(username) || username.startsWith(".") || username.endsWith(".") || username.includes("..")) {
    return { ok: false, message: `Usuário do ${net.label} inválido` };
  }
  return { ok: true, username };
}

/** Public profile URL for a stored pet social username. */
export function petSocialProfileUrl(key: PetSocialNetworkKey, username: string): string {
  return `${petSocialNetwork(key).profileBase}${encodeURIComponent(username)}`;
}

/** Weight typed in kg ("8,5" or "8.5") → grams. "" → null (not informed); invalid or > 1000 kg → undefined. */
export function parseKgToGrams(v: string): number | null | undefined {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n <= 1000 ? Math.round(n * 1000) : undefined;
}

/** Grams → kg input value with a decimal comma ("8,5"); empty when not set. */
export function gramsToKgInput(g: number | null | undefined): string {
  return g ? String(g / 1000).replace(".", ",") : "";
}

export type WeightUnit = "kg" | "g";

/** Typed weight → grams: kg accepts decimals ("2,5" → 2500), g must be a whole number. "" → null; invalid → undefined. */
export function parseWeightToGrams(value: string, unit: WeightUnit): number | null | undefined {
  const t = value.trim().replace(",", ".");
  if (!t) return null;
  if (unit === "g") return /^\d+$/.test(t) && Number(t) > 0 ? Number(t) : undefined;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n <= 1000 ? Math.round(n * 1000) : undefined;
}

/** Grams → input value in the given unit ("2,5" kg / "2500" g); empty when not set. */
export function gramsToInput(g: number | null | undefined, unit: WeightUnit): string {
  if (!g) return "";
  return unit === "g" ? String(g) : String(g / 1000).replace(".", ",");
}

/** Best unit to show a stored weight: kg when it is a whole-ish kilo amount (≥ 1 kg), else g. */
export function preferredWeightUnit(g: number | null | undefined, fallback: WeightUnit): WeightUnit {
  if (!g) return fallback;
  return g >= 1000 ? "kg" : "g";
}
