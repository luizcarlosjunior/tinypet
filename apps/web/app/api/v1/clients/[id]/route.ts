import { prisma } from "@tinypet/db";
import { updateClientSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { getClient, updateClient, clientSummary } from "@/server/crm";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const [invites, contracts] = await Promise.all([
    prisma.clientInvite.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.contract.findMany({ where: { clientId: client.id, status: { in: ["ACTIVE", "DRAFT"] } }, select: { id: true, title: true, status: true, type: true, totalAmount: true } }),
  ]);
  return ok(serialize({ ...clientSummary(client), invites, contracts }));
});

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, updateClientSchema);
  return ok(serialize(clientSummary(await updateClient(ctx.partnerId, params.id, body))));
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  await prisma.client.update({ where: { id: client.id }, data: { deletedAt: new Date() } });
  return ok({ deleted: true });
});
