import { petSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requirePartner } from "@/server";
import { createClientPet } from "@/server/crm";
import { assertOwnMediaUrls } from "@/server/media";

/** Creates a partner-side pet (createdByPartnerId) and links it to the client. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requirePartner(req);
  const body = await parseBody(req, petSchema);
  await assertOwnMediaUrls([body.avatarUrl], ctx.user.id);
  return ok(await createClientPet(ctx.partnerId, params.id, body), { status: 201 });
});
