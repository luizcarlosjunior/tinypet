import { handler, ok } from "@/server";
import { petActor } from "@/server/pets";
import { leavePet } from "@/server/sharing";

/** Shared account revokes its own access (the owner is notified). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  return ok(await leavePet(await petActor(req, params.id, "VIEW")));
});
