import { markDeceasedSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors, audit, clientIp } from "@/server";
import { petActor, markDeceased, petWithAge } from "@/server/pets";
import { assertReauth } from "@/server/reauth";

/**
 * Registers the pet's death. IRREVERSIBLE: there is no undo endpoint.
 * Owner (or a linked partner, only when the pet has no owner yet — otherwise the tutor decides) must confirm with
 * their password, or with an e-mail code (`POST /pets/:id/deceased/code`) when the account has no password.
 * Effects: cancels future appointments (notifies partners), pauses tasks, status DECEASED.
 */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via === "family") throw Errors.forbidden("Apenas o tutor principal ou o parceiro podem registrar o falecimento");
  if (actor.via === "partner" && actor.pet.ownerId !== null) throw Errors.forbidden("Este pet tem tutor: apenas o tutor pode registrar o falecimento");
  if (actor.pet.status === "DECEASED") throw Errors.conflict("O falecimento deste pet já foi registrado");
  const { password, code, ...body } = await parseBody(req, markDeceasedSchema);
  await assertReauth(actor.user.id, "pet_deceased", { password, code });
  const result = await markDeceased(params.id, body, actor.via === "partner" ? "PARTNER" : "OWNER");
  await audit({
    userId: actor.user.id,
    partnerId: actor.via === "partner" ? actor.partnerId : undefined,
    action: "pet.deceased",
    entity: "Pet",
    entityId: params.id,
    data: { deceasedAt: body.deceasedAt, via: actor.via, confirmedWith: password ? "password" : "email_code" },
    ip: clientIp(req),
  });
  return ok({ ...(await petWithAge(params.id)), ...result });
});
