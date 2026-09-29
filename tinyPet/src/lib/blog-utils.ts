/** Pure blog helpers shared by the admin editor (slug, reading time, São Paulo datetime, safe URLs). */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const BLOG_TZ = "America/Sao_Paulo";
export const SLUG_MAX = 120;
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 180;
export const SUMMARY_MAX = 300;

/** slugify(title): lowercase ASCII, accents removed, "-" separated, ≤ 120 chars, no leading/trailing "-". */
export function blogSlugify(input: string, max = SLUG_MAX): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** Keeps what the user types valid while editing (allows a trailing "-"). */
export function sanitizeSlugInput(input: string, max = SLUG_MAX): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/g, "")
    .slice(0, max);
}

/** ceil(words / 200), min 1 — same rule as the server. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.ceil((words || 0) / 200));
}

export function countWords(text: string): number {
  const t = (text || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

/** UTC ISO → value for <input type="datetime-local"> in São Paulo time. */
export function toSpInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatInTimeZone(d, BLOG_TZ, "yyyy-MM-dd'T'HH:mm");
}

/** <input type="datetime-local"> value (São Paulo wall clock) → UTC ISO. */
export function fromSpInputValue(value: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const d = fromZonedTime(value.length === 16 ? `${value}:00` : value, BLOG_TZ);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function fmtSpDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatInTimeZone(d, BLOG_TZ, "dd/MM/yyyy HH:mm");
}

/** Links in posts: http, https or mailto only. */
export function isSafeLinkUrl(url: string): boolean {
  const u = (url || "").trim();
  if (!u) return false;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(u)) return true;
  try {
    const p = new URL(u);
    return (p.protocol === "http:" || p.protocol === "https:") && !!p.hostname;
  } catch {
    return false;
  }
}

/** Adds https:// when the user typed a bare domain (e.g. "tinypet.com.br/x"). */
export function normalizeLinkUrl(url: string): string {
  const u = (url || "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return `mailto:${u}`;
  return `https://${u.replace(/^\/+/, "")}`;
}

/** Extracts a YouTube video id from watch/embed/shorts/youtu.be URLs. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL((url || "").trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
        id = m?.[2] ?? null;
      }
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Tags: trimmed, lowercased, unique, from either an array or a comma-separated string. */
export function normalizeTags(value: string[] | string | null | undefined): string[] {
  const arr = Array.isArray(value) ? value : (value ?? "").split(",");
  const out: string[] = [];
  for (const raw of arr) {
    const t = String(raw).trim().replace(/\s+/g, " ").toLowerCase().slice(0, 50);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Text shown by Google: truncated with an ellipsis at `max` chars. */
export function truncate(text: string, max: number): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…` : t;
}
