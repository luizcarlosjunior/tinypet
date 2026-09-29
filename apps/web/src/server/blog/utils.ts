/**
 * Pure blog helpers (no DB / server-only imports): slugs, reading time, tags, São Paulo day keys.
 * Safe to import from client components.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const BLOG_TZ = "America/Sao_Paulo";
export const BLOG_SLUG_MAX = 120;
export const SUMMARY_MAX = 300;
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 180;
export const WORDS_PER_MINUTE = 200;

/** URL slug: lowercase ASCII, dashes, no accents, ≤ 120 chars (cut at a dash when possible). */
export function blogSlugify(input: string, max = BLOG_SLUG_MAX): string {
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const dash = cut.lastIndexOf("-");
  return (dash > max / 2 ? cut.slice(0, dash) : cut).replace(/-+$/g, "");
}

/**
 * First free slug for `base`: `base`, `base-2`, `base-3`… (`isTaken` checks posts and redirects of other posts).
 * Throws after 50 attempts.
 */
export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  const root = base || "post";
  for (let i = 1; i <= 50; i++) {
    const suffix = i === 1 ? "" : `-${i}`;
    const candidate = `${root.slice(0, BLOG_SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("Não foi possível gerar um slug único");
}

/** Slug given to a soft-deleted post so its original slug can be reused (stays unique, ≤ 200 chars). */
export function deletedSlug(slug: string, id: string): string {
  const suffix = `--deleted-${id.slice(-10)}`;
  return `${slug.slice(0, 200 - suffix.length)}${suffix}`;
}

/** A slug change on a post that is currently PUBLISHED keeps the old URL alive via BlogSlugRedirect. */
export function shouldCreateRedirect(input: { oldSlug: string; newSlug: string; previousStatus: string }): boolean {
  return input.oldSlug !== input.newSlug && input.previousStatus === "PUBLISHED";
}

/** Plain text of an HTML fragment (tags removed, entities decoded for the common cases, whitespace collapsed). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr|td|th|figcaption)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** ceil(words / 200), at least 1. */
export function readingMinutes(html: string): number {
  return Math.max(1, Math.ceil(countWords(htmlToText(html)) / WORDS_PER_MINUTE));
}

/** Summary fallback: first ~`max` chars of the text, cut on a word boundary with an ellipsis. */
export function excerpt(html: string, max = 200): string {
  const t = htmlToText(html);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

/** Tags: trimmed, spaces collapsed, no commas, deduped case-insensitively, ≤ 20 tags of ≤ 40 chars. */
export function normalizeTags(tags: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    const t = raw.replace(/,/g, " ").replace(/\s+/g, " ").trim().slice(0, 40).trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

export function tagsToString(tags: string[]): string | null {
  return tags.length ? tags.join(",") : null;
}

export function tagsFromString(s: string | null | undefined): string[] {
  return s ? s.split(",").map((t) => t.trim()).filter(Boolean) : [];
}

// ───────────────────────────── São Paulo days ─────────────────────────────

/** "YYYY-MM-DD" of an instant, seen from America/Sao_Paulo. */
export function spDayKey(d: Date): string {
  return formatInTimeZone(d, BLOG_TZ, "yyyy-MM-dd");
}

/** UTC instant of 00:00 in São Paulo of the given day key. */
export function spDayStart(dayKey: string): Date {
  return fromZonedTime(`${dayKey}T00:00:00`, BLOG_TZ);
}

/** `@db.Date` value (UTC midnight) for a day key. */
export function dateOnly(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00Z`);
}

export function dayKeyOf(dateOnlyValue: Date): string {
  return dateOnlyValue.toISOString().slice(0, 10);
}

export function addDays(dayKey: string, n: number): string {
  const d = dateOnly(dayKey);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKeyOf(d);
}
