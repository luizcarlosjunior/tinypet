import { phoneSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { getClient, phones } from "@/server/crm";

export const PATCH = handler<{ id: string; cid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const body = await parseBody(req, phoneSchema.partial());
  return ok(await phones.update({ clientId: client.id }, params.cid, body));
});

export const DELETE = handler<{ id: string; cid: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  await phones.remove({ clientId: client.id }, params.cid);
  return ok({ deleted: true });
});
