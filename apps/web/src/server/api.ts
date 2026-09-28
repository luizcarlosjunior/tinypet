/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@tinypet/db";
import { ApiError } from "./errors";

export type Ctx<P = Record<string, string>> = { params: P };

export function ok<T>(data: T, init?: { status?: number; meta?: Record<string, unknown> }) {
  return NextResponse.json({ ok: true, data, ...(init?.meta ? { meta: init.meta } : {}) }, { status: init?.status ?? 200 });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

/** Wraps a route handler: catches ApiError/Zod/Prisma errors and returns the shared envelope. */
export function handler<P = Record<string, string>>(fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return fail(e.status, e.code, e.message, e.details);
  if (e instanceof ZodError) return fail(400, "VALIDATION", "Dados inválidos", e.flatten());
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return fail(409, "CONFLICT", "Registro duplicado", e.meta);
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

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "0.0.0.0";
}

/** Tiny in-memory rate limiter (per process). Good enough for MVP; swap for Redis later. */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > limit) throw new ApiError(429, "RATE_LIMITED", "Muitas tentativas. Tente novamente em instantes.");
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
