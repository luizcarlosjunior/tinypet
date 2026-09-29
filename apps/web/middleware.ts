import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS allowlist + CSRF guard for the REST API. Auth itself is enforced inside route handlers/layouts.
 *
 * Allowed origins: NEXT_PUBLIC_APP_URL, CORS_ORIGINS (comma-separated) and, in development only,
 * http://localhost:* / http://127.0.0.1:* (incl. Expo web on :8081).
 *
 * CSRF (cookie-authenticated, state-changing /api/v1 requests without `Authorization: Bearer`):
 * - `Origin`, when present, must be allowlisted or same-origin;
 * - body must be `application/json` (bodyless requests are fine), except multipart on /api/v1/clients/import and
 *   /api/v1/admin/blog/media(/estimate), and
 *   raw bytes on /api/v1/media/upload/*. /api/v1/webhooks/* is exempt (server-to-server, own auth).
 */
const IS_DEV = process.env.NODE_ENV === "development";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeOrigin(o: string) {
  try {
    return new URL(o.trim()).origin;
  } catch {
    return null;
  }
}

const ALLOWED = new Set(
  [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL, ...(process.env.CORS_ORIGINS ?? "").split(",")]
    .filter((o): o is string => !!o && !!o.trim())
    .map(normalizeOrigin)
    .filter((o): o is string => !!o),
);

function isAllowedOrigin(origin: string) {
  const o = normalizeOrigin(origin);
  if (!o) return false;
  if (ALLOWED.has(o)) return true;
  if (IS_DEV && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return true;
  return false;
}

function isSameOrigin(req: NextRequest, origin: string) {
  const o = normalizeOrigin(origin);
  if (!o) return false;
  if (o === req.nextUrl.origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return !!host && new URL(o).host === host;
}

function json403(message: string) {
  return NextResponse.json({ ok: false, error: { code: "CSRF", message } }, { status: 403 });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin");
  const cors = origin && isAllowedOrigin(origin) ? corsHeaders(origin) : null;

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: { Vary: "Origin", ...(cors ?? {}) } });
  }

  if (pathname.startsWith("/api/v1/") && UNSAFE_METHODS.has(req.method) && !pathname.startsWith("/api/v1/webhooks/")) {
    const hasBearer = req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
    const hasCookie = !!req.headers.get("cookie");
    if (hasCookie && !hasBearer) {
      if (origin && !cors && !isSameOrigin(req, origin)) return json403("Origem não permitida");
      const ct = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      const hasBody = !!ct || Number(req.headers.get("content-length") ?? "0") > 0 || req.headers.has("transfer-encoding");
      const ctOk =
        !hasBody ||
        ct === "application/json" ||
        (ct === "multipart/form-data" && (pathname === "/api/v1/clients/import" || pathname === "/api/v1/admin/blog/media" || pathname === "/api/v1/admin/blog/media/estimate")) ||
        pathname.startsWith("/api/v1/media/upload/");
      if (!ctOk) return json403("Content-Type não permitido");
    }
  }

  const res = NextResponse.next();
  res.headers.set("Vary", "Origin");
  if (cors) for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Partner-Id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "600",
  };
}

export const config = { matcher: ["/api/:path*"] };
