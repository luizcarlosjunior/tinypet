import { handler, ok, requireUser, clientIp } from "@/server";
import { acceptOwnershipTransfer } from "@/server/sharing";

/** Recipient accepts a pending ownership transfer. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  return ok(await acceptOwnershipTransfer(user.id, params.id, clientIp(req)));
});
