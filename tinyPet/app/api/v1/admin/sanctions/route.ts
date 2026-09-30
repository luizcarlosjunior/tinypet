import { z } from "zod";
import { handler, ok, parseQuery, requireAdmin } from "@/server";
import { listSanctions } from "@/server/media-audit";

const query = z.object({ active: z.enum(["1", "0"]).optional(), userId: z.string().min(1).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) });

/** GET /admin/sanctions?active=1&userId= → sanctions (newest first) with `active`. */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, query);
  const { items, total } = await listSanctions({ active: q.active === "1", userId: q.userId, page: q.page, pageSize: q.pageSize });
  return ok(items, { meta: { page: q.page, pageSize: q.pageSize, total } });
});
