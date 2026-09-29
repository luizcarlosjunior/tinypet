import { handler, ok } from "@/server";
import { petActor } from "@/server/pets";
import { getSharing } from "@/server/sharing";

/** Owner or shared account: who owns the pet, shared accounts (with transfer eligibility), pending invites/transfer. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  return ok(await getSharing(await petActor(req, params.id, "VIEW")));
});
