import { prisma } from "@/db";
import { handler, ok, parseBody, requireAdmin, serialize, audit, clientIp, Errors } from "@/server";
import { adminUserPatchSchema, assignPlan } from "@/server/admin";

const select = { id: true, name: true, email: true, role: true, avatarUrl: true, emailVerifiedAt: true, createdAt: true, subscription: { select: { status: true, plan: { select: { key: true, name: true } } } } };

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const u = await prisma.user.findFirst({ where: { id: params.id, deletedAt: null }, select: { ...select, memberships: { select: { id: true, role: true, partner: { select: { id: true, tradeName: true, slug: true } } } } } });
  if (!u) throw Errors.notFound("Usuário não encontrado");
  return ok(serialize(u));
});

/** PATCH /admin/users/:id {role?, planKey?} → role update and/or owner subscription upsert. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const body = await parseBody(req, adminUserPatchSchema);
  const u = await prisma.user.findFirst({ where: { id: params.id, deletedAt: null }, select: { id: true } });
  if (!u) throw Errors.notFound("Usuário não encontrado");
  if (body.role) await prisma.user.update({ where: { id: u.id }, data: { role: body.role } });
  if (body.planKey) await assignPlan("OWNER", u.id, body.planKey);
  await audit({ userId: admin.id, action: "admin.user.update", entity: "User", entityId: u.id, data: body, ip: clientIp(req) });
  return ok(serialize(await prisma.user.findUniqueOrThrow({ where: { id: u.id }, select })));
});
