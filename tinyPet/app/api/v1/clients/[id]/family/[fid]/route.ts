import { prisma } from "@/db";
import { familyMemberSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, Errors } from "@/server";
import { getClient } from "@/server/crm";

export const PATCH = handler<{ id: string; fid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const body = await parseBody(req, familyMemberSchema.partial());
  const row = await prisma.familyMember.findFirst({ where: { id: params.fid, clientId: client.id } });
  if (!row) throw Errors.notFound("Familiar não encontrado");
  return ok(await prisma.familyMember.update({ where: { id: row.id }, data: body }));
});

export const DELETE = handler<{ id: string; fid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const row = await prisma.familyMember.findFirst({ where: { id: params.fid, clientId: client.id } });
  if (!row) throw Errors.notFound("Familiar não encontrado");
  await prisma.familyMember.delete({ where: { id: row.id } });
  return ok({ deleted: true });
});
