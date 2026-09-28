import { prisma } from "@tinypet/db";
import { planSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireAdmin, serialize, Errors } from "@/server";
import { planInclude, upsertPlanLimits } from "@/server/admin";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const plan = await prisma.plan.findUnique({ where: { id: params.id }, include: planInclude });
  if (!plan) throw Errors.notFound("Plano não encontrado");
  return ok(serialize(plan));
});

/** PATCH /admin/plans/:id (planSchema partial; limits[] upserted per feature). */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { limits, ...data } = await parseBody(req, planSchema.partial());
  await prisma.plan.update({ where: { id: params.id }, data });
  if (limits?.length) await upsertPlanLimits(params.id, limits);
  return ok(serialize(await prisma.plan.findUniqueOrThrow({ where: { id: params.id }, include: planInclude })));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const subs = await prisma.subscription.count({ where: { planId: params.id } });
  if (subs) throw Errors.conflict("Plano em uso por assinaturas; torne-o invisível em vez de excluir");
  await prisma.plan.delete({ where: { id: params.id } });
  return ok({ deleted: true });
});
