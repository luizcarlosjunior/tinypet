import { prisma } from "@tinypet/db";
import { updateProfileSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, sessionContext, audit, clientIp, ApiError } from "@/server";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(await sessionContext(user));
});

export const PATCH = handler(async (req) => {
  const user = await requireUser(req);
  const { acceptTerms, ...body } = await parseBody(req, updateProfileSchema);
  let terms: { termsVersion: string; termsAcceptedAt: Date } | undefined;
  if (acceptTerms) {
    const version = ((await prisma.setting.findUnique({ where: { key: "terms_version" } }))?.value as string | undefined) ?? "1";
    terms = { termsVersion: version, termsAcceptedAt: new Date() };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { ...body, ...terms, birthDate: body.birthDate === undefined ? undefined : body.birthDate ? new Date(body.birthDate) : null },
  });
  if (terms) await audit({ userId: user.id, action: "terms.accept", entity: "User", entityId: user.id, data: { version: terms.termsVersion }, ip: clientIp(req) });
  return ok(await sessionContext(user));
});

/** LGPD: delete account (soft delete + anonymize). Refused while the user is the only OWNER of an active partner. */
export const DELETE = handler(async (req) => {
  const user = await requireUser(req);
  const owned = await prisma.membership.findMany({ where: { userId: user.id, role: "OWNER", partner: { deletedAt: null } }, select: { partnerId: true, partner: { select: { tradeName: true } } } });
  const blocking: string[] = [];
  for (const m of owned) {
    const others = await prisma.membership.count({ where: { partnerId: m.partnerId, role: "OWNER", userId: { not: user.id } } });
    if (others === 0) blocking.push(m.partner.tradeName);
  }
  if (blocking.length) {
    throw new ApiError(409, "SOLE_OWNER", `Você é o único dono de ${blocking.join(", ")}. Transfira a propriedade para outra pessoa ou exclua o parceiro antes de excluir sua conta.`, { partners: blocking });
  }
  const anon = `deleted-${user.id}@anon.tinypet`;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name: "Usuário removido", email: anon, passwordHash: null, avatarUrl: null, deletedAt: new Date(), birthDate: null, tokenVersion: { increment: 1 } } }),
    prisma.phone.deleteMany({ where: { userId: user.id } }),
    prisma.email.deleteMany({ where: { userId: user.id } }),
    prisma.address.deleteMany({ where: { userId: user.id } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
    prisma.pushToken.deleteMany({ where: { userId: user.id } }),
    prisma.verificationCode.deleteMany({ where: { userId: user.id } }),
    prisma.membership.deleteMany({ where: { userId: user.id } }),
    prisma.pet.updateMany({ where: { ownerId: user.id }, data: { deletedAt: new Date() } }),
  ]);
  await audit({ userId: user.id, action: "account.delete", entity: "User", entityId: user.id, ip: clientIp(req) });
  return ok({ deleted: true });
});
