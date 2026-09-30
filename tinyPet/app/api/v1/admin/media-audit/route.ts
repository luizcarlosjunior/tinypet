import { z } from "zod";
import { handler, ok, parseQuery, requireAdmin } from "@/server";
import { auditQueue } from "@/server/media-audit";

const query = z.object({ status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).default("OPEN"), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(24) });

/** GET /admin/media-audit?status=OPEN|RESOLVED|DISMISSED → reported media grouped by asset (OPEN: most reported first). */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, query);
  const { items, total } = await auditQueue(q.status, q.page, q.pageSize);
  return ok(items, { meta: { page: q.page, pageSize: q.pageSize, total } });
});
