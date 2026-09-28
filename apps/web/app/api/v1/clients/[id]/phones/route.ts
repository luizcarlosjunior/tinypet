import { phoneSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { getClient, phones } from "@/server/crm";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  return ok(await phones.list({ clientId: client.id }));
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const body = await parseBody(req, phoneSchema);
  return ok(await phones.create({ clientId: client.id }, body), { status: 201 });
});
