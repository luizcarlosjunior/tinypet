import type { ApiResponse } from "@tinypet/shared";

function resolveBaseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!__DEV__) {
    // Release builds must talk to the API over TLS — never fall back to localhost/http (tokens would travel in clear).
    if (!env || !/^https:\/\/[^/\s]+/i.test(env)) throw new Error("EXPO_PUBLIC_API_URL must be set to an https:// URL in production builds");
  }
  return (env || "http://localhost:3033").replace(/\/$/, "");
}
/** Site origin (also used for public web links such as /pet/<slug>). */
export const BASE_URL = resolveBaseUrl();
export const API_BASE = `${BASE_URL}/api/v1`;
/** Origin of the API/web app (e.g. `https://tinypet.com.br`), used for public web links. */
export const API_ORIGIN = BASE_URL;

export type ListMeta = { page: number; pageSize: number; total: number };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get isPlanLimit() {
    return this.status === 402 || this.code === "PLAN_LIMIT";
  }
}

// Module-level context, synced by the auth store so every request carries the right headers.
let _token: string | null = null;
let _partnerId: string | null = null;
let _onUnauthorized: (() => void) | null = null;
let _onSuspended: ((message: string) => void) | null = null;

export function setApiContext(ctx: { token?: string | null; partnerId?: string | null }) {
  if (ctx.token !== undefined) _token = ctx.token;
  if (ctx.partnerId !== undefined) _partnerId = ctx.partnerId;
}
export function getApiContext() {
  return { token: _token, partnerId: _partnerId };
}
export function onUnauthorized(cb: (() => void) | null) {
  _onUnauthorized = cb;
}
/** Called once per request when the account was suspended by an admin (403 ACCOUNT_SUSPENDED). */
export function onSuspended(cb: ((message: string) => void) | null) {
  _onSuspended = cb;
}

export type ApiInit = Omit<RequestInit, "body"> & {
  json?: unknown;
  body?: RequestInit["body"];
  /** Override the X-Partner-Id header. `null` sends no partner header. */
  partnerId?: string | null;
  /** Skip the Authorization header (public endpoints while logged out). */
  anonymous?: boolean;
};

async function request<T>(path: string, init?: ApiInit): Promise<{ data: T; meta?: ListMeta; status: number }> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.json !== undefined) headers.set("Content-Type", "application/json");
  if (!init?.anonymous && _token) headers.set("Authorization", `Bearer ${_token}`);
  const partnerId = init?.partnerId === undefined ? _partnerId : init.partnerId;
  if (partnerId) headers.set("X-Partner-Id", partnerId);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });
  } catch (e) {
    throw new ApiError(0, "NETWORK", "Sem conexão com o servidor. Verifique sua internet.", e);
  }

  const body = (await res.json().catch(() => null)) as (ApiResponse<T> & { meta?: ListMeta }) | null;
  if (!body) {
    if (res.ok) return { data: undefined as T, status: res.status };
    throw new ApiError(res.status, "NETWORK", "Resposta inválida do servidor");
  }
  if (!body.ok) {
    if (res.status === 401 && _token && _onUnauthorized) _onUnauthorized();
    if (body.error.code === "ACCOUNT_SUSPENDED" && _token && _onSuspended) _onSuspended(body.error.message);
    throw new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  }
  return { data: body.data, meta: body.meta, status: res.status };
}

/** Typed fetch wrapper for `/api/v1`. Throws `ApiError`. */
export async function api<T>(path: string, init?: ApiInit): Promise<T> {
  const r = await request<T>(path, init);
  return r.data;
}

/** Same as `api` but returns pagination meta as well. */
export async function apiList<T>(path: string, init?: ApiInit): Promise<{ data: T; meta?: ListMeta }> {
  const r = await request<T>(path, init);
  return { data: r.data, meta: r.meta };
}

/** Build a query string, skipping null/undefined/empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function errorMessage(e: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  // The app can't run reCAPTCHA: the server only asks for it after risk signals (e.g. several wrong passwords).
  if (e instanceof ApiError && (e.code === "CAPTCHA_REQUIRED" || e.code === "CAPTCHA_FAILED")) return "Por segurança, aguarde 15 minutos e tente de novo, ou entre pelo site tinypet.com.br.";
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}
