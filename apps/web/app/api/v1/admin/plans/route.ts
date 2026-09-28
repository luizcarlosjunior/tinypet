import { prisma } from "@tinypet/db";
import { planSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireAdmin, serialize } from "@/server";
import { planInclude, upsertPlanLimits } from "@/server/admin";

export const GET = handler(async (req) => {
  await requireAdmin(req);
  return ok(serialize(await prisma.plan.findMany({ include: planInclude, orderBy: [{ audience: "asc" }, { sortOrder: "asc" }] })));
});

/** POST /admin/plans (planSchema with limits[]) */
export const POST = handler(async (req) => {
  await requireAdmin(req);
  const { limits, ...data } = await parseBody(req, planSchema);
  const plan = await prisma.plan.create({ data });
  if (limits?.length) await upsertPlanLimits(plan.id, limits);
  return ok(serialize(await prisma.plan.findUniqueOrThrow({ where: { id: plan.id }, include: planInclude })), { status: 201 });
});
