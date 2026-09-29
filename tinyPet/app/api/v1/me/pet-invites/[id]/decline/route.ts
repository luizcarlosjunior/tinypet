import { handler, ok, requireUser } from "@/server";
import { declineShareInvite } from "@/server/sharing";

/** Recipient declines a pending share invite. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  return ok(await declineShareInvite(user.id, params.id));
});
