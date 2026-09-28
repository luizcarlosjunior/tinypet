/**
 * Sanitizes a post-login `next`/`redirect` target to a same-origin path (pathname + search + hash).
 * Rejects backslashes, control chars and whitespace (browsers normalise "/\evil.com" to "//evil.com"),
 * protocol-relative URLs and absolute URLs. Works on server and client.
 */
export function safeNext(next: string | null | undefined, fallback = "/inicio"): string {
  if (!next || typeof next !== "string" || next.length > 2048) return fallback;
  if (!next.startsWith("/") || next.includes("\\") || /[\u0000-\u001F\u007F\s]/.test(next)) return fallback;
  try {
    const base = "http://x.invalid";
    const u = new URL(next, base);
    if (u.origin !== base) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
