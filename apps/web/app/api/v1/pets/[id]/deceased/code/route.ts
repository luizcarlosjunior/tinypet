import { handler, ok, Errors } from "@/server";
import { petActor } from "@/server/pets";
import { sendReauthCode } from "@/server/reauth";

/** Sends the e-mail confirmation code for accounts without a password (Google/Apple sign-in). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via === "family") throw Errors.forbidden("Apenas o tutor principal ou o parceiro podem registrar o falecimento");
  if (actor.via === "partner" && actor.pet.ownerId !== null) throw Errors.forbidden("Este pet tem tutor: apenas o tutor pode registrar o falecimento");
  if (actor.pet.status === "DECEASED") throw Errors.conflict("O falecimento deste pet já foi registrado");
  return ok(await sendReauthCode(actor.user.id, "pet_deceased"));
});
