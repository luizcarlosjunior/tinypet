import type { ApiResponse } from "@tinypet/shared";

/** Server-side fetch of the public API using an absolute URL (for SSR pages). Returns null on 404/network errors. */
export async function serverApi<T>(path: string, init?: RequestInit & { revalidate?: number }): Promise<T | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${base}/api/v1${path}`, { ...init, next: { revalidate: init?.revalidate ?? 60 }, headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
    const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
    if (!body || !body.ok) return null;
    return body.data;
  } catch {
    return null;
  }
}

export async function serverApiList<T>(path: string, init?: RequestInit & { revalidate?: number }): Promise<{ data: T; meta?: { page: number; pageSize: number; total: number } } | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${base}/api/v1${path}`, { ...init, next: { revalidate: init?.revalidate ?? 60 }, headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
    const body = (await res.json().catch(() => null)) as (ApiResponse<T> & { meta?: { page: number; pageSize: number; total: number } }) | null;
    if (!body || !body.ok) return null;
    return { data: body.data, meta: body.meta };
  } catch {
    return null;
  }
}

export function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  return `${base}${path}`;
}
