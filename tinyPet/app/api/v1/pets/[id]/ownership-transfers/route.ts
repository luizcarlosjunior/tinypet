import { ownershipTransferSchema } from "@tinypet/shared";
import { handler, ok, parseBody, clientIp } from "@/server";
import { petActor } from "@/server/pets";
import { createOwnershipTransfer } from "@/server/sharing";

/**
 * Owner asks to transfer ownership to a shared account (7 days after the sharing started and 7 days after the owner
 * got the pet). Confirmed with the password, or an e-mail code (`POST .../ownership-transfers/code`) for OAuth-only accounts.
 */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "VIEW");
  const body = await parseBody(req, ownershipTransferSchema);
  return ok(await createOwnershipTransfer(actor, body, clientIp(req)), { status: 201 });
});
