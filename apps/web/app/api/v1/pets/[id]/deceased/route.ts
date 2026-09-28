import { markDeceasedSchema } from "@tinypet/shared";
import { handler, ok, parseBody, Errors } from "@/server";
import { petActor, markDeceased, undoDeceased, petWithAge } from "@/server/pets";

/**
 * Owner (or a linked partner, only when the pet has no owner yet — otherwise the tutor decides):
 * cancels future appointments (notifies partners), pauses tasks, status DECEASED.
 */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via === "family") throw Errors.forbidden("Apenas o tutor principal ou o parceiro podem marcar o falecimento");
  if (actor.via === "partner" && actor.pet.ownerId !== null) throw Errors.forbidden("Este pet tem tutor: apenas o tutor pode marcar o falecimento");
  if (actor.pet.status === "DECEASED") throw Errors.conflict("Pet já marcado como falecido");
  const body = await parseBody(req, markDeceasedSchema);
  const result = await markDeceased(params.id, body, actor.via === "partner" ? "PARTNER" : "OWNER");
  return ok({ ...(await petWithAge(params.id)), ...result });
});

/** Undo (owner only): restores ACTIVE and resumes paused tasks. */
export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const actor = await petActor(req, params.id, "EDIT");
  if (actor.via !== "owner") throw Errors.forbidden("Apenas o tutor principal pode desfazer");
  if (actor.pet.status !== "DECEASED") throw Errors.conflict("Pet não está marcado como falecido");
  await undoDeceased(params.id);
  return ok(await petWithAge(params.id));
});
