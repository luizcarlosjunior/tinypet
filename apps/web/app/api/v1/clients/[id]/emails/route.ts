import { emailSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { getClient, emails } from "@/server/crm";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  return ok(await emails.list({ clientId: client.id }));
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const client = await getClient(ctx.partnerId, params.id);
  const body = await parseBody(req, emailSchema);
  return ok(await emails.create({ clientId: client.id }, body), { status: 201 });
});
