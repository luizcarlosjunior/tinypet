import { prisma } from "@tinypet/db";
import { handler, ok, parseBody, requireAdmin, serialize, audit, clientIp, Errors } from "@/server";
import { adminPartnerPatchSchema, assignPlan } from "@/server/admin";

const include = { types: { select: { type: { select: { key: true, label: true } } } }, subscription: { select: { status: true, plan: { select: { key: true, name: true } } } }, memberships: { select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } } } };

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const p = await prisma.partner.findFirst({ where: { id: params.id, deletedAt: null }, include });
  if (!p) throw Errors.notFound("Parceiro não encontrado");
  return ok(serialize(p));
});

/** PATCH /admin/partners/:id {planKey?, featured?, published?} → subscription upsert + partner.plan, flags. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const body = await parseBody(req, adminPartnerPatchSchema);
  const p = await prisma.partner.findFirst({ where: { id: params.id, deletedAt: null }, select: { id: true } });
  if (!p) throw Errors.notFound("Parceiro não encontrado");
  if (body.featured !== undefined || body.published !== undefined) {
    await prisma.partner.update({ where: { id: p.id }, data: { ...(body.featured !== undefined ? { featured: body.featured } : {}), ...(body.published !== undefined ? { published: body.published } : {}) } });
  }
  if (body.planKey) await assignPlan("PARTNER", p.id, body.planKey);
  await audit({ userId: admin.id, partnerId: p.id, action: "admin.partner.update", entity: "Partner", entityId: p.id, data: body, ip: clientIp(req) });
  return ok(serialize(await prisma.partner.findUniqueOrThrow({ where: { id: p.id }, include })));
});
