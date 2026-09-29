import { API_ORIGIN } from "./api";
import { fmtDate } from "./format";
import type { BlogPostSummary } from "./types";

/** Public production host of the web app (universal / app links). */
export const WEB_HOSTS = ["tinypet.com.br", "www.tinypet.com.br"];

function hostOf(url: string | null | undefined): string | null {
  const m = url ? /^https?:\/\/([^/?#:]+)/i.exec(url) : null;
  return m ? m[1]!.toLowerCase() : null;
}

/** Absolute URL for media the API may return as a path (dev storage serves `/uploads/...` from the web app). */
export function absUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/") && !u.startsWith("//")) return `${API_ORIGIN}${u}`;
  return null;
}

/** Public web URL of a post (used by the share button). */
export function blogWebUrl(slug: string): string {
  return `${API_ORIGIN}/blog/${encodeURIComponent(slug)}`;
}

/**
 * Hosts post images may be loaded from: the API host (dev uploads), `EXPO_PUBLIC_MEDIA_HOSTS` (comma-separated,
 * e.g. the S3/CloudFront public base) and the hosts of the post's own cover images (served by our media pipeline).
 */
export function blogImageHosts(post?: Partial<Pick<BlogPostSummary, "coverImageRect" | "coverImageSquare">> & { coverOgImage?: string | null }): string[] {
  const env = (process.env.EXPO_PUBLIC_MEDIA_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean);
  const covers = [post?.coverImageRect, post?.coverImageSquare, post?.coverOgImage].map((u) => hostOf(absUrl(u)));
  return Array.from(new Set([hostOf(API_ORIGIN), ...env, ...covers].filter((h): h is string => !!h)));
}

/** Slug when `href` points to a blog post on our own web app (`https://tinypet.com.br/blog/<slug>`), else null. */
export function internalBlogSlug(href: string): string | null {
  const host = hostOf(href);
  if (!host || !(WEB_HOSTS.includes(host) || host === hostOf(API_ORIGIN))) return null;
  const m = /^https?:\/\/[^/]+\/blog\/([a-z0-9][a-z0-9-]{0,190})\/?(?:[?#].*)?$/i.exec(href.trim());
  return m ? m[1]!.toLowerCase() : null;
}

export function fmtPostDate(v: string | null | undefined): string {
  return v ? fmtDate(v, "d 'de' MMMM 'de' yyyy") : "";
}

export function postMeta(p: Pick<BlogPostSummary, "publishDate" | "readingMinutes">): string {
  return [fmtPostDate(p.publishDate), p.readingMinutes ? `${p.readingMinutes} min de leitura` : null].filter(Boolean).join(" · ");
}
