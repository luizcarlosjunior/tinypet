import { NextResponse, type NextRequest } from "next/server";

/** CORS for the mobile app + simple pass-through. Auth is enforced inside route handlers/layouts. */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  }
  return NextResponse.next();
}

function corsHeaders(req: NextRequest) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Partner-Id",
    "Access-Control-Allow-Credentials": "true",
  };
}

export const config = { matcher: ["/api/:path*"] };
