import { prisma } from "@tinypet/db";
import { handler, ok, requirePartner } from "@/server";
import { getClient } from "@/server/crm";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  return ok(await prisma.clientInvite.findMany({ where: { clientId: client.id, partnerId: ctx.partnerId }, orderBy: { createdAt: "desc" } }));
});
