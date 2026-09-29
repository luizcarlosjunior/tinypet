import { handler, ok, requireUser } from "@/server";
import { acceptShareInvite } from "@/server/sharing";

/** Recipient accepts a pending share invite. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  return ok(await acceptShareInvite(user.id, params.id));
});
