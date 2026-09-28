import { prisma } from "@tinypet/db";
import { updateProfileSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, sessionContext } from "@/server";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(await sessionContext(user));
});

export const PATCH = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, updateProfileSchema);
  await prisma.user.update({
    where: { id: user.id },
    data: { ...body, birthDate: body.birthDate === undefined ? undefined : body.birthDate ? new Date(body.birthDate) : null },
  });
  return ok(await sessionContext(user));
});

/** LGPD: delete account (soft delete + anonymize). */
export const DELETE = handler(async (req) => {
  const user = await requireUser(req);
  const anon = `deleted-${user.id}@anon.tinypet`;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name: "Usuário removido", email: anon, passwordHash: null, avatarUrl: null, deletedAt: new Date(), birthDate: null } }),
    prisma.phone.deleteMany({ where: { userId: user.id } }),
    prisma.email.deleteMany({ where: { userId: user.id } }),
    prisma.address.deleteMany({ where: { userId: user.id } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
    prisma.pushToken.deleteMany({ where: { userId: user.id } }),
    prisma.pet.updateMany({ where: { ownerId: user.id }, data: { deletedAt: new Date() } }),
  ]);
  return ok({ deleted: true });
});
