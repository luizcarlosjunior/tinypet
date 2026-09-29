import { handler, ok, requireUser } from "@/server";
import { declineOwnershipTransfer } from "@/server/sharing";

/** Recipient declines a pending ownership transfer. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  return ok(await declineOwnershipTransfer(user.id, params.id));
});
