import { shareInviteSchema } from "@tinypet/shared";
import { handler, ok, parseBody } from "@/server";
import { petActor } from "@/server/pets";
import { createShareInvite } from "@/server/sharing";

/** Owner invites another account (by @username or e-mail) to share the pet. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  const { handle } = await parseBody(req, shareInviteSchema);
  return ok(await createShareInvite(actor, handle), { status: 201 });
});
