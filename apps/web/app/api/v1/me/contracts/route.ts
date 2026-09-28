import { handler, ok, requireUser, serialize } from "@/server";
import { listOwnerContracts } from "@/server/finance";

/** GET /me/contracts → contracts of clients linked to the user (non-draft). */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(serialize(await listOwnerContracts(user.id)));
});
