import { clientInviteSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { createInvite } from "@/server/crm";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, clientInviteSchema);
  return ok(await createInvite(ctx.partnerId, params.id, body), { status: 201 });
});
