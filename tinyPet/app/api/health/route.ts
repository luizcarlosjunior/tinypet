import { NextResponse } from "next/server";
import { prisma } from "@/db";

export const dynamic = "force-dynamic";

/** GET /api/health — liveness + database check for the container/Coolify health check. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
