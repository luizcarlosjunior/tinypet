import { createPartnerSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { createPartner } from "@/server/partners";

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const input = await parseBody(req, createPartnerSchema);
  const partner = await createPartner(user.id, input);
  return ok(serialize(partner), { status: 201 });
});
