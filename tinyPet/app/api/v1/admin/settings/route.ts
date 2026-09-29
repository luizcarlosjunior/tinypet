import { prisma } from "@/db";
import { handler, ok, requireAdmin } from "@/server";

/** GET /admin/settings → { key: value } */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  const rows = await prisma.setting.findMany({ orderBy: { key: "asc" } });
  return ok(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});
