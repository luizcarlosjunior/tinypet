import { handler, ok } from "@/server";
import { petActor, assertCanRegisterDeath } from "@/server/pets";
import { sendReauthCode } from "@/server/reauth";

/** Sends the e-mail confirmation code for accounts without a password (Google/Apple sign-in). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  assertCanRegisterDeath(actor);
  return ok(await sendReauthCode(actor.user.id, "pet_deceased"));
});
