import { handler, ok, requireUser } from "@/server";
import { myPetInvites } from "@/server/sharing";

/** Pending (not expired) share invites and ownership transfer requests addressed to me. */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  return ok(await myPetInvites(user.id));
});
