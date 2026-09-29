import { handler, ok } from "@/server";
import { petActor } from "@/server/pets";
import { removeShare } from "@/server/sharing";

/** Owner stops sharing the pet with an account (the account is notified). */
export const DELETE = handler<{ id: string; userId: string }>(async (req, { params }) => {
  return ok(await removeShare(await petActor(req, params.id, "VIEW"), params.userId));
});
