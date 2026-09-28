import { prisma } from "@tinypet/db";
import { familyMemberSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { getClient } from "@/server/crm";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  return ok(await prisma.familyMember.findMany({ where: { clientId: client.id }, orderBy: { name: "asc" } }));
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const body = await parseBody(req, familyMemberSchema);
  return ok(await prisma.familyMember.create({ data: { ...body, clientId: client.id } }), { status: 201 });
});
