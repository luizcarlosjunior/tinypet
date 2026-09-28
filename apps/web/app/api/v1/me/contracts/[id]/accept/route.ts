import { contractAcceptSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize, clientIp } from "@/server";
import { acceptContract } from "@/server/finance";

/** POST /me/contracts/:id/accept {accept:true} → records acceptedAt + acceptedIp, audits and notifies the partner. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  await parseBody(req, contractAcceptSchema);
  return ok(serialize(await acceptContract(user, params.id, clientIp(req))));
});
