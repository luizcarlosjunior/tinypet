/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma, prisma } from "@/db";
import { ApiError } from "./errors";
import { ipBlockedError, isIpBlocked } from "./sanctions";

export type Ctx<P = Record<string, string>> = { params: P };

/**
 * `cache`: seconds a shared cache (Cloudflare) may keep the response — ONLY for public data that doesn't depend on
 * the viewer. Browsers keep it ≤ 60 s; stale copies may be served for a day while revalidating.
 */
export function ok<T>(data: T, init?: { status?: number; meta?: Record<string, unknown>; cache?: number }) {
  const headers = init?.cache ? { "Cache-Control": `public, max-age=${Math.min(60, init.cache)}, s-maxage=${init.cache}, stale-while-revalidate=86400` } : undefined;
  return NextResponse.json({ ok: true, data, ...(init?.meta ? { meta: init.meta } : {}) }, { status: init?.status ?? 200, headers });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

/**
 * Wraps a route handler: refuses requests from blocked IPs (media-audit sanctions), catches ApiError/Zod/Prisma errors
 * and returns the shared envelope.
 */
export function handler<P = Record<string, string>>(fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (await isIpBlocked(clientIp(req))) throw ipBlockedError();
      return await fn(req, ctx);
    } catch (e) {
      // Next's "this route is dynamic" signal (thrown when reading headers during `next build`) must propagate.
      if (e && typeof e === "object" && (e as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE") throw e;
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return fail(e.status, e.code, e.message, e.details);
  if (e instanceof ZodError) return fail(400, "VALIDATION", "Dados inválidos", e.flatten());
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // meta (constraint/column names) stays in server logs only
    if (e.code === "P2002") return fail(409, "CONFLICT", "Registro duplicado");
    if (e.code === "P2025") return fail(404, "NOT_FOUND", "Não encontrado");
  }
  console.error(e);
  return fail(500, "INTERNAL", "Erro interno");
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T, any, any>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "JSON inválido");
  }
  return schema.parse(json);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T, any, any>): T {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => (obj[k] = v));
  return schema.parse(obj);
}

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Client IP for rate limiting / audit.
 * - `TRUST_PROXY=cloudflare`: the site is behind Cloudflare → `CF-Connecting-IP` (set by Cloudflare, can't be forged
 *   as long as the origin only accepts traffic from Cloudflare — firewall to Cloudflare IPs or Cloudflare Tunnel).
 * - `TRUST_PROXY=1`: trust the first hop of `x-forwarded-for` (only behind a proxy you control that overwrites it,
 *   e.g. nginx `proxy_set_header X-Forwarded-For $remote_addr` — see docs/deploy.md).
 * - Otherwise returns a constant, so IP-keyed limits degrade to a global per-key limit instead of being bypassable
 *   by sending a fake `X-Forwarded-For`.
 */
export function clientIp(req: NextRequest) {
  return clientIpFromHeaders(req.headers);
}

/** Same as clientIp() for a `Headers` or a plain header object (NextAuth `authorize(creds, req)`). */
export function clientIpFromHeaders(headers: Headers | Record<string, string | string[] | undefined>) {
  const get = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name) ?? undefined;
    const v = (headers as Record<string, string | string[] | undefined>)[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const first = (v?: string) => v?.split(",")[0]?.trim() || undefined;
  if (process.env.TRUST_PROXY === "cloudflare") {
    const v = first(get("cf-connecting-ip")) ?? first(get("x-real-ip"));
    if (v) return v;
  }
  if (process.env.TRUST_PROXY === "1") {
    const v = first(get("x-forwarded-for")) ?? first(get("x-real-ip"));
    if (v) return v;
  }
  return "0.0.0.0";
}

// Without a trusted proxy every client shares one IP key: per-IP limits become global and IP blocks do nothing.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && !["1", "cloudflare"].includes(process.env.TRUST_PROXY ?? "")) {
  console.warn("[security] TRUST_PROXY is not set: per-IP rate limits act globally and IP blocks are disabled. Use TRUST_PROXY=cloudflare behind Cloudflare.");
}

let lastCleanup = 0;

/** Increments a fixed-window counter (same table as rateLimit) and returns the current count — never throws. */
export async function bumpCounter(key: string, windowMs: number): Promise<number> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const k = key.slice(0, 191);
  await prisma.$executeRaw`INSERT INTO rate_limits (\`key\`, \`count\`, reset_at) VALUES (${k}, 1, ${resetAt})
    ON DUPLICATE KEY UPDATE \`count\` = IF(reset_at <= ${now}, 1, \`count\` + 1), reset_at = IF(reset_at <= ${now}, ${resetAt}, reset_at)`;
  const row = await prisma.rateLimit.findUnique({ where: { key: k }, select: { count: true } });
  return row?.count ?? 1;
}

/** Current value of a counter (0 when absent or expired). */
export async function readCounter(key: string): Promise<number> {
  const row = await prisma.rateLimit.findUnique({ where: { key: key.slice(0, 191) }, select: { count: true, resetAt: true } });
  return row && row.resetAt > new Date() ? row.count : 0;
}

export async function resetCounter(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key: key.slice(0, 191) } });
}

/**
 * DB-backed fixed-window rate limiter (table `rate_limits`), shared across instances/serverless invocations.
 * Atomic via `INSERT ... ON DUPLICATE KEY UPDATE`; the window restarts once `reset_at` has passed.
 * Throws 429 RATE_LIMITED when the count in the current window exceeds `limit`.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const k = key.slice(0, 191);
  await prisma.$executeRaw`INSERT INTO rate_limits (\`key\`, \`count\`, reset_at) VALUES (${k}, 1, ${resetAt})
    ON DUPLICATE KEY UPDATE \`count\` = IF(reset_at <= ${now}, 1, \`count\` + 1), reset_at = IF(reset_at <= ${now}, ${resetAt}, reset_at)`;
  const row = await prisma.rateLimit.findUnique({ where: { key: k }, select: { count: true, resetAt: true } });
  // Opportunistic cleanup of expired windows (at most once a minute per process, ~2% of calls).
  if (now.getTime() - lastCleanup > 60_000 && Math.random() < 0.02) {
    lastCleanup = now.getTime();
    prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => undefined);
    prisma.session.deleteMany({ where: { expires: { lt: now } } }).catch(() => undefined);
  }
  if (row && row.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000));
    throw new ApiError(429, "RATE_LIMITED", "Muitas tentativas. Tente novamente em instantes.", { retryAfter });
  }
}

/** Converts Prisma Decimal/Date values to JSON-friendly primitives. */
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (v && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function" && (v as { constructor?: { name?: string } }).constructor?.name === "Decimal") {
        return Number(v);
      }
      return v;
    }),
  );
}
