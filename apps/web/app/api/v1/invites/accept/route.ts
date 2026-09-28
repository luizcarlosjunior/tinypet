import { acceptInviteSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { acceptInvite } from "@/server/crm";

/** Authenticated tutor accepts the invite: links the client to their account and merges/adopts pets. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, acceptInviteSchema);
  return ok(serialize(await acceptInvite(user.id, body)));
});
