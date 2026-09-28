import { z } from "zod";
import { prisma } from "@tinypet/db";
import { handler, ok, parseQuery, requireAdmin, serialize } from "@/server";
import { reportInclude } from "@/server/admin";

const query = z.object({ status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).optional() });

/** GET /admin/reports?status (default OPEN) */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, query);
  const rows = await prisma.report.findMany({ where: { status: q.status ?? "OPEN" }, include: reportInclude, orderBy: { createdAt: "desc" } });
  return ok(serialize(rows));
});
