import { z } from "zod";
import { prisma } from "@/db";
import { paginationQuery } from "@tinypet/shared";
import { handler, ok, parseQuery, requireAdmin, paginate } from "@/server";

const query = paginationQuery.extend({ status: z.enum(["PENDING", "READY", "FLAGGED", "REJECTED"]).optional() });

/** GET /admin/media?status=FLAGGED (default) */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, query);
  const where = { status: q.status ?? "FLAGGED" };
  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({ where, ...paginate(q.page, q.pageSize), orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true, email: true } }, partner: { select: { id: true, tradeName: true } } } }),
    prisma.mediaAsset.count({ where }),
  ]);
  return ok(items, { meta: { page: q.page, pageSize: q.pageSize, total } });
});
