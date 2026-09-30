import type { ApiResponse } from "@tinypet/shared";

/** `cache: "no-store"` and `next.revalidate` are mutually exclusive in Next (it warns when both are set). */
function cacheOpts(init?: RequestInit & { revalidate?: number }): { next?: { revalidate: number } } {
  return init?.cache === "no-store" ? {} : { next: { revalidate: init?.revalidate ?? 60 } };
}

/**
 * Base for server-side calls to our own API. In production it stays inside the container (INTERNAL_API_URL or
 * 127.0.0.1:$PORT) instead of going out through Cloudflare and back: less latency, and a WAF/bot challenge on the
 * public hostname can't turn a page into a 404.
 */
function apiBase() {
  if (process.env.INTERNAL_API_URL) return process.env.INTERNAL_API_URL.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return `http://127.0.0.1:${process.env.PORT || 3033}`;
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3033";
}

/** Server-side fetch of the public API using an absolute URL (for SSR pages). Returns null on 404/network errors. */
export async function serverApi<T>(path: string, init?: RequestInit & { revalidate?: number }): Promise<T | null> {
  const base = apiBase();
  try {
    const res = await fetch(`${base}/api/v1${path}`, { ...init, ...cacheOpts(init), headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
    const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
    if (!body || !body.ok) return null;
    return body.data;
  } catch {
    return null;
  }
}

export async function serverApiList<T>(path: string, init?: RequestInit & { revalidate?: number }): Promise<{ data: T; meta?: { page: number; pageSize: number; total: number } } | null> {
  const base = apiBase();
  try {
    const res = await fetch(`${base}/api/v1${path}`, { ...init, ...cacheOpts(init), headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
    const body = (await res.json().catch(() => null)) as (ApiResponse<T> & { meta?: { page: number; pageSize: number; total: number } }) | null;
    if (!body || !body.ok) return null;
    return { data: body.data, meta: body.meta };
  } catch {
    return null;
  }
}

export function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3033";
  return `${base}${path}`;
}
