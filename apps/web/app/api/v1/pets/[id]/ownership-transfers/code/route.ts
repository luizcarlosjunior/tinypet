import { handler, ok } from "@/server";
import { petActor } from "@/server/pets";
import { sendTransferCode } from "@/server/sharing";

/** Sends the 10-minute e-mail confirmation code (only for accounts without a password). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  return ok(await sendTransferCode(await petActor(req, params.id, "VIEW")));
});
