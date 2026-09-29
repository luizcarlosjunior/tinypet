import { addressSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner, serialize } from "@/server";
import { getClient, addresses } from "@/server/crm";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  return ok(serialize(await addresses.list({ clientId: client.id })));
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const body = await parseBody(req, addressSchema);
  return ok(serialize(await addresses.create({ clientId: client.id }, body)), { status: 201 });
});
