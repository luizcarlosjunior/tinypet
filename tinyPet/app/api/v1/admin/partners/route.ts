import { z } from "zod";
import { prisma } from "@/db";
import { paginationQuery } from "@tinypet/shared";
import { handler, ok, parseQuery, requireAdmin, paginate, serialize } from "@/server";

const query = paginationQuery.extend({ q: z.string().optional(), published: z.enum(["true", "false"]).optional(), featured: z.enum(["true", "false"]).optional() });

/** GET /admin/partners?q&published&featured&page&pageSize */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, query);
  const where = {
    deletedAt: null,
    ...(q.published ? { published: q.published === "true" } : {}),
    ...(q.featured ? { featured: q.featured === "true" } : {}),
    ...(q.q ? { OR: [{ tradeName: { contains: q.q } }, { slug: { contains: q.q } }, { document: { contains: q.q } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.partner.findMany({
      where,
      ...paginate(q.page, q.pageSize),
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, tradeName: true, logoUrl: true, plan: true, published: true, featured: true, ratingAvg: true, ratingCount: true, createdAt: true, types: { select: { type: { select: { key: true, label: true } } } }, subscription: { select: { status: true, plan: { select: { key: true, name: true } } } }, _count: { select: { clients: true, catalogItems: true, memberships: true } } },
    }),
    prisma.partner.count({ where }),
  ]);
  return ok(serialize(items), { meta: { page: q.page, pageSize: q.pageSize, total } });
});
