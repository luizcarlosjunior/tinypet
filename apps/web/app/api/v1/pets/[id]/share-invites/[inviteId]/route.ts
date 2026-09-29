import { handler, ok } from "@/server";
import { petActor } from "@/server/pets";
import { cancelShareInvite } from "@/server/sharing";

/** Owner cancels a pending share invite. */
export const DELETE = handler<{ id: string; inviteId: string }>(async (req, { params }) => {
  return ok(await cancelShareInvite(await petActor(req, params.id, "VIEW"), params.inviteId));
});
