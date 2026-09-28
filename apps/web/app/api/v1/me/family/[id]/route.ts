import { prisma } from "@tinypet/db";
import { familyMemberSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, Errors } from "@/server";
import { familyView } from "@/server/pets";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const body = await parseBody(req, familyMemberSchema.partial());
  const row = await prisma.familyMember.findFirst({ where: { id: params.id, userId: user.id } });
  if (!row) throw Errors.notFound("Familiar não encontrado");
  const linked = body.email ? await prisma.user.findFirst({ where: { email: body.email.toLowerCase(), deletedAt: null }, select: { id: true } }) : undefined;
  const updated = await prisma.familyMember.update({ where: { id: row.id }, data: { ...body, ...(linked !== undefined ? { linkedUserId: linked?.id ?? null } : {}) } });
  return ok((await familyView(user.id, [updated]))[0]);
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const row = await prisma.familyMember.findFirst({ where: { id: params.id, userId: user.id } });
  if (!row) throw Errors.notFound("Familiar não encontrado");
  await prisma.familyMember.delete({ where: { id: row.id } });
  return ok({ deleted: true });
});
