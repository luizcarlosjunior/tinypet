/** Pure helpers for view tracking: visitor hash (LGPD: never store raw IP), bot filter, same-origin check, UA parsing. */
import { createHash } from "node:crypto";
import { UAParser } from "ua-parser-js";

export const BOT_UA = /bot|crawler|spider|preview|curl|wget|headless|slurp|facebookexternalhit|embedly|lighthouse|pingdom|monitor/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 10) return true;
  return BOT_UA.test(ua);
}

/** sha256(ip + ua + day + salt) as hex. Stable within a day for the same ip/ua, unlinkable across days. */
export function visitorHash(ip: string, ua: string, dayKey: string, salt: string): string {
  return createHash("sha256").update(`${ip}|${ua}|${dayKey}|${salt}`).digest("hex");
}

export function viewSalt(): string {
  return process.env.BLOG_VIEW_SALT || process.env.NEXTAUTH_SECRET || "tinypet-dev-view-salt";
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Origin (or, without it, Referer) host must equal the app host. Missing both → not same-origin. */
export function isSameOriginRequest(headers: { get(name: string): string | null }, appUrl: string): boolean {
  const app = hostOf(appUrl);
  if (!app) return false;
  const origin = headers.get("origin");
  if (origin && origin !== "null") return hostOf(origin) === app;
  return hostOf(headers.get("referer")) === app;
}

/** Host of the page that sent the reader to the post (document.referrer); null for direct / same-site navigation. */
export function referrerHost(referrer: string | null | undefined, appUrl: string): string | null {
  const h = hostOf(referrer);
  if (!h) return null;
  if (h === hostOf(appUrl)) return null;
  return h.replace(/^www\./, "").slice(0, 255);
}

export function parseUa(ua: string): { device: string; browser: string | null; os: string | null } {
  const r = new UAParser(ua).getResult();
  const t = r.device.type;
  const device = t === "mobile" || t === "tablet" ? t : t === "smarttv" || t === "console" || t === "wearable" || t === "embedded" ? "other" : "desktop";
  return { device, browser: r.browser.name?.slice(0, 40) ?? null, os: r.os.name?.slice(0, 40) ?? null };
}

/**
 * Who may register a view:
 * - browsers: same-origin (Origin, or Referer when Origin is absent) — cookie or anonymous;
 * - the native app: no Origin header + a VALID mobile JWT (`Authorization: Bearer`, verified by the caller).
 * A request that sends a foreign Origin is always rejected, even with a valid token.
 */
export function viewSource(input: { sameOrigin: boolean; hasOrigin: boolean; validBearer: boolean }): "web" | "app" | "reject" {
  if (input.sameOrigin) return "web";
  if (!input.hasOrigin && input.validBearer) return "app";
  return "reject";
}
