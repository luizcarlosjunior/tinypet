import { handler, ok } from "@/server";
import { petActor } from "@/server/pets";
import { cancelOwnershipTransfer } from "@/server/sharing";

/** Owner cancels a pending ownership transfer. */
export const DELETE = handler<{ id: string; transferId: string }>(async (req, { params }) => {
  return ok(await cancelOwnershipTransfer(await petActor(req, params.id, "VIEW"), params.transferId));
});
