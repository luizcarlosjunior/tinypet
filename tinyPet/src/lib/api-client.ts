"use client";
import type { ApiResponse } from "@tinypet/shared";

const PARTNER_KEY = "tinypet.partnerId";

export function getActivePartnerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(PARTNER_KEY);
  } catch {
    return null;
  }
}
export function setActivePartnerId(id: string | null) {
  try {
    if (id) localStorage.setItem(PARTNER_KEY, id);
    else localStorage.removeItem(PARTNER_KEY);
    document.cookie = `tinypet_partner=${id ?? ""}; path=/; max-age=${id ? 60 * 60 * 24 * 365 : 0}`;
  } catch {
    /* ignore */
  }
}

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

/** A suspended account (media-audit sanction) is signed out once and sent to the login page, which explains why. */
let signingOut = false;
function onApiError(code: string) {
  if (code !== "ACCOUNT_SUSPENDED" || signingOut || typeof window === "undefined") return;
  signingOut = true;
  void import("next-auth/react").then(({ signOut }) => signOut({ callbackUrl: "/entrar?erro=suspensa" }));
}

/** Browser fetch wrapper for /api/v1. Uses the NextAuth cookie session; sends X-Partner-Id from local storage. */
export async function api<T>(path: string, init?: RequestInit & { partnerId?: string | null; json?: unknown }): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) headers.set("Content-Type", "application/json");
  const partnerId = init?.partnerId === undefined ? getActivePartnerId() : init.partnerId;
  if (partnerId) headers.set("X-Partner-Id", partnerId);
  const res = await fetch(`/api/v1${path}`, { ...init, headers, body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body, credentials: "include" });
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!body) throw new ApiClientError(res.status, "NETWORK", "Resposta inválida do servidor");
  if (!body.ok) {
    onApiError(body.error.code);
    throw new ApiClientError(res.status, body.error.code, body.error.message, body.error.details);
  }
  return body.data;
}

export async function apiList<T>(path: string, init?: RequestInit & { partnerId?: string | null }): Promise<{ data: T; meta?: { page: number; pageSize: number; total: number } }> {
  const headers = new Headers(init?.headers);
  const partnerId = init?.partnerId === undefined ? getActivePartnerId() : init.partnerId;
  if (partnerId) headers.set("X-Partner-Id", partnerId);
  const res = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "include" });
  const body = (await res.json().catch(() => null)) as (ApiResponse<T> & { meta?: { page: number; pageSize: number; total: number } }) | null;
  if (!body) throw new ApiClientError(res.status, "NETWORK", "Resposta inválida do servidor");
  if (!body.ok) {
    onApiError(body.error.code);
    throw new ApiClientError(res.status, body.error.code, body.error.message, body.error.details);
  }
  return { data: body.data, meta: body.meta };
}
