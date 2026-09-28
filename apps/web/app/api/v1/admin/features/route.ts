import { prisma } from "@tinypet/db";
import { handler, ok, requireAdmin } from "@/server";

/** GET /admin/features → feature catalog (keys are code-defined; read-only). */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  return ok(await prisma.feature.findMany({ orderBy: [{ audience: "asc" }, { module: "asc" }, { key: "asc" }] }));
});
