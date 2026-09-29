import { clientSchema, clientSearchQuery } from "@tinypet/shared";
import { handler, ok, parseBody, parseQuery, requirePartner, assertLimit, serialize } from "@/server";
import { listClients, createClient, clientCount, clientSummary } from "@/server/crm";

export const GET = handler(async (req) => {
  const ctx = await requirePartner(req);
  const q = parseQuery(req, clientSearchQuery);
  const { items, total } = await listClients(ctx.partnerId, q);
  return ok(serialize(items), { meta: { page: q.page, pageSize: q.pageSize, total } });
});

export const POST = handler(async (req) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, clientSchema);
  await assertLimit("PARTNER", ctx.partnerId, "crm_clients", await clientCount(ctx.partnerId));
  const client = await createClient(ctx.partnerId, body);
  return ok(serialize(clientSummary(client)), { status: 201 });
});
