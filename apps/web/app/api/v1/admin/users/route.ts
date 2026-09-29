import { z } from "zod";
import { prisma } from "@tinypet/db";
import { paginationQuery } from "@tinypet/shared";
import { handler, ok, parseQuery, requireAdmin, paginate, serialize } from "@/server";

const query = paginationQuery.extend({ q: z.string().optional(), role: z.enum(["USER", "ADMIN", "EDITOR"]).optional() });

/** GET /admin/users?q&role&page&pageSize */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, query);
  const where = { deletedAt: null, ...(q.role ? { role: q.role } : {}), ...(q.q ? { OR: [{ name: { contains: q.q } }, { email: { contains: q.q } }] } : {}) };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      ...paginate(q.page, q.pageSize),
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, emailVerifiedAt: true, createdAt: true, subscription: { select: { status: true, plan: { select: { key: true, name: true } } } }, _count: { select: { pets: true, memberships: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return ok(serialize(items), { meta: { page: q.page, pageSize: q.pageSize, total } });
});
