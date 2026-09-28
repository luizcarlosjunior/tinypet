import { addressSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { getClient, addresses } from "@/server/crm";

export const PATCH = handler<{ id: string; cid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const body = await parseBody(req, addressSchema.partial());
  return ok(serialize(await addresses.update({ clientId: client.id }, params.cid, body)));
});

export const DELETE = handler<{ id: string; cid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  await addresses.remove({ clientId: client.id }, params.cid);
  return ok({ deleted: true });
});
